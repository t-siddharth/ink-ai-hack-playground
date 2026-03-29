// Bridges async ink-text LLM insights into React note state (see App.tsx registration).

import type { InkTextWritingInsight } from '../elements/inktext/types';

export type InkTextInsightPatcher = (elementId: string, insight: InkTextWritingInsight) => void;

let patcher: InkTextInsightPatcher | null = null;

export function setInkTextInsightPatcher(p: InkTextInsightPatcher | null): void {
  patcher = p;
}

export function patchInkTextInsight(elementId: string, insight: InkTextWritingInsight): void {
  patcher?.(elementId, insight);
}
