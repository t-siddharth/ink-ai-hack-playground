// Personal writing baseline: user writes a known phrase, we store stroke metrics for LLM context.

import type { Stroke } from '../types';

export const CALIBRATION_PHRASE =
  'The quick brown fox';

const STORAGE_KEY = 'ink-playground-writing-baseline';

export interface WritingBaselineMetrics {
  strokeCount: number;
  pointCount: number;
  /** Sum of segment lengths in px (all strokes). */
  pathLengthPx: number;
  /** Time from first point to last point (ms). */
  spanMs: number;
  /** pathLengthPx / spanMs when spanMs > 0. */
  speedPxPerMs?: number;
  pressureSampleCount: number;
  pressureMean?: number;
  pressureStd?: number;
}

export interface WritingBaseline {
  version: 1;
  capturedAt: number;
  /** Phrase we asked them to copy. */
  phraseExpected: string;
  /** What recognition read when they calibrated (for your UI / LLM). */
  recognizedAtCapture: string;
  metrics: WritingBaselineMetrics;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdSample(values: number[], m: number): number {
  if (values.length < 2) return 0;
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function computeBaselineFromStrokes(
  strokes: Stroke[],
  phraseExpected: string,
  recognizedAtCapture: string,
): WritingBaseline {
  const pressures: number[] = [];
  let pathLengthPx = 0;
  let pointCount = 0;
  let tMin = Infinity;
  let tMax = -Infinity;

  for (const stroke of strokes) {
    const inputs = stroke.inputs.inputs;
    pointCount += inputs.length;
    for (let i = 0; i < inputs.length; i++) {
      const inp = inputs[i];
      tMin = Math.min(tMin, inp.timeMillis);
      tMax = Math.max(tMax, inp.timeMillis);
      const p = inp.pressure;
      if (p !== undefined && p > 0) pressures.push(p);
      if (i > 0) {
        const prev = inputs[i - 1];
        pathLengthPx += Math.hypot(inp.x - prev.x, inp.y - prev.y);
      }
    }
  }

  const spanMs = tMax > tMin ? tMax - tMin : 0;
  const speedPxPerMs = spanMs > 0 ? pathLengthPx / spanMs : undefined;
  const pressureMean = pressures.length > 0 ? mean(pressures) : undefined;
  const pressureStd =
    pressures.length >= 2 && pressureMean !== undefined
      ? stdSample(pressures, pressureMean)
      : undefined;

  return {
    version: 1,
    capturedAt: Date.now(),
    phraseExpected,
    recognizedAtCapture: recognizedAtCapture.trim(),
    metrics: {
      strokeCount: strokes.length,
      pointCount,
      pathLengthPx,
      spanMs,
      speedPxPerMs,
      pressureSampleCount: pressures.length,
      pressureMean,
      pressureStd,
    },
  };
}

export function loadWritingBaseline(): WritingBaseline | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WritingBaseline;
    if (parsed?.version !== 1 || !parsed.metrics) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWritingBaseline(baseline: WritingBaseline): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(baseline));
  } catch {
    /* quota / private mode */
  }
}

export function clearWritingBaseline(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Human-readable lines for the insights panel. */
export function describeBaseline(b: WritingBaseline): string[] {
  const m = b.metrics;
  const lines: string[] = [];
  lines.push(`Phrase: "${b.phraseExpected}"`);
  if (b.recognizedAtCapture) {
    lines.push(`Read as: "${b.recognizedAtCapture}"`);
  }
  lines.push(`Strokes: ${m.strokeCount} · Points: ${m.pointCount}`);
  if (m.spanMs > 0) {
    lines.push(`Speed: ${(m.speedPxPerMs ?? 0).toFixed(3)} px/ms over ${Math.round(m.spanMs)} ms`);
  }
  if (m.pressureSampleCount > 0 && m.pressureMean !== undefined) {
    lines.push(
      `Pressure: mean ${m.pressureMean.toFixed(2)} · σ ${(m.pressureStd ?? 0).toFixed(2)} (${m.pressureSampleCount} samples)`,
    );
  } else {
    lines.push('Pressure: no stylus samples (mouse/touch)');
  }
  return lines;
}

/**
 * Extra user-context for the ink-text LLM: interpret new ink relative to this writer.
 */
export function formatBaselineForPrompt(b: WritingBaseline | null): string {
  if (!b) return '';

  const m = b.metrics;
  const parts: string[] = [
    '## Personal writing baseline (calibration)',
    `The writer copied this reference phrase: "${b.phraseExpected}".`,
    `At calibration, recognition read: "${b.recognizedAtCapture || '(empty)'}".`,
    'Use the numbers below only to judge **relative** changes (faster/slower, heavier/lighter) vs their normal, not as absolute truth.',
    `- Strokes: ${m.strokeCount}, points: ${m.pointCount}`,
  ];
  if (m.spanMs > 0 && m.speedPxPerMs !== undefined) {
    parts.push(`- Typical calibration speed: ${m.speedPxPerMs.toFixed(4)} px/ms over ${Math.round(m.spanMs)} ms`);
  }
  if (m.pressureSampleCount > 0 && m.pressureMean !== undefined) {
    parts.push(
      `- Typical calibration pressure: mean ${m.pressureMean.toFixed(3)}, stdev ${(m.pressureStd ?? 0).toFixed(3)} (${m.pressureSampleCount} samples)`,
    );
  } else {
    parts.push('- No pressure data at calibration (mouse/touch); do not over-interpret pressure on new ink.');
  }
  parts.push(
    'When scoring mood/pace on **new** strokes, treat values **closer to this baseline as more "neutral"** for this person; deviations may deserve mention in summary or mood.',
  );

  return parts.join('\n');
}
