// Shared types for handwriting-based emotional state assessment

export const EmotionLabel = {
  CALM: 'Calm',
  FOCUSED: 'Focused',
  EXCITED: 'Excited',
  STRESSED: 'Stressed',
  ANXIOUS: 'Anxious',
  SAD: 'Sad',
  NEUTRAL: 'Neutral',
} as const;
export type EmotionLabel = (typeof EmotionLabel)[keyof typeof EmotionLabel];

export const EMOTION_COLORS: Record<EmotionLabel, string> = {
  Calm: '#2ecc71',
  Focused: '#3498db',
  Excited: '#f1c40f',
  Stressed: '#e74c3c',
  Anxious: '#9b59b6',
  Sad: '#95a5a6',
  Neutral: '#7f8c8d',
};

export const EMOTION_ICONS: Record<EmotionLabel, string> = {
  Calm: '😌',
  Focused: '🎯',
  Excited: '✨',
  Stressed: '😤',
  Anxious: '😰',
  Sad: '😔',
  Neutral: '😐',
};

export interface PressureFeatures {
  mean: number;           // 0-1 average pressure across all points
  variance: number;       // statistical variance of pressure
  range: number;          // max - min pressure
  trend: number;          // linear slope (+ = increasing force, - = releasing)
  hardRatio: number;      // fraction of samples with pressure > 0.7
}

export interface SpeedFeatures {
  mean: number;           // px/ms average speed
  variance: number;       // statistical variance of speed
  peak: number;           // maximum speed observed (px/ms)
  pauseCount: number;     // inter-stroke gaps > 200ms
  meanPauseDuration: number; // average pause length in ms
  meanAcceleration: number;  // average |Δspeed| / Δtime (px/ms²)
}

export interface RhythmFeatures {
  strokeCount: number;
  meanStrokeLength: number;      // average path length per stroke in px
  interStrokeInterval: number;   // mean ms between stroke end and next stroke start
  directionChangeRate: number;   // direction changes per 100px of path
  strokeCoverage: number;        // bounding box area / strokeCount (px² per stroke)
}

export interface HandwritingFeatures {
  pressure: PressureFeatures;
  speed: SpeedFeatures;
  rhythm: RhythmFeatures;
  sampleCount: number;
  durationMs: number;
  hasRealPressure: boolean; // false when all pressure values are ~0.5 (mouse/no stylus)
}

export interface EmotionAssessment {
  primary: EmotionLabel;
  confidence: number;       // 0-1
  secondary?: EmotionLabel;
  signals: string[];        // human-readable e.g. ["heavy pressure", "frequent pauses"]
  narrative?: string;       // LLM-generated description (optional)
  features: HandwritingFeatures;
  timestamp: number;
  strokeCount: number;
}

export type FeedbackValue = 'correct' | 'questionable' | 'incorrect';

export interface FeedbackRecord {
  id: string;
  sessionId: string;
  timestamp: number;
  emotion: EmotionLabel;
  confidence: number;
  signals: string[];
  features: HandwritingFeatures;
  feedback: FeedbackValue;
  scope: 'rolling' | 'session';
}

export interface BaselineProfile {
  meanPressure: number;
  meanSpeed: number;    // px/ms
  capturedAt: number;   // epoch ms
}
