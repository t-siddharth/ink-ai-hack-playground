import type { Element } from '../types';
import type { InkTextElement } from '../elements/inktext/types';
import { isOpenRouterConfigured } from '../ai/OpenRouterService';
import type { WritingBaseline } from '../services/writingBaseline';
import { describeBaseline } from '../services/writingBaseline';

interface Props {
  elements: Element[];
  selectedIds: Set<string>;
  baseline: WritingBaseline | null;
  calibrationPhrase: string;
  canSetBaselineFromSelection: boolean;
  onSetBaselineFromSelection: () => void;
  onClearBaseline: () => void;
}

function moodLine(mood: NonNullable<InkTextElement['writingInsight']>['mood']): string | null {
  if (!mood) return null;
  const parts: string[] = [];
  if (mood.calm != null) parts.push(`calm ${mood.calm.toFixed(2)}`);
  if (mood.stressed != null) parts.push(`stressed ${mood.stressed.toFixed(2)}`);
  if (mood.rushed != null) parts.push(`rushed ${mood.rushed.toFixed(2)}`);
  if (mood.tentative != null) parts.push(`tentative ${mood.tentative.toFixed(2)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function WritingInsightsPanel({
  elements,
  selectedIds,
  baseline,
  calibrationPhrase,
  canSetBaselineFromSelection,
  onSetBaselineFromSelection,
  onClearBaseline,
}: Props) {
  const blocks = elements.filter((e): e is InkTextElement => e.type === 'inkText');
  const configured = isOpenRouterConfigured();

  const combinedPreview = blocks
    .map((b) => b.writingInsight?.summary?.trim())
    .filter(Boolean)
    .join(' ');

  return (
    <aside className="writing-insights-panel" aria-label="Writing insights">
      <h2 className="writing-insights-title">Writing insights</h2>
      <p className="writing-insights-hint">
        Summaries use handwriting recognition text plus stroke timing and pressure (when available).
        Mood scores are informal estimates, not diagnostics.
      </p>

      <section className="writing-insights-baseline" aria-label="Writing baseline calibration">
        <h3 className="writing-insights-baseline-title">Your baseline</h3>
        <p className="writing-insights-baseline-instruct">
          Write this phrase on the canvas, wait for it to become ink text, select that text, then click
          save. Later summaries compare new ink to <strong>your</strong> norms (pace and pressure).
        </p>
        <p className="writing-insights-baseline-phrase">“{calibrationPhrase}”</p>
        <div className="writing-insights-baseline-actions">
          <button
            type="button"
            className="writing-insights-baseline-btn"
            onClick={onSetBaselineFromSelection}
            disabled={!canSetBaselineFromSelection}
            title={
              canSetBaselineFromSelection
                ? 'Use selected ink text strokes as calibration'
                : 'Select a single ink text block first'
            }
          >
            Save from selection
          </button>
          <button
            type="button"
            className="writing-insights-baseline-btn writing-insights-baseline-btn--ghost"
            onClick={onClearBaseline}
            disabled={!baseline}
          >
            Clear
          </button>
        </div>
        {baseline && (
          <ul className="writing-insights-baseline-stats">
            {describeBaseline(baseline).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
            <li className="writing-insights-baseline-date">
              Saved {new Date(baseline.capturedAt).toLocaleString()}
            </li>
          </ul>
        )}
      </section>

      {!configured && (
        <p className="writing-insights-warn">
          Set <code>INK_OPENROUTER_API_KEY</code> in <code>.env</code> to enable AI summaries.
        </p>
      )}
      {blocks.length === 0 && (
        <p className="writing-insights-empty">No ink text on the canvas yet. Write a line or two and pause so text can form.</p>
      )}
      {blocks.length > 0 && combinedPreview && (
        <section className="writing-insights-doc">
          <h3>Canvas overview</h3>
          <p>{combinedPreview}</p>
        </section>
      )}
      {blocks.length > 0 && (
        <ul className="writing-insights-list">
          {blocks.map((el) => {
            const insight = el.writingInsight;
            const fullText = el.lines
              .map((l) => l.tokens.map((t) => t.text).join(''))
              .join(' ')
              .trim();
            const preview =
              fullText.length > 48 ? `${fullText.slice(0, 48)}…` : fullText;
            const selected = selectedIds.has(el.id);
            return (
              <li
                key={el.id}
                className={`writing-insights-card${selected ? ' writing-insights-card--selected' : ''}`}
              >
                <div className="writing-insights-card-label">{preview || '(empty text)'}</div>
                {insight?.error && (
                  <p className="writing-insights-error">{insight.error}</p>
                )}
                {insight?.summary && !insight.error && (
                  <p className="writing-insights-summary">{insight.summary}</p>
                )}
                {!insight?.summary && !insight?.error && configured && (
                  <p className="writing-insights-pending">Analyzing…</p>
                )}
                {insight?.inferredIntent && (
                  <p className="writing-insights-meta">
                    <strong>Intent:</strong> {insight.inferredIntent}
                  </p>
                )}
                {insight?.tags && insight.tags.length > 0 && (
                  <p className="writing-insights-tags">{insight.tags.join(' · ')}</p>
                )}
                {insight?.recognitionNote && (
                  <p className="writing-insights-note">{insight.recognitionNote}</p>
                )}
                {(() => {
                  const m = moodLine(insight?.mood);
                  return m ? <p className="writing-insights-mood">{m}</p> : null;
                })()}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
