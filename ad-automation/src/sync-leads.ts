#!/usr/bin/env node
import { loadLeadSyncConfig } from "./config.js";
import { MetaClient } from "./meta/client.js";
import { getLeads, listLeadForms, type Lead } from "./meta/leads.js";
import { SheetsClient } from "./google/sheets.js";

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
    f.full_name ??
    [f.first_name, f.last_name].filter(Boolean).join(" ") ??
    "";
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

  const newRows: string[][] = [];
  for (const form of forms) {
    const leads = await getLeads(meta, form.id);
    const fresh = leads.filter((lead) => !existingIds.has(lead.id));
    for (const lead of fresh) {
      newRows.push(leadToRow(lead, form.name));
      existingIds.add(lead.id);
    }
    console.log(
      `  ${form.name}: ${leads.length} total, ${fresh.length} new`,
    );
  }

  // Oldest first, so the sheet reads chronologically.
  newRows.reverse();
  await sheets.appendRows(newRows);

  console.log(`\nDone. Added ${newRows.length} new lead(s) to the sheet.`);
}

main().catch((err) => {
  console.error("\n✖ Lead sync failed:", err.message);
  process.exit(1);
});
