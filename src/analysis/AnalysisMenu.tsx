import { useState, useRef, useEffect } from 'react';
import './AnalysisMenu.css';

interface AnalysisMenuProps {
  isCalibrating: boolean;
  isAssessmentActive: boolean;
  onStartBaseline: () => void;
  onFinishBaseline: () => void;
  onStartAssessment: () => void;
  onStopAssessment: () => void;
}

export function AnalysisMenu({
  isCalibrating,
  isAssessmentActive,
  onStartBaseline,
  onFinishBaseline,
  onStartAssessment,
  onStopAssessment,
}: AnalysisMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function handleBaselineClick() {
    if (isCalibrating) {
      onFinishBaseline();
    } else {
      onStartBaseline();
    }
    setOpen(false);
  }

  function handleAssessmentClick() {
    if (isAssessmentActive) {
      onStopAssessment();
    } else {
      onStartAssessment();
    }
    setOpen(false);
  }

  return (
    <div className="analysis-menu" ref={ref}>
      <button
        className={`analysis-menu-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Writing analysis controls"
        aria-label="Writing analysis menu"
        aria-expanded={open}
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      {open && (
        <div className="analysis-menu-panel" role="menu">
          <div className="analysis-menu-header">Writing Analysis</div>

          <button
            className={`analysis-menu-item${isCalibrating ? ' item-active' : ''}`}
            onClick={handleBaselineClick}
            role="menuitem"
          >
            <span className="analysis-menu-item-icon">
              {isCalibrating ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              )}
            </span>
            <span className="analysis-menu-item-text">
              <strong>{isCalibrating ? 'Finish baseline recording' : 'Record baseline'}</strong>
              <small>{isCalibrating ? 'Save your calibration strokes' : 'Personalise detection to your handwriting'}</small>
            </span>
          </button>

          <div className="analysis-menu-divider" />

          <button
            className={`analysis-menu-item${isAssessmentActive ? ' item-active' : ''}`}
            onClick={handleAssessmentClick}
            role="menuitem"
          >
            <span className="analysis-menu-item-icon">
              {isAssessmentActive ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4l14 8-14 8V4z" />
                </svg>
              )}
            </span>
            <span className="analysis-menu-item-text">
              <strong>{isAssessmentActive ? 'Stop assessment' : 'Start assessment'}</strong>
              <small>{isAssessmentActive ? 'Pause emotion analysis' : 'Resume emotion analysis'}</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
