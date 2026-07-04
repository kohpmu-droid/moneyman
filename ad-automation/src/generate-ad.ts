#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { generateBriefContent } from "./generate/brief.js";
import { renderPoster } from "./generate/image.js";
import type { AdBrief } from "./types.js";

interface Args {
  request: string;
  budget: number;
  out: string;
  privacy: string;
  makeImage: boolean;
  videoPath?: string;
}

function parseArgs(argv: string[]): Args {
  const words: string[] = [];
  let budget = 50;
  let out = "./out";
  let privacy =
    process.env.PRIVACY_POLICY_URL || "https://REPLACE-WITH-YOUR-PRIVACY-POLICY";
  let makeImage = true;
  let videoPath: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith("--budget=")) budget = Number(arg.slice(9));
    else if (arg.startsWith("--out=")) out = arg.slice(6);
    else if (arg.startsWith("--privacy=")) privacy = arg.slice(10);
    else if (arg === "--no-image") makeImage = false;
    else if (arg.startsWith("--video=")) {
      videoPath = arg.slice(8);
      makeImage = false;
    } else words.push(arg);
  }
  return { request: words.join(" ").trim(), budget, out, privacy, makeImage, videoPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.request) {
    console.error(
      'Usage: generate-ad "<בקשה חופשית בעברית>" [--budget=50] [--out=./out] [--privacy=URL] [--video=clip.mp4] [--no-image]',
    );
    console.error(
      'Example: npm run generate -- "מודעה למבצע קיץ לחנות תכשיטים, נשים 30-45" --budget=60',
    );
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY. Add it to your environment / .env.");
    process.exit(1);
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  console.log("✍️  Writing the ad from your request…");
  const content = await generateBriefContent({ apiKey, model }, args.request);

  await mkdir(args.out, { recursive: true });

  // Decide on the creative.
  let creative: AdBrief["creative"];
  if (args.videoPath) {
    creative = { type: "video", path: args.videoPath };
  } else if (args.makeImage) {
    console.log("🎨 Rendering the ad image…");
    const pngPath = join(args.out, "creative.png");
    const result = await renderPoster(content, pngPath);
    creative = { type: "image", path: result.path };
    if (!result.rasterized) {
      console.log(
        `   Playwright not installed — wrote HTML poster to ${result.path}.\n` +
          "   Install playwright, or open the HTML and export a 1080x1350 image, then set creative.path.",
      );
    }
  } else {
    creative = { type: "image", path: "./REPLACE-WITH-YOUR-IMAGE.jpg" };
  }

  const brief: AdBrief = {
    campaignName: content.campaignName,
    dailyBudget: args.budget,
    creative,
    copy: content.copy,
    targeting: content.targeting,
    leadForm: {
      name: content.leadForm.name,
      intro: content.leadForm.intro,
      questions: content.leadForm.questions,
      privacyPolicyUrl: args.privacy,
      thankYou: content.leadForm.thankYou,
    },
  };

  const briefPath = join(args.out, "brief.json");
  await mkdir(dirname(briefPath), { recursive: true });
  await writeFile(briefPath, JSON.stringify(brief, null, 2) + "\n", "utf8");

  console.log(`\n✅ Brief written to ${briefPath}`);
  console.log("\nPreview:");
  console.log(`  כותרת:  ${content.copy.headline}`);
  console.log(`  טקסט:   ${content.copy.primaryText}`);
  console.log(`  קהל:    ${content.targeting.countries.join(",")} | גיל ${content.targeting.ageMin}-${content.targeting.ageMax}${content.targeting.genders.length ? ` | ${content.targeting.genders.join(",")}` : ""}`);

  if (brief.leadForm.privacyPolicyUrl.includes("REPLACE")) {
    console.log("\n⚠️  Set a real privacyPolicyUrl (Meta requires it) — pass --privacy=URL or edit the brief.");
  }
  console.log(`\nNext: review ${briefPath}, then create it (PAUSED) with:`);
  console.log(`  npm run create:built -- ${briefPath}`);
}

main().catch((err) => {
  console.error("\n✖ Failed:", err.message);
  process.exit(1);
});
