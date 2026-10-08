import React from 'react';
import { Cpu, ShieldCheck, CreditCard, Activity, Radio } from 'lucide-react';

/**
 * Dashed / Segmented Progress Bar — 14 segments matching the monitor layout
 */
function DashedBar({ value = 0, totalSegs = 14, variant = 'cyan' }) {
  const litCount = Math.min(totalSegs, Math.max(0, Math.round((value / 100) * totalSegs)));
  return (
    <div className="dashed-bar-track">
      {[...Array(totalSegs)].map((_, i) => (
        <span
          key={i}
          className={`dashed-bar-seg ${i < litCount ? (variant === 'mint' ? 'lit-mint' : 'lit') : ''}`}
        />
      ))}
    </div>
  );
}

/**
 * Clean Serverless Service Icon Badge (replaces old crowded badge)
 */
function ServiceIcon({ fn, isSelected }) {
  const iconProps = {
    size: 20,
    color: isSelected ? 'var(--c-mint)' : 'var(--c-cyan)',
    strokeWidth: 2.2,
  };

  const getIcon = () => {
    switch (fn.icon) {
      case 'cpu': return <Cpu {...iconProps} />;
      case 'shield': return <ShieldCheck {...iconProps} />;
      case 'card': return <CreditCard {...iconProps} />;
      case 'activity': return <Activity {...iconProps} />;
      case 'radio': return <Radio {...iconProps} />;
      default: return <Cpu {...iconProps} />;
    }
  };

  return (
    <div className="fleet-icon-badge">
      <div className={`icon-frame ${fn.id === 'warmify-demo' ? 'target-badge' : ''}`}>
        {getIcon()}
      </div>
      <span className="icon-runtime-pill">{fn.runtimeTag}</span>
    </div>
  );
}

export default function FunctionFleet({
  functions,
  selectedFuncId,
  onSelectFunc,
  controllerMode,
  onChangeMode
}) {
  const modes = [
    { id: 'q90', label: 'Predictive (Q90)' },
    { id: 'q95', label: 'Confident (Q95)' },
    { id: 'q50', label: 'Economic (Q50)' },
    { id: 'reactive', label: 'Reactive (AWS)' },
  ];

  return (
    <aside className="left-sidebar">
      <div>
        <div className="sidebar-title-row">
          <span className="fleet-title">Lambda Fleet</span>
          <div className="title-status-bars">
            <span className="stat-dash amber" title="Surge Buffer Active" />
            <span className="stat-dash cyan" title="CloudWatch Ingestion Active" />
            <span className="stat-dash" />
          </div>
        </div>

        {/* Controller Scaling Mode */}
        <div className="mode-section-label">Quantile Scaling Mode</div>
        <div className="mission-mode-grid">
          {modes.map((m) => (
            <button
              key={m.id}
              className={`mission-pill-btn ${controllerMode === m.id ? 'active' : ''}`}
              onClick={() => onChangeMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Function Cards */}
      <div className="fleet-units-scroll">
        {functions.map((fn) => {
          const isSelected = fn.id === selectedFuncId;
          const isReady = fn.status === 'READY' || fn.status === 'Ready' || fn.status === 'Nominal';

          return (
            <div
              key={fn.id}
              className={`fleet-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectFunc(fn.id)}
            >
              {/* Service Icon Badge */}
              <ServiceIcon fn={fn} isSelected={isSelected} />

              {/* Card Info & Telemetry */}
              <div className="fleet-card-info">
                <div className="fleet-card-header">
                  <span className="fleet-card-name">{fn.displayName}</span>
                  <span
                    className="fleet-card-status"
                    style={
                      fn.id === 'warmify-demo'
                        ? { color: 'var(--c-mint)', borderColor: 'var(--c-mint)' }
                        : undefined
                    }
                  >
                    {fn.status}
                  </span>
                </div>

                <div className="fleet-card-sub">
                  <span>{fn.name}</span>
                  <span>&bull;</span>
                  <span>{fn.memory}</span>
                </div>

                <div className="fleet-metric-row">
                  <span>Warm Capacity</span>
                  <span className="metric-val">{fn.provisioned} / {fn.desired} Copies</span>
                </div>

                {/* Concurrency Load Progress Bar */}
                <div className="fleet-metric-bar-row">
                  <div className="fleet-metric-bar-header">
                    <span>Concurrency Load</span>
                    <span className="bar-pct">{fn.loadPct}%</span>
                  </div>
                  <DashedBar
                    value={fn.loadPct}
                    totalSegs={14}
                    variant={fn.id === 'warmify-demo' ? 'mint' : 'cyan'}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
