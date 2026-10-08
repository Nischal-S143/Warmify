import React from 'react';

export default function HealthModal({ isOpen, onClose, healthData }) {
  if (!isOpen) return null;

  const components = healthData?.components || {};
  const overall = healthData?.overall || 'healthy';

  return (
    <div className="benchmark-modal-overlay" onClick={onClose}>
      <div className="benchmark-modal-content" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="benchmark-header">
          <div>
            <div className="benchmark-title">System Health & Cloud Infrastructure Status</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--c-text-muted)', marginTop: '4px' }}>
              Checked At: {healthData?.checked_at || 'Live'} &bull; Overall: {overall.toUpperCase()}
            </div>
          </div>
          <button className="benchmark-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', margin: '14px 0' }}>
          {Object.entries(components).map(([name, comp]) => (
            <div
              key={name}
              style={{
                background: 'rgba(6, 12, 16, 0.9)',
                border: '1px solid rgba(138, 245, 242, 0.2)',
                borderRadius: '6px',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--c-white)' }}>
                  {name.toUpperCase()}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--c-text-muted)' }}>
                  {comp.table ? `Table: ${comp.table}` : (comp.function_state ? `State: ${comp.function_state}` : 'Service Verification OK')}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: comp.status === 'healthy' ? 'var(--c-mint)' : 'var(--c-red)',
                    boxShadow: comp.status === 'healthy' ? '0 0 8px var(--c-mint)' : '0 0 8px var(--c-red)',
                  }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--c-mint)', fontWeight: 700 }}>
                  {comp.latency_ms ? `${comp.latency_ms} ms` : 'ONLINE'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--c-border)', paddingTop: '12px' }}>
          <button className="dock-pill-btn active" onClick={onClose}>
            Close Health Status
          </button>
        </div>
      </div>
    </div>
  );
}
