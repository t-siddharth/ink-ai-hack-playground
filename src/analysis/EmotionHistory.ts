import type { EmotionAssessment, FeedbackRecord, FeedbackValue } from './types';
import { generateId } from '../types/primitives';

const SESSION_ID_KEY = 'ink-emotion-session-id';
const HISTORY_KEY = 'ink-emotion-history';
const MAX_HISTORY = 100;

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = generateId();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export const sessionId = getOrCreateSessionId();

// In-memory session history (also mirrored to localStorage up to MAX_HISTORY)
let sessionHistory: EmotionAssessment[] = [];
let feedbackRecords: FeedbackRecord[] = loadFeedback();

function loadFeedback(): FeedbackRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as FeedbackRecord[];
  } catch { /* ignore */ }
  return [];
}

function persistFeedback(): void {
  try {
    // Keep only the most recent MAX_HISTORY records to avoid unbounded growth
    const trimmed = feedbackRecords.slice(-MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    feedbackRecords = trimmed;
  } catch { /* ignore */ }
}

/** Add an assessment to the in-memory session history. */
export function recordAssessment(assessment: EmotionAssessment): void {
  sessionHistory = [...sessionHistory, assessment];
}

/** Return all assessments recorded this session, optionally limited to the most recent N. */
export function getHistory(limit?: number): EmotionAssessment[] {
  if (limit !== undefined) return sessionHistory.slice(-limit);
  return [...sessionHistory];
}

/** Attach user feedback to an assessment and persist it. */
export function submitFeedback(
  assessment: EmotionAssessment,
  feedback: FeedbackValue,
  scope: 'rolling' | 'session'
): FeedbackRecord {
  const record: FeedbackRecord = {
    id: generateId(),
    sessionId,
    timestamp: assessment.timestamp,
    emotion: assessment.primary,
    confidence: assessment.confidence,
    signals: assessment.signals,
    features: assessment.features,
    feedback,
    scope,
  };
  feedbackRecords = [...feedbackRecords, record];
  persistFeedback();
  return record;
}

/** Export all feedback records as a downloadable JSON file. */
export function exportFeedbackAsJson(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    sessionId,
    records: feedbackRecords,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `emotion-feedback-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Return all persisted feedback records (across sessions). */
export function getAllFeedback(): FeedbackRecord[] {
  return [...feedbackRecords];
}

/** Clear in-memory session history (e.g. on new note). */
export function clearSessionHistory(): void {
  sessionHistory = [];
}
