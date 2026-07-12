import type { Lead } from "../meta/leads.js";

/**
 * Sends a WhatsApp notification for each new lead, via Meta's WhatsApp
 * Business Cloud API (the same Graph API host as the rest of the tool).
 *
 * Two modes:
 *  - "template" (default, recommended): sends a pre-approved message template,
 *    which is the ONLY way to message yourself outside the 24-hour window.
 *  - "text": free-form text — only delivered if you (the recipient) messaged
 *    the business number within the last 24 hours. Handy for a quick test.
 */

export interface WhatsAppConfig {
  accessToken: string;
  /** The WhatsApp phone-number id (from WhatsApp > API setup). */
  phoneNumberId: string;
  /** Recipient in international format, digits only, e.g. 972501234567. */
  to: string;
  graphVersion: string;
  mode: "template" | "text";
  templateName: string;
  templateLang: string;
  /** Safety cap so a first-run backlog can't blast dozens of messages. */
  maxPerRun: number;
}

/** Returns null (notifications disabled) when the required env vars are absent. */
export function loadWhatsAppConfig(): WhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_TO;
  const accessToken =
    process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  if (!phoneNumberId || !to || !accessToken) return null;

  return {
    accessToken,
    phoneNumberId,
    to: to.replace(/[^\d]/g, ""),
    graphVersion: process.env.GRAPH_API_VERSION || "v21.0",
    mode: process.env.WHATSAPP_MODE === "text" ? "text" : "template",
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || "new_lead",
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG || "he",
    maxPerRun: Number(process.env.WHATSAPP_MAX_PER_RUN) || 20,
  };
}

function leadFields(lead: Lead): {
  name: string;
  phone: string;
  email: string;
} {
  const f = lead.fields;
  return {
    name:
      f.full_name ??
      [f.first_name, f.last_name].filter(Boolean).join(" ") ??
      "—",
    phone: f.phone_number ?? f.phone ?? "—",
    email: f.email ?? "—",
  };
}

/** Sends one notification. Throws on API error so the caller can log it. */
export async function sendLeadNotification(
  cfg: WhatsAppConfig,
  lead: Lead,
  formName: string,
): Promise<void> {
  const { name, phone, email } = leadFields(lead);
  const url = `https://graph.facebook.com/${cfg.graphVersion}/${cfg.phoneNumberId}/messages`;

  const payload =
    cfg.mode === "text"
      ? {
          messaging_product: "whatsapp",
          to: cfg.to,
          type: "text",
          text: {
            body: `🔔 ליד חדש!\nשם: ${name}\nטלפון: ${phone}\nאימייל: ${email}\nטופס: ${formName}`,
          },
        }
      : {
          messaging_product: "whatsapp",
          to: cfg.to,
          type: "template",
          template: {
            name: cfg.templateName,
            language: { code: cfg.templateLang },
            components: [
              {
                type: "body",
                // Template body variables {{1}}=name {{2}}=phone {{3}}=email
                parameters: [
                  { type: "text", text: name },
                  { type: "text", text: phone },
                  { type: "text", text: email },
                ],
              },
            ],
          },
        };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) {
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
}

/**
 * Best-effort notification for a batch of new leads. Never throws — a WhatsApp
 * failure must not break the (already-completed) sheet sync. Returns how many
 * were sent.
 */
export async function notifyNewLeads(
  cfg: WhatsAppConfig,
  leads: Array<{ lead: Lead; formName: string }>,
): Promise<number> {
  if (leads.length > cfg.maxPerRun) {
    console.log(
      `  WhatsApp: ${leads.length} new leads exceeds cap (${cfg.maxPerRun}); notifying the first ${cfg.maxPerRun} only.`,
    );
  }
  let sent = 0;
  for (const { lead, formName } of leads.slice(0, cfg.maxPerRun)) {
    try {
      await sendLeadNotification(cfg, lead, formName);
      sent++;
    } catch (err: any) {
      console.log(
        `  WhatsApp notification failed for ${lead.id}: ${err.message}`,
      );
    }
  }
  return sent;
}
