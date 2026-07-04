import type { Config } from "./config.js";
import type { AdBrief, PipelineResult } from "./types.js";
import { MetaClient } from "./meta/client.js";
import { uploadImage, uploadVideo } from "./meta/creative.js";
import { createLeadForm } from "./meta/leadForm.js";
import {
  createAd,
  createAdCreative,
  createAdSet,
  createCampaign,
} from "./meta/campaign.js";

function log(step: string) {
  console.log(`→ ${step}`);
}

/**
 * Turns a single brief into a complete Facebook/Instagram lead ad.
 *
 * Order matters: media & lead form first (they're referenced by the creative),
 * then campaign → ad set → creative → ad.
 *
 * Everything is created PAUSED unless ACTIVATE_ADS=true, so no budget is spent
 * until you review and enable it in Ads Manager.
 */
export async function runPipeline(
  config: Config,
  brief: AdBrief,
): Promise<PipelineResult> {
  const client = new MetaClient(config);

  log(`Uploading ${brief.creative.type}: ${brief.creative.path}`);
  const mediaHandle =
    brief.creative.type === "image"
      ? await uploadImage(client, config.adAccountId, brief.creative.path)
      : await uploadVideo(client, config.adAccountId, brief.creative.path);

  log("Creating lead form");
  const leadFormId = await createLeadForm(client, config.pageId, brief.leadForm);

  log("Creating campaign");
  const campaignId = await createCampaign(client, config, brief);

  log("Creating ad set (budget + targeting)");
  const adSetId = await createAdSet(client, config, brief, campaignId);

  log("Creating ad creative");
  const creativeId = await createAdCreative(
    client,
    config,
    brief,
    mediaHandle,
    leadFormId,
  );

  log("Creating ad");
  const adId = await createAd(client, config, brief, adSetId, creativeId);

  const status = config.activate ? "active" : "paused";
  return {
    status,
    campaignId,
    adSetId,
    adId,
    creativeId,
    leadFormId,
    mediaHandle,
    adsManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${config.adAccountId}&selected_campaign_ids=${campaignId}`,
  };
}
