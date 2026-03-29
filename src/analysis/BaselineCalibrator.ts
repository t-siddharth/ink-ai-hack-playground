import type { Stroke } from '../types';
import type { BaselineProfile } from './types';
import { extractFeatures } from './StrokeFeatureExtractor';

const BASELINE_KEY = 'ink-emotion-baseline';

// Population-average fallback used before any calibration
const DEFAULT_BASELINE: BaselineProfile = {
  meanPressure: 0.5,
  meanSpeed: 0.8, // px/ms — typical mouse/stylus speed
  capturedAt: 0,
};

export function loadBaseline(): BaselineProfile {
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BaselineProfile;
      if (
        typeof parsed.meanPressure === 'number' &&
        typeof parsed.meanSpeed === 'number'
      ) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_BASELINE;
}

export function saveBaseline(profile: BaselineProfile): void {
  try {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(profile));
  } catch { /* ignore */ }
}

export function clearBaseline(): void {
  localStorage.removeItem(BASELINE_KEY);
}

export function hasBaseline(): boolean {
  return loadBaseline().capturedAt > 0;
}

/**
 * Compute a baseline profile from a set of "neutral" calibration strokes.
 * Call this after the user writes the calibration sentence.
 */
export function computeBaseline(strokes: Stroke[]): BaselineProfile {
  if (strokes.length === 0) return DEFAULT_BASELINE;

  const features = extractFeatures(strokes);
  return {
    meanPressure: features.pressure.mean,
    meanSpeed: features.speed.mean > 0 ? features.speed.mean : DEFAULT_BASELINE.meanSpeed,
    capturedAt: Date.now(),
  };
}

export const CALIBRATION_PROMPT =
  'Write this sentence naturally: "The quick brown fox jumps over the lazy dog"';
