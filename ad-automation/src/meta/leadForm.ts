import type { MetaClient } from "./client.js";
import type { LeadFormSpec } from "../types.js";

/**
 * Creates a Meta "Instant Form" (lead-gen form) on the page and returns
 * its id, to be attached to the ad creative's call-to-action.
 *
 * Requires the `leads_retrieval` / `pages_manage_ads` permissions and a page
 * access token (see README).
 */
export async function createLeadForm(
  client: MetaClient,
  pageId: string,
  spec: LeadFormSpec,
): Promise<string> {
  const questionTypes = spec.questions ?? ["FULL_NAME", "EMAIL", "PHONE"];
  const questions = questionTypes.map((type) => ({ type }));

  const params: Record<string, unknown> = {
    name: spec.name,
    questions,
    privacy_policy: {
      url: spec.privacyPolicyUrl,
      link_text: spec.privacyPolicyLinkText ?? "מדיניות פרטיות",
    },
    // Ensures leads are treated as a fresh opt-in each time.
    follow_up_action_url: spec.thankYou?.websiteUrl,
  };

  if (spec.intro) {
    params.context_card = {
      title: spec.intro.headline,
      content: [spec.intro.description],
      style: "PARAGRAPH_STYLE",
      button_text: spec.intro.buttonText ?? "המשך",
    };
  }

  if (spec.thankYou) {
    params.thank_you_page = {
      title: spec.thankYou.title,
      body: spec.thankYou.body,
      button_type: spec.thankYou.websiteUrl ? "VIEW_WEBSITE" : "NONE",
      website_url: spec.thankYou.websiteUrl,
    };
  }

  const res = await client.post(
    `${pageId}/leadgen_forms`,
    params,
    "createLeadForm",
  );
  return res.id;
}
