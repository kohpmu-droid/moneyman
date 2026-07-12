import type { MetaClient } from "./client.js";
import type { Config } from "../config.js";
import type { AdBrief, Targeting } from "../types.js";

const GENDER_CODE = { male: 1, female: 2 } as const;

/** Creates the campaign (objective = lead generation). Always starts PAUSED unless activated. */
export async function createCampaign(
  client: MetaClient,
  config: Config,
  brief: AdBrief,
): Promise<string> {
  const res = await client.post(
    `act_${config.adAccountId}/campaigns`,
    {
      name: brief.campaignName,
      objective: "OUTCOME_LEADS",
      status: config.activate ? "ACTIVE" : "PAUSED",
      special_ad_categories: [],
    },
    "createCampaign",
  );
  return res.id;
}

function buildTargeting(t: Targeting = {}): Record<string, unknown> {
  // Radius targeting (custom_locations) takes precedence over whole-country.
  const geo_locations = t.customLocations?.length
    ? {
        custom_locations: t.customLocations.map((loc) => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
          radius: loc.radiusKm,
          distance_unit: "kilometer",
        })),
      }
    : { countries: t.countries ?? ["IL"] };

  const targeting: Record<string, unknown> = {
    geo_locations,
    age_min: t.ageMin ?? 18,
    age_max: t.ageMax ?? 65,
  };
  if (t.genders?.length) {
    targeting.genders = t.genders.map((g) => GENDER_CODE[g]);
  }
  if (t.interests?.length) {
    targeting.flexible_spec = [
      { interests: t.interests.map((i) => ({ id: i.id, name: i.name })) },
    ];
  }
  return targeting;
}

/** Creates the ad set: budget, schedule, optimization for lead gen. */
export async function createAdSet(
  client: MetaClient,
  config: Config,
  brief: AdBrief,
  campaignId: string,
): Promise<string> {
  // Meta expects the budget in minor units (agorot/cents).
  const dailyBudgetMinor = Math.round(brief.dailyBudget * 100);

  const params: Record<string, unknown> = {
    name: `${brief.campaignName} – ad set`,
    campaign_id: campaignId,
    daily_budget: dailyBudgetMinor,
    billing_event: "IMPRESSIONS",
    optimization_goal: "LEAD_GENERATION",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    // Instant forms open inside the ad rather than sending to a website.
    destination_type: "ON_AD",
    promoted_object: { page_id: config.pageId },
    targeting: buildTargeting(brief.targeting),
    status: config.activate ? "ACTIVE" : "PAUSED",
  };
  // Auto-stop the campaign at the promo's end (no manual pause needed).
  if (brief.endDate) params.end_time = brief.endDate;

  const res = await client.post(
    `act_${config.adAccountId}/adsets`,
    params,
    "createAdSet",
  );
  return res.id;
}

/** Builds the ad creative that references the media + lead form. */
export async function createAdCreative(
  client: MetaClient,
  config: Config,
  brief: AdBrief,
  mediaHandle: string,
  leadFormId: string,
): Promise<string> {
  const link = brief.link ?? `https://facebook.com/${config.pageId}`;
  const callToAction = {
    type: brief.copy.callToAction ?? "SIGN_UP",
    value: { lead_gen_form_id: leadFormId, link },
  };

  const objectStorySpec: Record<string, unknown> = { page_id: config.pageId };
  if (config.instagramActorId) {
    objectStorySpec.instagram_actor_id = config.instagramActorId;
  }

  if (brief.creative.type === "image") {
    objectStorySpec.link_data = {
      message: brief.copy.primaryText,
      link,
      name: brief.copy.headline,
      description: brief.copy.description,
      image_hash: mediaHandle,
      call_to_action: callToAction,
    };
  } else {
    objectStorySpec.video_data = {
      video_id: mediaHandle,
      message: brief.copy.primaryText,
      title: brief.copy.headline,
      link_description: brief.copy.description,
      call_to_action: callToAction,
    };
  }

  const res = await client.post(
    `act_${config.adAccountId}/adcreatives`,
    {
      name: `${brief.campaignName} – creative`,
      object_story_spec: objectStorySpec,
    },
    "createAdCreative",
  );
  return res.id;
}

/** Creates the final ad, wiring the ad set and creative together. */
export async function createAd(
  client: MetaClient,
  config: Config,
  brief: AdBrief,
  adSetId: string,
  creativeId: string,
): Promise<string> {
  const res = await client.post(
    `act_${config.adAccountId}/ads`,
    {
      name: `${brief.campaignName} – ad`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: config.activate ? "ACTIVE" : "PAUSED",
    },
    "createAd",
  );
  return res.id;
}
