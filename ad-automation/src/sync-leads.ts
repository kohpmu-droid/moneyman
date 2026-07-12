#!/usr/bin/env node
import { loadLeadSyncConfig } from "./config.js";
import { MetaClient } from "./meta/client.js";
import { getLeads, listLeadForms, type Lead } from "./meta/leads.js";
import { SheetsClient } from "./google/sheets.js";
import { loadWhatsAppConfig, notifyNewLeads } from "./whatsapp/notify.js";

/**
 * Pulls leads from your Meta lead form(s) and appends new ones to a Google
 * Sheet. Runs are idempotent: leads whose id is already in the sheet are
 * skipped, so it is safe to schedule this (e.g. via cron) as often as you like.
 *
 * Column layout (also written as the header row on first run):
 *   Received | Lead ID | Form | Full name | Email | Phone | All fields
 */

const HEADER = [
  "Received",
  "Lead ID",
  "Form",
  "Full name",
  "Email",
  "Phone",
  "All fields",
];

function leadToRow(lead: Lead, formName: string): string[] {
  const f = lead.fields;
  const fullName =
    f.full_name ?? [f.first_name, f.last_name].filter(Boolean).join(" ") ?? "";
  return [
    lead.createdTime,
    lead.id,
    formName,
    fullName,
    f.email ?? "",
    f.phone_number ?? f.phone ?? "",
    JSON.stringify(f),
  ];
}

async function main() {
  const config = loadLeadSyncConfig();
  const meta = new MetaClient({
    accessToken: config.accessToken,
    graphVersion: config.graphVersion,
    dryRun: false,
  });

  const sheets = await SheetsClient.create({
    keyJson: config.serviceAccountKey,
    keyFile: config.serviceAccountKeyFile,
    spreadsheetId: config.sheetId,
    tab: config.sheetTab,
  });

  // Determine which forms to sync.
  let forms: Array<{ id: string; name: string }>;
  if (config.formIds.length) {
    const all = await listLeadForms(meta, config.pageId);
    const byId = new Map(all.map((form) => [form.id, form.name]));
    forms = config.formIds.map((id) => ({ id, name: byId.get(id) ?? id }));
  } else {
    forms = await listLeadForms(meta, config.pageId);
  }
  console.log(`Found ${forms.length} form(s) to check.`);

  // Ensure the header row exists (first run on an empty tab).
  if (await sheets.isEmpty()) {
    await sheets.appendRows([HEADER]);
    console.log("Wrote header row.");
  }

  // De-dup against lead ids already in column B.
  const existingIds = new Set(
    (await sheets.readColumn("B2:B")).filter(Boolean),
  );

  const freshLeads: Array<{ lead: Lead; formName: string }> = [];
  for (const form of forms) {
    const leads = await getLeads(meta, form.id);
    const fresh = leads.filter((lead) => !existingIds.has(lead.id));
    for (const lead of fresh) {
      freshLeads.push({ lead, formName: form.name });
      existingIds.add(lead.id);
    }
    console.log(`  ${form.name}: ${leads.length} total, ${fresh.length} new`);
  }

  // Oldest first, so the sheet reads chronologically.
  freshLeads.reverse();
  await sheets.appendRows(
    freshLeads.map(({ lead, formName }) => leadToRow(lead, formName)),
  );
  console.log(`\nAdded ${freshLeads.length} new lead(s) to the sheet.`);

  // Best-effort WhatsApp notifications (only if configured).
  const wa = loadWhatsAppConfig();
  if (wa && freshLeads.length) {
    const sent = await notifyNewLeads(wa, freshLeads);
    console.log(`Sent ${sent} WhatsApp notification(s).`);
  } else if (!wa) {
    console.log("WhatsApp notifications disabled (not configured).");
  }
}

main().catch((err) => {
  console.error("\n✖ Lead sync failed:", err.message);
  process.exit(1);
});
