/**
 * Types describing an ad "brief" — the single input you (or Claude) provide,
 * from which the whole Facebook/Instagram lead-ad is built.
 */

export type CreativeType = "image" | "video";

/** Meta call-to-action button types that make sense for a lead ad. */
export type CallToActionType =
  | "SIGN_UP"
  | "LEARN_MORE"
  | "GET_QUOTE"
  | "SUBSCRIBE"
  | "APPLY_NOW"
  | "BOOK_TRAVEL"
  | "CONTACT_US"
  | "DOWNLOAD";

/** Lead-form question types (a subset of Meta's supported prefilled fields). */
export type LeadQuestionType =
  | "FULL_NAME"
  | "FIRST_NAME"
  | "LAST_NAME"
  | "EMAIL"
  | "PHONE"
  | "CITY"
  | "COMPANY_NAME";

export interface Creative {
  type: CreativeType;
  /** Local path to the image or video file. */
  path: string;
  /** Optional thumbnail image path (recommended for videos). */
  thumbnailPath?: string;
}

export interface AdCopy {
  /** The main body text shown above the creative. */
  primaryText: string;
  /** Short bold headline shown under the creative. */
  headline: string;
  /** Optional secondary line under the headline. */
  description?: string;
  /** Button label; defaults to SIGN_UP for lead ads. */
  callToAction?: CallToActionType;
}

export interface Targeting {
  /** ISO country codes, e.g. ["IL"]. Defaults to ["IL"]. */
  countries?: string[];
  ageMin?: number;
  ageMax?: number;
  /** Restrict to a gender; omit for all. */
  genders?: Array<"male" | "female">;
  /**
   * Detailed-targeting interests. Each needs Meta's interest `id`.
   * Look them up with the targeting-search endpoint (see README).
   */
  interests?: Array<{ id: string; name?: string }>;
  /**
   * Radius targeting around specific points (e.g. city centres). When set,
   * these replace the country targeting so the ad runs only near these spots.
   */
  customLocations?: Array<{
    name?: string;
    latitude: number;
    longitude: number;
    radiusKm: number;
  }>;
}

export interface LeadFormSpec {
  name: string;
  /** Intro "context card" shown before the form fields. */
  intro?: { headline: string; description: string; buttonText?: string };
  /** Which fields to collect. Defaults to FULL_NAME + EMAIL + PHONE. */
  questions?: LeadQuestionType[];
  /** Required by Meta — a public URL to your privacy policy. */
  privacyPolicyUrl: string;
  privacyPolicyLinkText?: string;
  /** Message shown after the user submits. */
  thankYou?: { title: string; body: string; websiteUrl?: string };
}

export interface AdBrief {
  /** Human-friendly campaign name. */
  campaignName: string;
  /** Daily budget in your account currency (e.g. shekels), NOT minor units. */
  dailyBudget: number;
  creative: Creative;
  copy: AdCopy;
  targeting?: Targeting;
  leadForm: LeadFormSpec;
  /**
   * Destination link shown on the ad (usually your page / landing page).
   * Defaults to the page URL derived from META_PAGE_ID.
   */
  link?: string;
  /**
   * Optional ISO-8601 end time (with timezone). When set, the ad set stops
   * automatically at this time — e.g. "2026-07-31T23:59:00+03:00".
   */
  endDate?: string;
}

export interface PipelineResult {
  status: "paused" | "active";
  campaignId: string;
  adSetId: string;
  adId: string;
  creativeId: string;
  leadFormId: string;
  mediaHandle: string; // image hash or video id
  adsManagerUrl: string;
}
