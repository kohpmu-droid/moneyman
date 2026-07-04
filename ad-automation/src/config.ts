/**
 * Runtime configuration, read from environment variables.
 * Copy `.env.example` to `.env` and fill it in (see README).
 */

export interface Config {
  accessToken: string;
  /** Ad-account id WITHOUT the `act_` prefix. */
  adAccountId: string;
  pageId: string;
  /** Optional — needed to run the ad on an Instagram account. */
  instagramActorId?: string;
  graphVersion: string;
  /**
   * When false (the default) every object is created PAUSED so nothing spends
   * money until you flip it on manually in Ads Manager.
   */
  activate: boolean;
  /** When true, prints what WOULD be sent and calls nothing. */
  dryRun: boolean;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See ad-automation/README.md`,
    );
  }
  return value;
}

function boolEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function loadConfig(): Config {
  return {
    accessToken: required("META_ACCESS_TOKEN"),
    adAccountId: required("META_AD_ACCOUNT_ID").replace(/^act_/, ""),
    pageId: required("META_PAGE_ID"),
    instagramActorId: process.env.META_INSTAGRAM_ACTOR_ID || undefined,
    graphVersion: process.env.GRAPH_API_VERSION || "v21.0",
    // Safety: activation is opt-in and requires an explicit flag.
    activate: boolEnv("ACTIVATE_ADS", false),
    dryRun: boolEnv("DRY_RUN", false),
  };
}
