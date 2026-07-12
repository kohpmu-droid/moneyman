#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { loadConfig } from "./config.js";
import { runPipeline } from "./pipeline.js";
import type { AdBrief } from "./types.js";

function validateBrief(brief: AdBrief): string[] {
  const errors: string[] = [];
  if (!brief.campaignName) errors.push("campaignName is required");
  if (!brief.dailyBudget || brief.dailyBudget <= 0)
    errors.push("dailyBudget must be a positive number");
  if (!brief.creative?.path) errors.push("creative.path is required");
  if (!brief.creative?.type) errors.push("creative.type is required");
  if (!brief.copy?.primaryText) errors.push("copy.primaryText is required");
  if (!brief.copy?.headline) errors.push("copy.headline is required");
  if (!brief.leadForm?.name) errors.push("leadForm.name is required");
  if (!brief.leadForm?.privacyPolicyUrl)
    errors.push("leadForm.privacyPolicyUrl is required (Meta mandates it)");
  return errors;
}

async function main() {
  const briefPath = process.argv[2];
  if (!briefPath) {
    console.error("Usage: ad-automation <path-to-brief.json>");
    console.error("Example: npm run create -- examples/brief.example.json");
    process.exit(1);
  }

  const brief: AdBrief = JSON.parse(await readFile(briefPath, "utf8"));
  const errors = validateBrief(brief);
  if (errors.length) {
    console.error("Invalid brief:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const config = loadConfig();

  console.log(
    config.dryRun
      ? "🧪 DRY RUN — nothing will be sent to Meta.\n"
      : config.activate
        ? "⚠️  ACTIVATE_ADS=true — the ad will go LIVE and spend budget once Meta approves it.\n"
        : "✅ Safe mode — everything is created PAUSED. Review it in Ads Manager before enabling.\n",
  );

  const result = await runPipeline(config, brief);

  console.log("\nDone. Summary:");
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "paused" && !config.dryRun) {
    console.log(`\nReview & enable here:\n${result.adsManagerUrl}`);
  }
}

main().catch((err) => {
  console.error("\n✖ Failed:", err.message);
  process.exit(1);
});
