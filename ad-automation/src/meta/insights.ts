import type { MetaClient } from "./client.js";

export interface Insights {
  dateStart: string;
  dateStop: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  costPerLead: number | null;
}

// Meta reports leads under several action_type names depending on the flow.
const LEAD_ACTION_TYPES = new Set([
  "lead",
  "leadgen_grouped",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
]);

function sumLeads(
  actions: Array<{ action_type: string; value: string }> = [],
): number {
  return actions
    .filter((a) => LEAD_ACTION_TYPES.has(a.action_type))
    .reduce((total, a) => total + Number(a.value || 0), 0);
}

/**
 * Fetches performance for a campaign over a date preset ("today", "yesterday",
 * "maximum", …). Returns zeros when there's no data yet (e.g. before delivery).
 */
export async function getCampaignInsights(
  client: MetaClient,
  campaignId: string,
  datePreset = "today",
): Promise<Insights> {
  const res = await client.get(
    `${campaignId}/insights`,
    {
      fields: "spend,impressions,reach,clicks,actions,date_start,date_stop",
      date_preset: datePreset,
    },
    "getCampaignInsights",
  );

  const row = res.data?.[0];
  if (!row) {
    return {
      dateStart: "",
      dateStop: "",
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      leads: 0,
      costPerLead: null,
    };
  }

  const spend = Number(row.spend || 0);
  const leads = sumLeads(row.actions);
  return {
    dateStart: row.date_start,
    dateStop: row.date_stop,
    spend,
    impressions: Number(row.impressions || 0),
    reach: Number(row.reach || 0),
    clicks: Number(row.clicks || 0),
    leads,
    costPerLead: leads > 0 ? spend / leads : null,
  };
}
