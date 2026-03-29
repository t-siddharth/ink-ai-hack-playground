import type { HandwritingFeatures, EmotionAssessment } from './types';
import { EmotionLabel } from './types';

// Thresholds for pressure
const P_LOW = 0.38;
const P_HIGH = 0.58;
const P_VAR_LOW = 0.008;
const P_VAR_HIGH = 0.025;

// Thresholds for speed (px/ms)
const S_SLOW = 0.4;
const S_FAST = 1.2;
const S_VAR_HIGH = 0.6;

// Thresholds for rhythm
const PAUSE_FEW = 1;
const PAUSE_MANY = 4;
const DIR_SMOOTH = 0.8;   // changes per 100px
const DIR_JAGGED = 2.5;
const ACCEL_HIGH = 0.015;

interface ScoredEmotion {
  label: EmotionLabel;
  score: number;
  signals: string[];
}

function scoreEmotions(f: HandwritingFeatures): ScoredEmotion[] {
  const { pressure: p, speed: s, rhythm: r } = f;

  const scores: ScoredEmotion[] = [
    scoreStressed(p, s, r),
    scoreFocused(p, s, r),
    scoreExcited(p, s, r),
    scoreSad(p, s, r),
    scoreAnxious(p, s, r),
    scoreCalm(p, s, r),
    scoreNeutral(),
  ];

  return scores.sort((a, b) => b.score - a.score);
}

function scoreStressed(
  p: HandwritingFeatures['pressure'],
  s: HandwritingFeatures['speed'],
  r: HandwritingFeatures['rhythm']
): ScoredEmotion {
  let score = 0;
  const signals: string[] = [];

  if (p.mean > P_HIGH) { score += 2; signals.push('heavy pressure'); }
  if (p.hardRatio > 0.3) { score += 1; signals.push('forceful strokes'); }
  if (s.mean > S_FAST) { score += 2; signals.push('fast writing pace'); }
  if (s.meanAcceleration > ACCEL_HIGH) { score += 1; signals.push('erratic speed changes'); }
  if (r.directionChangeRate > DIR_JAGGED) { score += 2; signals.push('jagged strokes'); }
  if (r.pauseCount < PAUSE_FEW) { score += 1; signals.push('continuous writing'); }

  return { label: EmotionLabel.STRESSED, score, signals };
}

function scoreFocused(
  p: HandwritingFeatures['pressure'],
  s: HandwritingFeatures['speed'],
  r: HandwritingFeatures['rhythm']
): ScoredEmotion {
  let score = 0;
  const signals: string[] = [];

  if (p.mean > P_HIGH) { score += 2; signals.push('deliberate pressure'); }
  if (p.variance < P_VAR_LOW) { score += 2; signals.push('consistent pressure'); }
  if (s.mean >= S_SLOW && s.mean <= S_FAST) { score += 1; signals.push('measured pace'); }
  if (s.variance < S_VAR_HIGH * 0.5) { score += 2; signals.push('steady speed'); }
  if (r.directionChangeRate < DIR_SMOOTH) { score += 1; signals.push('smooth strokes'); }
  if (r.pauseCount < PAUSE_MANY) { score += 1; signals.push('minimal hesitation'); }

  return { label: EmotionLabel.FOCUSED, score, signals };
}

function scoreExcited(
  p: HandwritingFeatures['pressure'],
  s: HandwritingFeatures['speed'],
  r: HandwritingFeatures['rhythm']
): ScoredEmotion {
  let score = 0;
  const signals: string[] = [];

  if (p.mean < P_HIGH && p.mean > P_LOW) { score += 1; signals.push('light-to-moderate pressure'); }
  if (s.mean > S_FAST) { score += 3; signals.push('fast, energetic writing'); }
  if (r.pauseCount < PAUSE_FEW) { score += 2; signals.push('flowing, uninterrupted strokes'); }
  if (r.directionChangeRate < DIR_JAGGED) { score += 1; signals.push('expressive strokes'); }
  if (r.strokeCoverage > 5000) { score += 1; signals.push('expansive writing'); }

  return { label: EmotionLabel.EXCITED, score, signals };
}

