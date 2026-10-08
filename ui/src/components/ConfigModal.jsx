import React, { useState, useEffect, useRef } from 'react';

export default function ConfigModal({ isOpen, onClose, scalingState, onSave }) {
  const [minFloor, setMinFloor] = useState(1);
  const [maxCap, setMaxCap] = useState(50);
  const [deadBand, setDeadBand] = useState(2);
  const [stepDown, setStepDown] = useState(1);
  const [headroom, setHeadroom] = useState(1.5);
  const [liveCopies, setLiveCopies] = useState(50);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const prevOpenRef = useRef(false);

  // Sync form values from backend when modal OPENS
  useEffect(() => {
    const justOpened = isOpen && !prevOpenRef.current;
    prevOpenRef.current = isOpen;

    if (justOpened && scalingState) {
      if (scalingState.min_floor !== undefined) setMinFloor(scalingState.min_floor);
      if (scalingState.max_cap !== undefined) setMaxCap(scalingState.max_cap);
      if (scalingState.dead_band !== undefined) setDeadBand(scalingState.dead_band);
      if (scalingState.scale_down_step !== undefined) setStepDown(scalingState.scale_down_step);
      if (scalingState.headroom !== undefined) setHeadroom(scalingState.headroom);
      if (scalingState.allocated_concurrency !== undefined) {
        setLiveCopies(scalingState.allocated_concurrency);
      }
    }
  }, [isOpen, scalingState]);

  // Early return AFTER all hooks
  if (!isOpen) return null;

  const handleApply = async () => {
    setSaving(true);
    try {
      if (onSave) {
        await onSave({
          minFloor,
          maxCap,
          deadBand,
          stepDown,
          headroom,
          provisionedConcurrency: Math.min(maxCap, Math.max(minFloor, liveCopies)),
        });
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setSaving(false);
        onClose();
      }, 700);
    } catch {
      setSaving(false);
    }
  };

  const handleMaxCapChange = (newVal) => {
    setMaxCap(newVal);
    // If live copies was matching old maxCap, track it upwards or clamp
    if (liveCopies > newVal) {
      setLiveCopies(newVal);
    }
  };

  const handleMinFloorChange = (newVal) => {
    setMinFloor(newVal);
    if (liveCopies < newVal) {
      setLiveCopies(newVal);
    }
  };

  return (
    <div className="benchmark-modal-overlay" onClick={onClose}>
      <div className="benchmark-modal-content" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="benchmark-header">
          <div>
            <div className="benchmark-title">Controller Guardrails &amp; Tuning</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--c-text-muted)', marginTop: '4px' }}>
              Dynamic Autoscaling Safety Envelope &bull; Immediately Enforced on Lambda Fleet
            </div>
          </div>
          <button className="benchmark-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '14px 0' }}>
          {/* Live Warm Concurrency */}
          <div style={{ background: 'rgba(138, 245, 242, 0.05)', padding: '12px 14px', borderRadius: '4px', border: '1px solid rgba(138, 245, 242, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--c-text-bright)' }}>
              <span style={{ fontWeight: 600 }}>Live Active Concurrency (Immediate Warm Copies)</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setLiveCopies(maxCap)}
                  style={{
                    background: 'rgba(138, 245, 242, 0.1)',
                    border: '1px solid var(--c-cyan)',
                    color: 'var(--c-cyan)',
                    fontSize: '0.65rem',
                    padding: '2px 8px',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                  }}
                  title="Match live copies directly to Max Cap"
                >
                  Set to Cap ({maxCap})
                </button>
                <span style={{ color: 'var(--c-mint)', fontWeight: 800, fontSize: '0.9rem' }}>{liveCopies} copies</span>
              </div>
            </div>
            <input
              type="range"
              min={minFloor}
              max={maxCap}
              value={Math.min(maxCap, Math.max(minFloor, liveCopies))}
              onChange={(e) => setLiveCopies(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--c-mint)', marginTop: '8px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: 'var(--c-text-muted)', marginTop: '3px' }}>
              <span>Min Floor: {minFloor}</span>
              <span style={{ color: 'var(--c-text-muted)' }}>Immediately provisioned to pool</span>
              <span>Max Cap: {maxCap}</span>
            </div>
          </div>

          {/* Min Floor */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--c-text-bright)' }}>
              <span>Min Provisioned Concurrency (Floor)</span>
              <span style={{ color: 'var(--c-mint)', fontWeight: 700 }}>{minFloor} copies</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={minFloor}
              onChange={(e) => handleMinFloorChange(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--c-mint)', marginTop: '4px' }}
            />
          </div>

          {/* Max Cap */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--c-text-bright)' }}>
              <span>Max Provisioned Concurrency (Budget Cap)</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: 'var(--c-cyan)', fontWeight: 700 }}>{maxCap} copies</span>
              </div>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={maxCap}
              onChange={(e) => handleMaxCapChange(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--c-cyan)', marginTop: '4px' }}
            />
          </div>

          {/* Dead Band */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--c-text-bright)' }}>
              <span>Flapping Dead-Band Threshold</span>
              <span style={{ color: 'var(--c-amber)', fontWeight: 700 }}>&plusmn;{deadBand} copies</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={deadBand}
              onChange={(e) => setDeadBand(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--c-amber)', marginTop: '4px' }}
            />
          </div>

          {/* Step Down */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--c-text-bright)' }}>
              <span>Smooth Scale-Down Rate Limit</span>
              <span style={{ color: 'var(--c-text-bright)', fontWeight: 700 }}>{stepDown} step / cycle</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={stepDown}
              onChange={(e) => setStepDown(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--c-white)', marginTop: '4px' }}
            />
          </div>

          {/* Headroom Multiplier */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--c-text-bright)' }}>
              <span>Headroom Multiplier (Safety Buffer)</span>
              <span style={{ color: '#b388ff', fontWeight: 700 }}>{Number(headroom || 1.5).toFixed(1)}×</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.1"
              value={headroom}
              onChange={(e) => setHeadroom(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#b388ff', marginTop: '4px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--c-text-muted)', marginTop: '2px' }}>
              <span>1.0× (tight)</span>
              <span>3.0× (generous)</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--c-border)', paddingTop: '12px' }}>
          <button className="dock-pill-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="dock-pill-btn active"
            onClick={handleApply}
            disabled={saving}
            style={saved ? { borderColor: 'var(--c-mint)', color: 'var(--c-mint)', boxShadow: '0 0 12px rgba(229,255,225,0.4)' } : undefined}
          >
            {saving ? 'ENFORCING GUARDRAILS...' : (saved ? 'GUARDRAILS APPLIED ✓' : 'Save & Apply Guardrails')}
          </button>
        </div>
      </div>
    </div>
  );
}
