/**
 * Minimal client for the Anthropic Messages API, using Node's built-in fetch.
 * Uses structured outputs (output_config.format) so the model returns JSON that
 * already matches our schema — no fragile parsing of prose.
 */

export interface AnthropicOptions {
  apiKey: string;
  model: string;
}

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Sends a single request and returns the parsed JSON matching `schema`.
 * `schema` must be a JSON Schema object with additionalProperties:false.
 */
export async function generateJson<T>(
  opts: AnthropicOptions,
  system: string,
  userMessage: string,
  schema: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: { type: "json_schema", schema } },
    }),
  });

  const body: any = await res.json();
  if (!res.ok || body?.error) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Anthropic API error: ${msg}`);
  }
  if (body.stop_reason === "refusal") {
    throw new Error("The request was declined by the model's safety system.");
  }

  const textBlock = (body.content ?? []).find((b: any) => b.type === "text");
  if (!textBlock?.text) {
    throw new Error(`Unexpected response shape: ${JSON.stringify(body)}`);
  }
  return JSON.parse(textBlock.text) as T;
}
