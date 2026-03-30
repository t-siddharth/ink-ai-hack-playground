import type { Stroke } from '../types';
import type {
  HandwritingFeatures,
  PressureFeatures,
  SpeedFeatures,
  RhythmFeatures,
  BaselineProfile,
} from './types';

const PAUSE_THRESHOLD_MS = 450; // gap between strokes counted as a pause (150–300ms is normal inter-letter transition)
const DIRECTION_CHANGE_ANGLE_DEG = 30; // minimum angle (degrees) to count as a direction change
const HARD_PRESSURE_THRESHOLD = 0.7;
const REAL_PRESSURE_VARIANCE_MIN = 0.001; // if variance is below this, pressure is probably synthetic

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((acc, x, i) => acc + (x - xMean) * (values[i] - yMean), 0);
  const den = xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

function angleBetween(
  ax: number, ay: number,
  bx: number, by: number
): number {
  const dot = ax * bx + ay * by;
  const magA = Math.sqrt(ax * ax + ay * ay);
  const magB = Math.sqrt(bx * bx + by * by);
  if (magA === 0 || magB === 0) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return Math.acos(cosTheta) * (180 / Math.PI);
}

function extractPressureFeatures(strokes: Stroke[]): { features: PressureFeatures; hasRealPressure: boolean } {
  const allPressures: number[] = [];

  for (const stroke of strokes) {
    for (const pt of stroke.inputs.inputs) {
      allPressures.push(pt.pressure ?? 0.5);
    }
  }

  if (allPressures.length === 0) {
    return {
      features: { mean: 0.5, variance: 0, range: 0, trend: 0, hardRatio: 0 },
      hasRealPressure: false,
    };
  }

  const mean = allPressures.reduce((a, b) => a + b, 0) / allPressures.length;
  const v = variance(allPressures);
  const min = Math.min(...allPressures);
  const max = Math.max(...allPressures);

  // Pressure is "real" if it shows meaningful variation (stylus) rather than flat 0.5 (mouse)
  const hasRealPressure = v > REAL_PRESSURE_VARIANCE_MIN;

  return {
    features: {
      mean,
      variance: v,
      range: max - min,
      trend: linearSlope(allPressures),
      hardRatio: allPressures.filter(p => p > HARD_PRESSURE_THRESHOLD).length / allPressures.length,
    },
    hasRealPressure,
  };
}

function extractSpeedFeatures(strokes: Stroke[]): SpeedFeatures {
  const allSpeeds: number[] = [];
  const allAccelerations: number[] = [];
  const pauses: number[] = [];

  for (let si = 0; si < strokes.length; si++) {
    const pts = strokes[si].inputs.inputs;

    // Intra-stroke speeds
    let prevSpeed = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const dt = pts[i].timeMillis - pts[i - 1].timeMillis;
      if (dt <= 0) continue;

      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = dist / dt; // px/ms
      allSpeeds.push(speed);

      const dSpeed = Math.abs(speed - prevSpeed);
      allAccelerations.push(dSpeed / dt);
      prevSpeed = speed;
    }

    // Inter-stroke pause (gap between this stroke end and the next stroke start)
    if (si < strokes.length - 1) {
      const thisEnd = strokes[si].inputs.inputs.at(-1);
      const nextStart = strokes[si + 1].inputs.inputs[0];
      if (thisEnd && nextStart) {
        const gap = nextStart.timeMillis - thisEnd.timeMillis;
        if (gap > PAUSE_THRESHOLD_MS) {
          pauses.push(gap);
        }
      }
    }
  }

  const meanSpeed = allSpeeds.length > 0 ? allSpeeds.reduce((a, b) => a + b, 0) / allSpeeds.length : 0;
  const peak = allSpeeds.length > 0 ? Math.max(...allSpeeds) : 0;
  const speedVariance = variance(allSpeeds);
  const meanAcceleration = allAccelerations.length > 0
    ? allAccelerations.reduce((a, b) => a + b, 0) / allAccelerations.length
    : 0;
  const meanPauseDuration = pauses.length > 0 ? pauses.reduce((a, b) => a + b, 0) / pauses.length : 0;

  // Velocity reversals: number of times speed crosses the mean per stroke.
  // Calm strokes have a smooth bell-curve speed profile (~2 crossings); jerky/anxious strokes
  // oscillate frequently. Normalise by stroke count for a per-stroke rate.
  let rawReversals = 0;
  if (allSpeeds.length > 1) {
    const aboveMean = allSpeeds.map(v => v >= meanSpeed);
    for (let i = 1; i < aboveMean.length; i++) {
      if (aboveMean[i] !== aboveMean[i - 1]) rawReversals++;
    }
  }
  const velocityReversals = strokes.length > 0 ? rawReversals / strokes.length : 0;

  return {
    mean: meanSpeed,
    variance: speedVariance,
    peak,
    pauseCount: pauses.length,
    meanPauseDuration,
    meanAcceleration,
    velocityReversals,
  };
}

