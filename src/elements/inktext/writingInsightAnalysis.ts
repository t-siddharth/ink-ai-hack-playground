// Runs OpenRouter analysis: recognition transcript + stroke dynamics → writingInsight

import type { Stroke } from '../../types';
import type { HandwritingRecognitionResult } from '../../recognition/RecognitionService';
import type { InkTextWritingInsight } from './types';
import { interpretStrokesJSON, hasElementPrompt } from '../../ai/StrokeInterpreter';
import { isOpenRouterConfigured } from '../../ai/OpenRouterService';
import { patchInkTextInsight } from '../../state/inkTextInsightBridge';
import { formatBaselineForPrompt, loadWritingBaseline } from '../../services/writingBaseline';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function asNum(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return clamp01(v);
  if (typeof v === 'string') {
    const parsed = parseFloat(v);
    if (!Number.isNaN(parsed)) return clamp01(parsed);
  }
  return undefined;
}

function normalizeMood(raw: unknown): InkTextWritingInsight['mood'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  const mood = {
    stressed: asNum(m.stressed),
    calm: asNum(m.calm),
    rushed: asNum(m.rushed),
    tentative: asNum(m.tentative),
  };
  if (
    mood.stressed === undefined &&
    mood.calm === undefined &&
    mood.rushed === undefined &&
    mood.tentative === undefined
  ) {
    return undefined;
  }
  return mood;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return out.length > 0 ? out : undefined;
}

function normalizeInsight(raw: unknown, recognizedText: string): InkTextWritingInsight {
  const text = recognizedText.trim();
  if (!raw || typeof raw !== 'object') {
    return {
      recognizedText: text,
      summary: '',
      analyzedAt: Date.now(),
      error: 'Unexpected AI response shape',
    };
  }
  const o = raw as Record<string, unknown>;
  const summary = asString(o.summary)?.trim() ?? '';
  return {
    recognizedText: text,
    summary,
    inferredIntent: asString(o.inferred_intent)?.trim() || asString(o.inferredIntent)?.trim(),
    tags: asStringArray(o.tags),
    alignsWithRecognition: typeof o.aligns_with_recognition === 'boolean'
      ? o.aligns_with_recognition
      : typeof o.alignsWithRecognition === 'boolean'
        ? o.alignsWithRecognition
        : undefined,
    recognitionNote:
      asString(o.recognition_note)?.trim() ||
      asString(o.recognitionNote)?.trim() ||
      undefined,
    mood: normalizeMood(o.mood),
    analyzedAt: Date.now(),
  };
}

/**
 * Fire async LLM run; patches element via bridge when complete.
 */
export function requestInkTextWritingInsight(
  elementId: string,
  strokes: Stroke[],
  recognizedText: string,
): void {
  if (!isOpenRouterConfigured() || !hasElementPrompt('inktext')) {
    return;
  }

  const trimmed = recognizedText.trim();
  if (!trimmed || strokes.length === 0) {
    return;
  }

  void (async () => {
    try {
      const baselineBlock = formatBaselineForPrompt(loadWritingBaseline());
      const transcriptBlock = `Handwriting recognition transcript (may contain errors — use strokes to sanity-check):\n"""${trimmed}"""`;
      const additionalContext = baselineBlock
        ? `${baselineBlock}\n\n${transcriptBlock}`
        : transcriptBlock;

      const raw = await interpretStrokesJSON<Record<string, unknown>>(strokes, 'inktext', {
        temperature: 0.35,
        maxTokens: 600,
        additionalContext,
      });
      const insight = normalizeInsight(raw, trimmed);
      patchInkTextInsight(elementId, insight);
    } catch (e) {
      patchInkTextInsight(elementId, {
        recognizedText: trimmed,
        summary: '',
        analyzedAt: Date.now(),
        error: e instanceof Error ? e.message : 'Writing insight request failed',
      });
    }
  })();
}

export function getInkTextPlainTextFromLines(element: { lines: { tokens: { text: string }[] }[] }): string {
  return element.lines
    .map((line) => line.tokens.map((t) => t.text).join(''))
    .join('\n')
    .trim();
}

export function getRecognitionPlainText(result: HandwritingRecognitionResult): string {
  const raw = result.rawText?.trim();
  if (raw) return result.rawText.trim();
  return result.lines
    .map((l) => l.tokens.map((t) => t.text).join(''))
    .join('\n')
    .trim();
}
