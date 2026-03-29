import { useState } from 'react';
import { CALIBRATION_PROMPT } from './BaselineCalibrator';
import './CalibrationModal.css';

interface CalibrationModalProps {
  onStartCalibration: () => void;
  onDismiss: () => void;
  isFirstLaunch: boolean;
}

export function CalibrationModal({ onStartCalibration, onDismiss, isFirstLaunch }: CalibrationModalProps) {
  const [started, setStarted] = useState(false);

  function handleStart() {
    setStarted(true);
    onStartCalibration();
  }

  return (
    <div className="calibration-backdrop" onClick={isFirstLaunch ? undefined : onDismiss}>
      <div className="calibration-modal" onClick={e => e.stopPropagation()}>
        {!isFirstLaunch && (
          <button className="calibration-close" onClick={onDismiss} aria-label="Close">✕</button>
        )}

        <div className="calibration-icon">✍️</div>
        <h2 className="calibration-title">
          {isFirstLaunch ? 'Personalise emotion detection' : 'Recalibrate baseline'}
        </h2>
        <p className="calibration-body">
          Write the sentence below <strong>naturally and without thinking about it</strong>.
          This sets your personal baseline so emotion detection is tailored to you,
          not population averages.
        </p>

        <div className="calibration-prompt">{CALIBRATION_PROMPT}</div>

        {started ? (
          <p className="calibration-hint">
            Write on the canvas now, then click <strong>Done</strong> in the toolbar.
          </p>
        ) : (
          <div className="calibration-actions">
            <button className="calibration-btn calibration-btn-primary" onClick={handleStart}>
              Start writing
            </button>
            {!isFirstLaunch && (
              <button className="calibration-btn" onClick={onDismiss}>Cancel</button>
            )}
            {isFirstLaunch && (
              <button className="calibration-btn" onClick={onDismiss}>Skip for now</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
