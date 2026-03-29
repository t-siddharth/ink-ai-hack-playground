// InkTextElement: Recognized handwriting with tokens

import type { Quad } from '../../types/primitives';
import type { TransformableElement } from '../../types/primitives';
import type { Stroke } from '../../types/brush';

export interface InkTextToken {
  text: string;
  quad: Quad; // Bounding quad for this token
  strokeIndices: number[]; // Indices into sourceStrokes
  baseline?: number; // Y position of text baseline
  confidence?: number;
}

export interface InkTextLine {
  tokens: InkTextToken[];
  baseline: number;
}

/** LLM-derived interpretation; optional mood scores are 0–1 estimates, not clinical. */
export interface InkTextWritingInsight {
  recognizedText: string;
  summary: string;
  inferredIntent?: string;
  tags?: string[];
  alignsWithRecognition?: boolean;
  recognitionNote?: string;
  mood?: {
    stressed?: number;
    calm?: number;
    rushed?: number;
    tentative?: number;
  };
  analyzedAt: number;
  error?: string;
}

export interface InkTextElement extends TransformableElement {
  type: 'inkText';
  lines: InkTextLine[];
  sourceStrokes: Stroke[];
  layoutWidth?: number; // Width for text wrapping
  writingAngle?: number; // Estimated writing angle in radians
  writingInsight?: InkTextWritingInsight;
}
