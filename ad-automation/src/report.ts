#!/usr/bin/env node
import { MetaClient } from "./meta/client.js";
import { getCampaignInsights, type Insights } from "./meta/insights.js";

/**
 * Prints a daily performance report for a campaign — today's numbers plus the
 * running total since it started. Meant to be run on a schedule (or on demand)
 * to see spend, reach, clicks, leads, and cost-per-lead.
 *
 * Usage: report <campaign_id>   (or set CAMPAIGN_ID in the environment)
 */

function line(label: string, i: Insights): string {
  const cpl = i.costPerLead === null ? "—" : `₪${i.costPerLead.toFixed(1)}`;
  return (
    `${label}: הוצאה ₪${i.spend.toFixed(2)} · חשיפות ${i.impressions} · ` +
    `טווח ${i.reach} · קליקים ${i.clicks} · לידים ${i.leads} · עלות לליד ${cpl}`
  );
}

async function main() {
  const campaignId = process.argv[2] || process.env.CAMPAIGN_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!campaignId || !accessToken) {
    console.error(
      "Usage: report <campaign_id>  (needs META_ACCESS_TOKEN; CAMPAIGN_ID env also works)",
    );
    process.exit(1);
  }

  const client = new MetaClient({
    accessToken,
    graphVersion: process.env.GRAPH_API_VERSION || "v21.0",
    dryRun: false,
  });

  const [today, total] = await Promise.all([
    getCampaignInsights(client, campaignId, "today"),
    getCampaignInsights(client, campaignId, "maximum"),
  ]);

  console.log("📊 דוח ביצועים — קמפיין " + campaignId);
  console.log(line("היום", today));
  console.log(line("מצטבר", total));
}

main().catch((err) => {
  console.error("\n✖ Report failed:", err.message);
  process.exit(1);
});
