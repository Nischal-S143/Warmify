import React from 'react';

export default function PredictionHorizon({ timelineData, scalingState }) {
  const traffic = timelineData?.traffic_history || [];
  const forecasts = timelineData?.forecasts || [];
  const warmCopies = timelineData?.warm_copy_history || [];
  const coldStarts = timelineData?.cold_start_events || [];

  // SVG dimensions
  const svgW = 680;
  const svgH = 65;
  const padTop = 8;
  const padBottom = 16;
  const graphH = svgH - padTop - padBottom;

  // Compute maximum invocations for scaling Y axis
  const maxInv = Math.max(
    30,
    ...traffic.map((t) => t.invocations || 0),
    ...forecasts.map((f) => f.q90 || 0)
  );

  // Compute points for traffic history
  const totalPoints = Math.max(traffic.length, 1);
  const stepX = (svgW - 120) / Math.max(totalPoints - 1, 1);

  const trafficPoints = traffic.map((item, idx) => {
    const x = idx * stepX;
    const y = padTop + graphH - (item.invocations / maxInv) * graphH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const trafficPath = trafficPoints.length > 0 ? `M ${trafficPoints.join(' L ')}` : '';

  // Forecast points (forward 10m from the last point)
  const lastX = traffic.length > 0 ? (traffic.length - 1) * stepX : 0;
  const lastY = traffic.length > 0 ? padTop + graphH - (traffic[traffic.length - 1].invocations / maxInv) * graphH : padTop + graphH / 2;
  
  const latestForecast = forecasts[forecasts.length - 1];
  const q90Val = latestForecast?.q90 || (traffic[traffic.length - 1]?.invocations || 15) * 1.35;
  const forecastY = padTop + graphH - (q90Val / maxInv) * graphH;
  const forecastEndX = svgW - 10;
  const forecastPath = `M ${lastX.toFixed(1)},${lastY.toFixed(1)} L ${forecastEndX.toFixed(1)},${forecastY.toFixed(1)}`;

  // Provisioned Concurrency stepped line
  const maxPC = Math.max(10, ...warmCopies.map((w) => w.provisioned_concurrency || 1));
  const pcPoints = warmCopies.map((item, idx) => {
    const x = idx * stepX;
    const y = padTop + graphH - (item.provisioned_concurrency / maxPC) * graphH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pcPath = pcPoints.length > 0 ? `M ${pcPoints.join(' L ')} H ${svgW - 10}` : '';

  return (
    <div className="central-horizon-strip">
      <div className="strip-top-row">
        <div>
          <span>PREDICTIVE CONCURRENCY TIMELINE [ -60m HISTORY &bull; NOW &bull; +10m FORWARD ]</span>
          <span style={{ marginLeft: '10px', color: '#FFA02E', fontWeight: 700, fontSize: '0.74rem', background: 'rgba(255, 160, 46, 0.1)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255, 160, 46, 0.3)' }}>
            +10m Target: {Math.round(q90Val)} req/min ({(q90Val / 60.0).toFixed(2)} RPS)
          </span>
        </div>
        <div className="horizon-legend">
          <div className="legend-item">
            <span className="legend-line actual" />
            <span>Actual Requests</span>
          </div>
          <div className="legend-item">
            <span className="legend-line q90" />
            <span>Q90 Forecast</span>
          </div>
          <div className="legend-item">
            <span className="legend-line pc" />
            <span>Provisioned Concurrency</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot cold" />
            <span>Cold Start</span>
          </div>
        </div>
      </div>

      <svg className="strip-svg-canvas" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
        {/* Subtle grid lines */}
        <line x1="0" y1={padTop + graphH * 0.25} x2={svgW} y2={padTop + graphH * 0.25} stroke="rgba(138,245,242,0.08)" strokeDasharray="3 4" />
        <line x1="0" y1={padTop + graphH * 0.75} x2={svgW} y2={padTop + graphH * 0.75} stroke="rgba(138,245,242,0.08)" strokeDasharray="3 4" />

        {/* Provisioned Concurrency Step Path (Mint Green) */}
        {pcPath && (
          <path d={pcPath} fill="none" stroke="#E5FFE1" strokeWidth="2" strokeDasharray="4 2" opacity="0.9" />
        )}

        {/* Actual Request Rate Path (Cyan) */}
        {trafficPath && (
          <path d={trafficPath} fill="none" stroke="#8AF5F2" strokeWidth="1.8" />
        )}

        {/* Q90 Forward Forecast Line (Amber Dashed) */}
        <path d={forecastPath} fill="none" stroke="#FFA02E" strokeWidth="2.4" strokeDasharray="4 3" />

        {/* Forecast Endpoint Glowing Marker */}
        <circle cx={forecastEndX} cy={forecastY} r="4" fill="#FFA02E" stroke="#FFFFFF" strokeWidth="1.2" />
        <circle cx={forecastEndX} cy={forecastY} r="7" fill="none" stroke="#FFA02E" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />

        {/* Cold Start Event Markers (if any occurred) */}
        {coldStarts.map((cs, idx) => (
          <circle key={idx} cx={Math.min(svgW - 130, idx * 80 + 40)} cy={padTop + graphH * 0.2} r="3.5" fill="#FF4B3A" />
        ))}

        {/* NOW Vertical Marker */}
        <line x1={lastX} y1={padTop} x2={lastX} y2={padTop + graphH} stroke="#E5FFE1" strokeWidth="1.2" strokeDasharray="2 2" />
        <circle cx={lastX} cy={lastY} r="3.5" fill="#8AF5F2" stroke="#FFFFFF" strokeWidth="1" />
        <text x={lastX + 6} y={svgH - 2} fill="#E5FFE1" fontSize="9" fontFamily="Share Tech Mono">NOW</text>

        {/* +10M Forecast Callout */}
        <text x={svgW - 110} y={svgH - 2} fill="#FFA02E" fontSize="9" fontFamily="Share Tech Mono" fontWeight="700">
          +10M: {Math.round(q90Val)} req/m
        </text>
      </svg>
    </div>
  );
}
