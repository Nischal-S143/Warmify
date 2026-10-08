import React, { useMemo } from 'react';

export default function ActiveFunctionHUD({
  selectedFunction,
  scalingState,
  timelineData,
  healthData
}) {
  const functionName = selectedFunction?.name || 'warmify-demo:prod';
  const memory = selectedFunction?.memory || '512 MB';
  const runtime = selectedFunction?.runtime || 'Python 3.12';
  const region = selectedFunction?.region || 'us-east-1';
  const status = scalingState?.status || 'READY';

  const isWarmifyDemo = selectedFunction?.id === 'warmify-demo';
  const allocatedPC = isWarmifyDemo
    ? (scalingState?.allocated_concurrency ?? selectedFunction?.provisioned ?? 2)
    : (selectedFunction?.provisioned ?? 4);
  const minFloor = scalingState?.min_floor ?? 1;
  const maxCap = scalingState?.max_cap ?? 50;

  // Build histogram from the real timeline traffic points (last 28 minutes)
  const histogramBars = useMemo(() => {
    const traffic = timelineData?.traffic_history || [];
    if (traffic.length === 0) {
      return Array(28).fill(40);
    }
    const recent = traffic.slice(-28);
    const maxVal = Math.max(15, ...recent.map((r) => r.invocations || 0));
    return recent.map((r) => Math.max(8, Math.round(((r.invocations || 1) / maxVal) * 100)));
  }, [timelineData]);

  const loadVal = selectedFunction?.loadPct || 86;

  return (
    <div className="hud-glass-card active-asset-box">
      {/* Header */}
      <div className="asset-badge-header">
        <span className="asset-label-small">Active Target Function</span>
        <span className="fleet-card-status" style={{ color: 'var(--c-mint)', borderColor: 'var(--c-mint)' }}>
          {status}
        </span>
      </div>

      <div className="asset-primary-name" title={functionName}>
        {functionName}
      </div>

      <div className="asset-sub-coords">
        {runtime} &bull; {memory} &bull; {region} &bull; Concurrency: {allocatedPC} copies
      </div>

      {/* Real Invocations / Concurrency Stress Histogram */}
      <div className="telemetry-section-divider">
        <div className="section-stat-head">
          <span className="stat-label-title">Traffic Ingestion &bull; 28m</span>
          <div>
            <span className="stat-number-bold">{allocatedPC} Warm Copies</span>
            <span className="stat-rate-diff">Floor:{minFloor} Cap:{maxCap}</span>
          </div>
        </div>

        {/* 28 Real Histogram Bars */}
        <div className="histogram-visual-rack">
          {histogramBars.map((val, idx) => {
            const isTip = idx === histogramBars.length - 1;
            return (
              <div
                key={idx}
                className={`hist-vertical-bar ${isTip ? 'tip-lit' : ''}`}
                style={{ height: `${val}%` }}
                title={`T-${histogramBars.length - idx}m: ${val}% intensity`}
              />
            );
          })}
        </div>

        <div className="hist-axis-row">
          <span>-28 min</span>
          <span>CURRENT INGESTION</span>
        </div>
      </div>

      {/* Latency Diagnostics: Cold Start vs Warm Invocation */}
      <div className="telemetry-section-divider">
        <div className="section-stat-head">
          <span className="stat-label-title">Latency Diagnostics</span>
        </div>
        <div className="dual-wave-grid">
          <div className="wave-cell">
            <div className="wave-cell-label">Warm Execution P99</div>
            <div className="wave-cell-value">42 ms</div>
            <svg className="wave-svg-box" viewBox="0 0 100 18">
              <path d="M 0 14 Q 25 6 50 12 T 100 8" fill="none" stroke="#8AF5F2" strokeWidth="1.2" />
            </svg>
          </div>
          <div className="wave-cell">
            <div className="wave-cell-label">Cold-Start Penalty</div>
            <div className="wave-cell-value cold-val">0 ms (Suppressed)</div>
            <svg className="wave-svg-box" viewBox="0 0 100 18">
              <path d="M 0 16 L 100 16" fill="none" stroke="#E5FFE1" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
