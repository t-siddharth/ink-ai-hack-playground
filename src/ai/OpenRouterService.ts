// OpenRouter service - client for LLM inference via OpenRouter
//
// WARNING: The API key (INK_OPENROUTER_API_KEY) is embedded into the client
// bundle at build time and visible in browser DevTools. Only use a scoped,
// low-privilege, rate-limited key. For production, route calls through a
// backend proxy that holds the secret server-side.

import { OpenRouter } from '@openrouter/sdk';
import { UnauthorizedResponseError } from '@openrouter/sdk/models/errors';

let openRouterInstance: OpenRouter | null = null;
let openRouterInstanceKey: string | undefined;

/** Trim and strip accidental `Bearer ` from pasted keys (fixes OpenRouter 401 "User not found"). */
export function normalizeOpenRouterApiKey(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  let k = raw.trim();
  if (!k) return undefined;
  if (k.toLowerCase().startsWith('bearer ')) {
    k = k.slice(7).trim();
  }
  // Strip wrapping quotes from some .env setups
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  return k.length > 0 ? k : undefined;
}

function getOpenRouterApiKey(): string | undefined {
  return normalizeOpenRouterApiKey(import.meta.env.INK_OPENROUTER_API_KEY);
}

function getOpenRouter(): OpenRouter {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error(
      'INK_OPENROUTER_API_KEY is not set. ' +
        'Add it to .env (or use OPENROUTER_API_KEY — see .env.example), then restart npm run dev.',
    );
  }

  if (openRouterInstance && openRouterInstanceKey !== apiKey) {
    openRouterInstance = null;
  }

  if (!openRouterInstance) {
    openRouterInstanceKey = apiKey;
    openRouterInstance = new OpenRouter({
      apiKey,
      httpReferer: import.meta.env.INK_OPENROUTER_SITE_URL || window.location.origin,
      xTitle: import.meta.env.INK_OPENROUTER_SITE_NAME || 'Ink Playground',
    });
  }
  return openRouterInstance;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
}

export interface JsonSchema {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** JSON mode: 'json' for unstructured JSON, or a json_schema for structured output. */
  responseFormat?: 'json' | { type: 'json_schema'; jsonSchema: JsonSchema };
}

function getDefaultModel(): string {
  const raw = import.meta.env.INK_OPENROUTER_MODEL;
  if (typeof raw === 'string') {
    const m = raw.trim();
    if (m) return m;
  }
  return 'google/gemini-2.5-flash';
}

/**
 * Send a chat completion request via OpenRouter.
 */
const OPENROUTER_AUTH_HINT =
  'OpenRouter returned 401 ("User not found" = invalid key). Create a new key at https://openrouter.ai/keys. In project .env use either INK_OPENROUTER_API_KEY=sk-or-v1-... or OPENROUTER_API_KEY=sk-or-v1-... (no quotes, no "Bearer", no spaces). Confirm credits on https://openrouter.ai/credits. Restart npm run dev after saving.';

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const client = getOpenRouter();

  // Map our responseFormat to the SDK's expected shape
  let responseFormat: { type: 'json_object' } | { type: 'json_schema'; jsonSchema: { name: string; strict?: boolean; schema: Record<string, unknown> } } | undefined;
  if (options.responseFormat === 'json') {
    responseFormat = { type: 'json_object' };
  } else if (options.responseFormat) {
    responseFormat = {
      type: 'json_schema',
      jsonSchema: options.responseFormat.jsonSchema,
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion: any = await client.chat.send({
      chatGenerationParams: {
        model: options.model ?? getDefaultModel(),
        // Cast messages — our ChatMessage type is compatible but TS can't
        // narrow the discriminated union from a mapped array.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
        stream: false,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        responseFormat,
      },
    });

    return completion?.choices?.[0]?.message?.content?.toString() ?? '';
  } catch (e) {
    if (e instanceof UnauthorizedResponseError) {
      throw new Error(`${OPENROUTER_AUTH_HINT} (${e.message})`);
    }
    if (e instanceof Error && /user not found/i.test(e.message)) {
      throw new Error(`${OPENROUTER_AUTH_HINT} (${e.message})`);
    }
    throw e;
  }
}

/**
 * Convenience: send a chat request and parse the response as JSON.
 */
export async function chatCompletionJSON<T = unknown>(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<T> {
  const raw = await chatCompletion(messages, {
    ...options,
    responseFormat: options.responseFormat ?? 'json',
  });
  return JSON.parse(raw) as T;
}

/**
 * Check whether the OpenRouter API key is configured.
 */
export function isOpenRouterConfigured(): boolean {
  return !!getOpenRouterApiKey();
}
