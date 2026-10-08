import React from 'react';

export default function BottomDock({ viewMode, onChangeView, onOpenBenchmarks, utcTime }) {
  const modes = [
    { id: 'pipeline', label: 'Pipeline View' },
    { id: 'topology', label: 'Cloud Mesh' },
  ];

  return (
    <footer className="bottom-dock">
      {modes.map((m) => (
        <button
          key={m.id}
          className={`dock-pill-btn ${viewMode === m.id ? 'active' : ''}`}
          onClick={() => onChangeView(m.id)}
        >
          {m.label}
        </button>
      ))}

      <button
        className="dock-pill-btn"
        onClick={onOpenBenchmarks}
        style={{ borderColor: 'rgba(229, 255, 225, 0.4)', color: 'var(--c-mint)' }}
      >
        A/B Evaluation Arms
      </button>

      {/* Live Telemetry Pill with Pulsing Red Beacon */}
      <button className="dock-pill-btn live-active" title="Direct Telemetry Stream Linked">
        <span className="live-beacon-dot" /> ((●)) Live Ingestion
      </button>

      {/* UTC Clock */}
      <div className="dock-pill-btn" title="Coordinated Universal Time">
        {utcTime} UTC
      </div>
    </footer>
  );
}
