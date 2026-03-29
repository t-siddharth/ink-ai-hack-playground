import { useState, useEffect, useRef } from 'react';
import type { EmotionAssessment } from './types';
import { EMOTION_COLORS, EMOTION_ICONS } from './types';
import { submitFeedback, exportFeedbackAsJson } from './EmotionHistory';
import './EmotionToast.css';

// Breathing exercise steps: [label, duration in ms]
const BREATHING_STEPS: [string, number][] = [
  ['Inhale', 4000],
  ['Hold', 4000],
  ['Exhale', 6000],
  ['Rest', 2000],
];
const BREATHING_CYCLES = 3;

interface BreathingModalProps {
  onClose: () => void;
}

function BreathingModal({ onClose }: BreathingModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const stepDuration = BREATHING_STEPS[stepIndex][1];
      const p = Math.min(elapsed / stepDuration, 1);
      setProgress(p);

      if (p >= 1) {
        const nextStep = (stepIndex + 1) % BREATHING_STEPS.length;
        const nextCycle = nextStep === 0 ? cycle + 1 : cycle;

        if (nextStep === 0 && nextCycle > BREATHING_CYCLES) {
          setDone(true);
          if (timerRef.current) clearInterval(timerRef.current);
          return;
        }

        setStepIndex(nextStep);
        setCycle(nextCycle);
        setProgress(0);
        startRef.current = Date.now();
      }
    };

    timerRef.current = setInterval(tick, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stepIndex, cycle]);

  const [label] = BREATHING_STEPS[stepIndex];
  const stepDuration = BREATHING_STEPS[stepIndex][1];
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="breathing-backdrop" onClick={onClose}>
      <div className="breathing-modal" onClick={e => e.stopPropagation()}>
        <button className="breathing-close" onClick={onClose} aria-label="Close">✕</button>
        <h2 className="breathing-title">Breathing Exercise</h2>
        <p className="breathing-subtitle">Cycle {Math.min(cycle, BREATHING_CYCLES)} of {BREATHING_CYCLES}</p>

        {done ? (
          <div className="breathing-done">
            <div className="breathing-done-icon">✓</div>
            <p>Well done! Take a moment to notice how you feel.</p>
            <button className="breathing-btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="breathing-ring-container">
              <svg width="128" height="128" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="54" fill="none" stroke="#e8e8e8" strokeWidth="8" />
                <circle
                  cx="64" cy="64" r="54"
                  fill="none"
                  stroke="#9b59b6"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 64 64)"
                  style={{ transition: 'stroke-dashoffset 0.05s linear' }}
                />
              </svg>
              <div className="breathing-label">{label}</div>
            </div>
            <p className="breathing-duration">{(stepDuration / 1000).toFixed(0)}s</p>
          </>
        )}
      </div>
    </div>
  );
}

interface EmotionToastProps {
  assessment: EmotionAssessment | null;
  visible: boolean;
  onDismiss: () => void;
}

export function EmotionToast({ assessment, visible, onDismiss }: EmotionToastProps) {
  const [showBreathing, setShowBreathing] = useState(false);
  // Track which assessment timestamp had the anxiety prompt dismissed
  const [anxietyDismissedTs, setAnxietyDismissedTs] = useState<number | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null); // assessment timestamp key
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss anxiety prompt after 3s
  useEffect(() => {
    if (!assessment) return;
    if (assessment.primary !== 'Anxious' || assessment.confidence < 0.70) return;

    dismissTimerRef.current = setTimeout(() => {
      setAnxietyDismissedTs(assessment.timestamp);
    }, 3000);

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [assessment]);

  if (!visible || !assessment) return null;

  const color = EMOTION_COLORS[assessment.primary];
  const icon = EMOTION_ICONS[assessment.primary];
  const isAnxious = assessment.primary === 'Anxious' && assessment.confidence >= 0.70;
  const showAnxietyPrompt = isAnxious && anxietyDismissedTs !== assessment.timestamp;
  const feedbackKey = String(assessment.timestamp);
  const hasFeedback = feedbackGiven === feedbackKey;

  function handleFeedback(value: 'correct' | 'questionable' | 'incorrect') {
    if (!assessment) return;
    submitFeedback(assessment, value, 'rolling');
    setFeedbackGiven(feedbackKey);
  }

  return (
    <>
      <div className="emotion-toast" role="status" aria-live="polite">
        {/* Header */}
        <div className="emotion-toast-header" style={{ borderLeftColor: color }}>
          <span className="emotion-icon">{icon}</span>
          <div className="emotion-main">
            <span className="emotion-label" style={{ color }}>{assessment.primary}</span>
            {assessment.secondary && (
              <span className="emotion-secondary"> · {assessment.secondary}</span>
            )}
            <div className="emotion-confidence-bar">
              <div
                className="emotion-confidence-fill"
                style={{ width: `${Math.round(assessment.confidence * 100)}%`, background: color }}
              />
            </div>
          </div>
          <button className="emotion-close" onClick={onDismiss} aria-label="Dismiss emotion panel">✕</button>
        </div>

        {/* Signals */}
        {assessment.signals.length > 0 && (
          <ul className="emotion-signals">
            {assessment.signals.map((sig, i) => (
              <li key={i}>{sig}</li>
            ))}
          </ul>
        )}

        {/* Anxiety prompt */}
        {showAnxietyPrompt && (
          <div className="emotion-anxiety-prompt">
            <span>Feeling anxious? Try a quick breathing exercise.</span>
            <div className="emotion-anxiety-actions">
              <button className="emotion-btn emotion-btn-primary" onClick={() => setShowBreathing(true)}>
                Start breathing
              </button>
              <button className="emotion-btn" onClick={() => setAnxietyDismissedTs(assessment.timestamp)}>
                Not now
              </button>
            </div>
          </div>
        )}

        {/* Feedback */}
        <div className="emotion-feedback">
          {hasFeedback ? (
            <span className="emotion-feedback-thanks">Thanks for the feedback!</span>
          ) : (
            <>
              <span className="emotion-feedback-label">Was this accurate?</span>
              <div className="emotion-feedback-buttons">
                <button
                  className="emotion-feedback-btn"
                  title="Yes, correct"
                  onClick={() => handleFeedback('correct')}
                >✅</button>
                <button
                  className="emotion-feedback-btn"
                  title="Not sure"
                  onClick={() => handleFeedback('questionable')}
                >❓</button>
                <button
                  className="emotion-feedback-btn"
                  title="No, incorrect"
                  onClick={() => handleFeedback('incorrect')}
                >❌</button>
              </div>
            </>
          )}
          <button
            className="emotion-btn emotion-btn-export"
            title="Export feedback data as JSON"
            onClick={exportFeedbackAsJson}
          >
            Export
          </button>
        </div>
      </div>

      {showBreathing && <BreathingModal onClose={() => setShowBreathing(false)} />}
    </>
  );
}
