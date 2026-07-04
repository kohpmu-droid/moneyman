import { readFile } from "node:fs/promises";
import { basename } from "node:path";

/** The subset of config the HTTP client needs (satisfied by Config). */
export interface MetaClientConfig {
  accessToken: string;
  graphVersion: string;
  dryRun: boolean;
}

/**
 * Thin wrapper around the Meta Graph / Marketing API.
 *
 * Uses Node's built-in fetch/FormData/Blob (Node >= 18, we target 24), so this
 * module has no external dependencies.
 */
export class MetaClient {
  constructor(private readonly config: MetaClientConfig) {}

  private get base(): string {
    return `https://graph.facebook.com/${this.config.graphVersion}`;
  }

  private async handle(res: Response, context: string): Promise<any> {
    const text = await res.text();
    let body: any;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    if (!res.ok || body?.error) {
      const err = body?.error;
      const message = err
        ? `${err.message} (type=${err.type}, code=${err.code}` +
          `${err.error_subcode ? `, subcode=${err.error_subcode}` : ""})`
        : `HTTP ${res.status}`;
      throw new Error(`Meta API error during "${context}": ${message}`);
    }
    return body;
  }

  /**
   * POST with form-urlencoded body. Complex values (objects/arrays) are
   * JSON-stringified, which is what the Graph API expects for nested params.
   */
  async post(
    path: string,
    params: Record<string, unknown>,
    context = path,
  ): Promise<any> {
    const form = new URLSearchParams();
    form.set("access_token", this.config.accessToken);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      form.set(
        key,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
    }

    if (this.config.dryRun) {
      const preview = Object.fromEntries(
        [...form.entries()].filter(([k]) => k !== "access_token"),
      );
      console.log(`[DRY RUN] POST ${path}`, JSON.stringify(preview, null, 2));
      return { id: `dry-run-${context}`, dryRun: true };
    }

    const res = await fetch(`${this.base}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    return this.handle(res, context);
  }

  async get(
    path: string,
    params: Record<string, string> = {},
    context = path,
  ): Promise<any> {
    const search = new URLSearchParams({
      access_token: this.config.accessToken,
      ...params,
    });
    const res = await fetch(`${this.base}/${path}?${search.toString()}`);
    return this.handle(res, context);
  }

  /**
   * GET an absolute URL (used to follow Graph API `paging.next` cursors,
   * which already include the version, params and access token).
   */
  async getAbsolute(url: string, context = "getAbsolute"): Promise<any> {
    const res = await fetch(url);
    return this.handle(res, context);
  }

  /** Multipart upload of a local file (used for images & videos). */
  async uploadFile(
    path: string,
    localFilePath: string,
    extraFields: Record<string, string> = {},
    context = "uploadFile",
  ): Promise<any> {
    const buffer = await readFile(localFilePath);
    const form = new FormData();
    form.set("access_token", this.config.accessToken);
    for (const [key, value] of Object.entries(extraFields)) {
      form.set(key, value);
    }
    form.set(
      "source",
      new Blob([new Uint8Array(buffer)]),
      basename(localFilePath),
    );

    if (this.config.dryRun) {
      console.log(
        `[DRY RUN] UPLOAD ${path} <- ${localFilePath} (${buffer.length} bytes)`,
      );
      return { id: `dry-run-upload`, dryRun: true };
    }

    const res = await fetch(`${this.base}/${path}`, {
      method: "POST",
      body: form,
    });
    return this.handle(res, context);
  }
}