function scoreSad(
  p: HandwritingFeatures['pressure'],
  s: HandwritingFeatures['speed'],
  r: HandwritingFeatures['rhythm']
): ScoredEmotion {
  let score = 0;
  const signals: string[] = [];

  if (p.mean < P_LOW) { score += 2; signals.push('very light pressure'); }
  if (s.mean < S_SLOW) { score += 2; signals.push('slow writing pace'); }
  if (r.pauseCount > PAUSE_MANY) { score += 2; signals.push('frequent pauses'); }
  if (r.interStrokeInterval > 800) { score += 1; signals.push('long gaps between strokes'); }
  if (p.trend < -0.001) { score += 1; signals.push('pressure trailing off'); }

  return { label: EmotionLabel.SAD, score, signals };
}

function scoreAnxious(
  p: HandwritingFeatures['pressure'],
  s: HandwritingFeatures['speed'],
  r: HandwritingFeatures['rhythm']
): ScoredEmotion {
  let score = 0;
  const signals: string[] = [];

  if (p.variance > P_VAR_HIGH) { score += 2; signals.push('uneven pressure'); }
  if (s.variance > S_VAR_HIGH) { score += 2; signals.push('inconsistent speed'); }
  if (r.pauseCount > PAUSE_MANY) { score += 2; signals.push('frequent hesitations'); }
  if (r.directionChangeRate > DIR_JAGGED) { score += 1; signals.push('shaky strokes'); }
  if (s.meanAcceleration > ACCEL_HIGH) { score += 1; signals.push('stop-start rhythm'); }

  return { label: EmotionLabel.ANXIOUS, score, signals };
}

function scoreCalm(
  p: HandwritingFeatures['pressure'],
  s: HandwritingFeatures['speed'],
  r: HandwritingFeatures['rhythm']
): ScoredEmotion {
  let score = 0;
  const signals: string[] = [];

  const pressureModerate = p.mean >= P_LOW && p.mean <= P_HIGH;
  const speedModerate = s.mean >= S_SLOW && s.mean <= S_FAST;

  if (pressureModerate) { score += 2; signals.push('relaxed pressure'); }
  if (p.variance < P_VAR_LOW) { score += 1; signals.push('steady pressure'); }
  if (speedModerate) { score += 2; signals.push('relaxed pace'); }
  if (s.variance < S_VAR_HIGH * 0.5) { score += 1; signals.push('consistent speed'); }
  if (r.directionChangeRate < DIR_SMOOTH) { score += 1; signals.push('smooth, flowing strokes'); }

  return { label: EmotionLabel.CALM, score, signals };
}

function scoreNeutral(): ScoredEmotion {
  // Neutral always has a baseline score so we always return something
  return { label: EmotionLabel.NEUTRAL, score: 1, signals: ['no strong signals detected'] };
}

function scoreToConfidence(topScore: number, secondScore: number): number {
  if (topScore <= 0) return 0.5;
  // Confidence is higher when top score is clearly above second place
  const margin = topScore - secondScore;
  const raw = (topScore + margin * 0.5) / (topScore + 6); // normalise to ~0-1
  return Math.max(0.35, Math.min(0.95, raw));
}

export function classify(features: HandwritingFeatures): EmotionAssessment {
  const ranked = scoreEmotions(features);
  const [top, second] = ranked;

  const confidence = scoreToConfidence(top.score, second?.score ?? 0);
  const secondary = second && second.score > 0 && second.label !== top.label
    ? second.label
    : undefined;

  // Deduplicate signals from top (and secondary if close)
  const signals = top.signals.length > 0
    ? top.signals
    : ['no strong signals detected'];

  return {
    primary: top.label,
    confidence,
    secondary,
    signals,
    features,
    timestamp: Date.now(),
    strokeCount: features.rhythm.strokeCount,
  };
}

export const ANXIETY_AUTO_TRIGGER_THRESHOLD = 0.70;

export function isAnxietyAlert(assessment: EmotionAssessment): boolean {
  return (
    assessment.primary === EmotionLabel.ANXIOUS &&
    assessment.confidence >= ANXIETY_AUTO_TRIGGER_THRESHOLD
  );
}
