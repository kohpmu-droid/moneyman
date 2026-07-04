import { writeFile } from "node:fs/promises";
import type { BriefContent } from "./brief.js";

/** Escapes text for safe insertion into HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CTA_LABEL: Record<string, string> = {
  SIGN_UP: "להרשמה",
  LEARN_MORE: "מידע נוסף",
  GET_QUOTE: "לקבלת הצעה",
  SUBSCRIBE: "להצטרפות",
  APPLY_NOW: "להגשת מועמדות",
  CONTACT_US: "צרו קשר",
  DOWNLOAD: "להורדה",
  BOOK_TRAVEL: "להזמנה",
};

/** Builds the self-contained HTML for a 1080x1350 vertical ad poster. */
export function buildPosterHtml(brief: BriefContent): string {
  const { background, text, accent } = brief.imageColors;
  const cta = CTA_LABEL[brief.copy.callToAction] ?? "לפרטים";
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1350px; }
  body {
    background: ${esc(background)};
    color: ${esc(text)};
    font-family: "Heebo", "Arial Hebrew", Arial, sans-serif;
    display: flex; flex-direction: column; justify-content: center;
    padding: 110px 90px; position: relative;
  }
  .accent-bar { position: absolute; top: 0; right: 0; width: 100%; height: 22px; background: ${esc(accent)}; }
  .kicker { color: ${esc(accent)}; font-size: 40px; font-weight: 700; margin-bottom: 28px; letter-spacing: 1px; }
  .headline { font-size: 108px; font-weight: 900; line-height: 1.05; margin-bottom: 40px; }
  .primary { font-size: 46px; font-weight: 400; line-height: 1.4; opacity: 0.92; }
  .cta {
    margin-top: 70px; align-self: flex-start; background: ${esc(accent)}; color: ${esc(background)};
    font-size: 44px; font-weight: 800; padding: 30px 64px; border-radius: 999px;
  }
</style></head><body>
  <div class="accent-bar"></div>
  <div class="kicker">${esc(brief.copy.description)}</div>
  <div class="headline">${esc(brief.copy.headline)}</div>
  <div class="primary">${esc(brief.copy.primaryText)}</div>
  <div class="cta">${esc(cta)}</div>
</body></html>`;
}

/**
 * Renders the poster HTML to a PNG using a headless Chromium.
 *
 * Playwright is loaded dynamically and is optional — if it isn't installed we
 * fall back to writing the HTML file so you can screenshot / convert it yourself.
 * Returns the path actually written.
 */
export async function renderPoster(
  brief: BriefContent,
  pngPath: string,
): Promise<{ path: string; rasterized: boolean }> {
  const html = buildPosterHtml(brief);

  let chromium: any;
  try {
    // Indirect specifier so the optional dep isn't a hard compile-time import.
    const mod: any = await import(/* @vite-ignore */ "playwright" as string);
    chromium = mod.chromium;
  } catch {
    const htmlPath = pngPath.replace(/\.png$/i, "") + ".html";
    await writeFile(htmlPath, html, "utf8");
    return { path: htmlPath, rasterized: false };
  }

  // Use the pre-installed browser when a custom path is configured.
  const execPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(
    execPath ? { executablePath: execPath } : {},
  );
  try {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1350 },
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.screenshot({ path: pngPath });
    return { path: pngPath, rasterized: true };
  } finally {
    await browser.close();
  }
}