function extractRhythmFeatures(strokes: Stroke[]): RhythmFeatures {
  if (strokes.length === 0) {
    return { strokeCount: 0, meanStrokeLength: 0, interStrokeInterval: 0, directionChangeRate: 0, strokeCoverage: 0 };
  }

  const strokeLengths: number[] = [];
  const interStrokeIntervals: number[] = [];
  let totalDirectionChanges = 0;
  let totalPathLength = 0;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (let si = 0; si < strokes.length; si++) {
    const pts = strokes[si].inputs.inputs;

    // Stroke path length and direction changes
    let strokeLength = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      strokeLength += segLen;

      if (i >= 2) {
        const pdx = pts[i - 1].x - pts[i - 2].x;
        const pdy = pts[i - 1].y - pts[i - 2].y;
        const angle = angleBetween(pdx, pdy, dx, dy);
        if (angle > DIRECTION_CHANGE_ANGLE_DEG) {
          totalDirectionChanges++;
        }
      }

      // Bounding box
      minX = Math.min(minX, pts[i].x);
      minY = Math.min(minY, pts[i].y);
      maxX = Math.max(maxX, pts[i].x);
      maxY = Math.max(maxY, pts[i].y);
    }

    // First point of stroke also contributes to bbox
    if (pts.length > 0) {
      minX = Math.min(minX, pts[0].x);
      minY = Math.min(minY, pts[0].y);
      maxX = Math.max(maxX, pts[0].x);
      maxY = Math.max(maxY, pts[0].y);
    }

    strokeLengths.push(strokeLength);
    totalPathLength += strokeLength;

    // Inter-stroke interval
    if (si < strokes.length - 1) {
      const thisEnd = strokes[si].inputs.inputs.at(-1);
      const nextStart = strokes[si + 1].inputs.inputs[0];
      if (thisEnd && nextStart) {
        interStrokeIntervals.push(nextStart.timeMillis - thisEnd.timeMillis);
      }
    }
  }

  const bboxArea = (isFinite(maxX) && isFinite(minX)) ? (maxX - minX) * (maxY - minY) : 0;
  const meanStrokeLength = strokeLengths.reduce((a, b) => a + b, 0) / strokeLengths.length;
  const interStrokeInterval = interStrokeIntervals.length > 0
    ? interStrokeIntervals.reduce((a, b) => a + b, 0) / interStrokeIntervals.length
    : 0;
  const directionChangeRate = totalPathLength > 0 ? (totalDirectionChanges / totalPathLength) * 100 : 0;
  const strokeCoverage = strokes.length > 0 ? bboxArea / strokes.length : 0;

  return {
    strokeCount: strokes.length,
    meanStrokeLength,
    interStrokeInterval,
    directionChangeRate,
    strokeCoverage,
  };
}

/**
 * Normalise features relative to a user's personal baseline.
 * Only adjusts pressure.mean and speed.mean so classifiers see deviation from personal norm.
 */
function applyBaseline(features: HandwritingFeatures, baseline: BaselineProfile): HandwritingFeatures {
  const pressureShift = features.pressure.mean - baseline.meanPressure;
  // speedRatio = how fast the user is writing relative to their own baseline.
  // We re-anchor to 0.8 px/ms (the neutral midpoint of S_SLOW..S_FAST) so classifier
  // thresholds have consistent meaning regardless of the user's absolute writing speed.
  // e.g. writing at 2× baseline → 1.6 (above S_FAST); at 0.5× baseline → 0.4 (at S_SLOW).
  const speedRatio = baseline.meanSpeed > 0 ? features.speed.mean / baseline.meanSpeed : 1;

  return {
    ...features,
    pressure: {
      ...features.pressure,
      mean: 0.5 + pressureShift, // re-centre around 0.5
    },
    speed: {
      ...features.speed,
      mean: speedRatio * 0.8, // normalised: at-baseline = 0.8, 2× baseline = 1.6, 0.5× = 0.4
    },
  };
}

export function extractFeatures(strokes: Stroke[], baseline?: BaselineProfile): HandwritingFeatures {
  if (strokes.length === 0) {
    return {
      pressure: { mean: 0.5, variance: 0, range: 0, trend: 0, hardRatio: 0 },
      speed: { mean: 0, variance: 0, peak: 0, pauseCount: 0, meanPauseDuration: 0, meanAcceleration: 0, velocityReversals: 0 },
      rhythm: { strokeCount: 0, meanStrokeLength: 0, interStrokeInterval: 0, directionChangeRate: 0, strokeCoverage: 0 },
      sampleCount: 0,
      durationMs: 0,
      hasRealPressure: false,
    };
  }

  const { features: pressureFeatures, hasRealPressure } = extractPressureFeatures(strokes);
  const speedFeatures = extractSpeedFeatures(strokes);
  const rhythmFeatures = extractRhythmFeatures(strokes);

  const allPoints = strokes.flatMap(s => s.inputs.inputs);
  const sampleCount = allPoints.length;

  const firstTime = strokes[0].inputs.inputs[0]?.timeMillis ?? 0;
  const lastTime = strokes.at(-1)!.inputs.inputs.at(-1)?.timeMillis ?? 0;
  const durationMs = lastTime - firstTime;

  const raw: HandwritingFeatures = {
    pressure: pressureFeatures,
    speed: speedFeatures,
    rhythm: rhythmFeatures,
    sampleCount,
    durationMs,
    hasRealPressure,
  };

  return baseline ? applyBaseline(raw, baseline) : raw;
}
