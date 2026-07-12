import type { MetaClient } from "./client.js";

export interface Lead {
  id: string;
  createdTime: string;
  formId: string;
  /** Flattened field name -> value, e.g. { full_name, email, phone_number }. */
  fields: Record<string, string>;
}

/** Discovers all lead forms on the page (id + name). */
export async function listLeadForms(
  client: MetaClient,
  pageId: string,
): Promise<Array<{ id: string; name: string }>> {
  const res = await client.get(
    `${pageId}/leadgen_forms`,
    { fields: "id,name", limit: "200" },
    "listLeadForms",
  );
  return res.data ?? [];
}

/**
 * Fetches leads for a single form, newest first. Handles pagination and,
 * optionally, only returns leads created at/after `sinceUnix` (seconds).
 */
export async function getLeads(
  client: MetaClient,
  formId: string,
  sinceUnix?: number,
): Promise<Lead[]> {
  const leads: Lead[] = [];
  const params: Record<string, string> = {
    fields: "id,created_time,field_data",
    limit: "100",
  };
  if (sinceUnix)
    params.filtering = JSON.stringify([
      { field: "time_created", operator: "GREATER_THAN", value: sinceUnix },
    ]);

  let path: string | null = `${formId}/leads`;
  let query: Record<string, string> | undefined = params;

  while (path) {
    const res: any = query
      ? await client.get(path, query, "getLeads")
      : await client.getAbsolute(path, "getLeads");
    for (const row of res.data ?? []) {
      const fields: Record<string, string> = {};
      for (const item of row.field_data ?? []) {
        fields[item.name] = (item.values ?? []).join(", ");
      }
      leads.push({
        id: row.id,
        createdTime: row.created_time,
        formId,
        fields,
      });
    }
    // Follow cursor pagination via the absolute `next` URL.
    path = res.paging?.next ?? null;
    query = undefined;
  }

  return leads;
}
