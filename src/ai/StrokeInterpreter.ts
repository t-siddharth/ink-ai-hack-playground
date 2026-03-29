// StrokeInterpreter - sends stroke data + element-specific prompts to OpenRouter
//
// Each element type can provide a prompt.txt file alongside its code.
// This service combines a base prompt (defining stroke format) with the
// element-specific prompt and the serialized stroke data, then sends it
// to OpenRouter for AI interpretation.

import type { Stroke } from '../types/brush';
import { chatCompletion, chatCompletionJSON, isOpenRouterConfigured } from './OpenRouterService';
import type { ChatOptions } from './OpenRouterService';
import basePrompt from './basePrompt.txt?raw';

// Load all element prompt.txt files at build time via Vite glob import.
// Keys are like '../elements/inktext/prompt.txt' → mapped to element type.
const promptModules = import.meta.glob<string>(
  '../elements/*/prompt.txt',
  { eager: true, query: '?raw', import: 'default' },
);

// Build a map: elementType → prompt text
const elementPrompts = new Map<string, string>();
for (const [path, content] of Object.entries(promptModules)) {
  // Extract element type from path: '../elements/<type>/prompt.txt'
  const match = path.match(/\.\.\/elements\/([^/]+)\/prompt\.txt$/);
  if (match) {
    elementPrompts.set(match[1], content);
  }
}

// ============================================================================
// Stroke Serialization
// ============================================================================

interface SerializedPoint {
  x: number;
  y: number;
  t: number;
  pressure?: number;
}

interface SerializedStroke {
  points: SerializedPoint[];
}

/**
 * Serialize strokes into a compact JSON-friendly format.
 * Rounds coordinates to 1 decimal place to save tokens.
 * Normalizes timestamps relative to the first point of the first stroke.
 */
function serializeStrokes(strokes: Stroke[]): SerializedStroke[] {
  // Find the earliest timestamp across all strokes
  let t0 = Infinity;
  for (const stroke of strokes) {
    for (const input of stroke.inputs.inputs) {
      if (input.timeMillis < t0) t0 = input.timeMillis;
    }
  }
  if (!isFinite(t0)) t0 = 0;

  return strokes.map((stroke) => ({
    points: stroke.inputs.inputs.map((input) => {
      const point: SerializedPoint = {
        x: Math.round(input.x * 10) / 10,
        y: Math.round(input.y * 10) / 10,
        t: Math.round(input.timeMillis - t0),
      };
      if (input.pressure !== undefined) {
        point.pressure = Math.round(input.pressure * 1000) / 1000;
      }
      return point;
    }),
  }));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check whether a given element type has an AI prompt registered.
 */
export function hasElementPrompt(elementType: string): boolean {
  return elementPrompts.has(elementType);
}

/**
 * Get the list of element types that have AI prompts.
 */
export function getAIEnabledElementTypes(): string[] {
  return Array.from(elementPrompts.keys());
}

/**
 * Get the raw prompt text for an element type (for debugging/display).
 */
export function getElementPrompt(elementType: string): string | undefined {
  return elementPrompts.get(elementType);
}

export interface InterpretStrokesOptions extends ChatOptions {
  /** Extra context to append after the element prompt. */
  additionalContext?: string;
}

/**
 * Interpret strokes using OpenRouter with an element-specific prompt.
 *
 * Combines:
 * 1. Base system prompt (stroke format definition)
 * 2. Element-specific prompt (from prompt.txt)
 * 3. Serialized stroke data
 *
 * Returns the raw AI response string.
 * Throws if OpenRouter is not configured or the element has no prompt.
 */
export async function interpretStrokes(
  strokes: Stroke[],
  elementType: string,
  options: InterpretStrokesOptions = {},
): Promise<string> {
  if (!isOpenRouterConfigured()) {
    throw new Error('OpenRouter is not configured. Set INK_OPENROUTER_API_KEY in your .env file.');
  }

  const elementPrompt = elementPrompts.get(elementType);
  if (!elementPrompt) {
    throw new Error(
      `No prompt.txt found for element type "${elementType}". ` +
      `Create src/elements/${elementType}/prompt.txt to enable AI interpretation.`,
    );
  }

  const serialized = serializeStrokes(strokes);
  const strokeDataJson = JSON.stringify({ strokes: serialized });

  const systemContent = `${basePrompt.trim()}\n\n## Element-Specific Instructions\n\n${elementPrompt.trim()}`;

  let userContent = `Here are the strokes to interpret:\n\n${strokeDataJson}`;
  if (options.additionalContext) {
    userContent += `\n\n## Additional Context\n\n${options.additionalContext}`;
  }

  const { additionalContext: _, ...chatOptions } = options;

  return chatCompletion(
    [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ],
    chatOptions,
  );
}

/**
 * Like interpretStrokes, but parses the AI response as JSON.
 */
export async function interpretStrokesJSON<T = unknown>(
  strokes: Stroke[],
  elementType: string,
  options: InterpretStrokesOptions = {},
): Promise<T> {
  if (!isOpenRouterConfigured()) {
    throw new Error('OpenRouter is not configured. Set INK_OPENROUTER_API_KEY in your .env file.');
  }

  const elementPrompt = elementPrompts.get(elementType);
  if (!elementPrompt) {
    throw new Error(
      `No prompt.txt found for element type "${elementType}". ` +
      `Create src/elements/${elementType}/prompt.txt to enable AI interpretation.`,
    );
  }

  const serialized = serializeStrokes(strokes);
  const strokeDataJson = JSON.stringify({ strokes: serialized });

  const systemContent = `${basePrompt.trim()}\n\n## Element-Specific Instructions\n\n${elementPrompt.trim()}`;

  let userContent = `Here are the strokes to interpret:\n\n${strokeDataJson}`;
  if (options.additionalContext) {
    userContent += `\n\n## Additional Context\n\n${options.additionalContext}`;
  }

  const { additionalContext: _, ...chatOptions } = options;

  return chatCompletionJSON<T>(
    [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ],
    chatOptions,
  );
}
