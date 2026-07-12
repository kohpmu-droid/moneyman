import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";

/**
 * Minimal Google Sheets v4 client authenticated with a service account.
 * No external dependencies — the RS256 JWT is signed with node:crypto and
 * exchanged for an access token via Google's OAuth token endpoint.
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class SheetsClient {
  private token?: { value: string; expiresAt: number };

  private constructor(
    private readonly sa: ServiceAccount,
    private readonly spreadsheetId: string,
    private readonly tab: string,
  ) {}

  static async create(opts: {
    keyFile?: string;
    keyJson?: string;
    spreadsheetId: string;
    tab: string;
  }): Promise<SheetsClient> {
    let raw: string;
    if (opts.keyJson) {
      raw = opts.keyJson;
    } else if (opts.keyFile) {
      raw = await readFile(opts.keyFile, "utf8");
    } else {
      throw new Error(
        "Provide GOOGLE_SERVICE_ACCOUNT_KEY (inline JSON) or GOOGLE_SERVICE_ACCOUNT_KEY_FILE (path)",
      );
    }
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) {
      throw new Error(
        "Service account JSON must have client_email and private_key",
      );
    }
    return new SheetsClient(sa, opts.spreadsheetId, opts.tab);
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.expiresAt - 60 > now) {
      return this.token.value;
    }

    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claim = base64url(
      JSON.stringify({
        iss: this.sa.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    );
    const signingInput = `${header}.${claim}`;
    const signature = base64url(
      createSign("RSA-SHA256").update(signingInput).sign(this.sa.private_key),
    );
    const assertion = `${signingInput}.${signature}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const body: any = await res.json();
    if (!res.ok || !body.access_token) {
      throw new Error(`Google auth failed: ${JSON.stringify(body)}`);
    }
    this.token = {
      value: body.access_token,
      expiresAt: now + (body.expires_in ?? 3600),
    };
    return this.token.value;
  }

  private async api(path: string, init: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      },
    );
    const body = await res.json();
    if (!res.ok) {
      throw new Error(`Sheets API error: ${JSON.stringify(body)}`);
    }
    return body;
  }

  /** Reads a single column's values (used for de-duplication by lead id). */
  async readColumn(columnA1: string): Promise<string[]> {
    const range = `${this.tab}!${columnA1}`;
    const body = await this.api(`/values/${encodeURIComponent(range)}`);
    return (body.values ?? []).map((row: string[]) => row[0] ?? "");
  }

  /** True if the tab currently has no data (needs a header row). */
  async isEmpty(): Promise<boolean> {
    const body = await this.api(
      `/values/${encodeURIComponent(`${this.tab}!A1:A1`)}`,
    );
    return !body.values || body.values.length === 0;
  }

  /** Appends rows to the bottom of the tab. */
  async appendRows(rows: Array<Array<string>>): Promise<void> {
    if (rows.length === 0) return;
    const range = `${this.tab}!A1`;
    await this.api(
      `/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: rows }) },
    );
  }
}
