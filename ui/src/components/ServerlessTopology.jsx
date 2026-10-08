import React, { useRef, useEffect, useState } from 'react';

export default function ServerlessTopology({
  selectedFunction,
  controllerMode,
  viewMode,
  scalingState,
  latestMetric,
  onOpenBenchmarks,
  onSelectFunction,
}) {
  const canvasRef = useRef(null);
  const [selectedStage, setSelectedStage] = useState('pipeline-stage-2');

  // Active metrics
  const activeConcurrency = scalingState?.allocated_concurrency ?? 2;
  const currentInvocations = latestMetric?.invocations ?? 24;
  const avgDuration = latestMetric?.avg_duration_ms ? `${Math.round(latestMetric.avg_duration_ms)}ms` : '45ms';
  const predictedRps = (currentInvocations * (controllerMode === 'q95' ? 1.4 : (controllerMode === 'q50' ? 1.05 : 1.25)) / 60.0).toFixed(2);
  const headroom = Number(scalingState?.headroom ?? 1.5);
  const rawCopies = Math.max(1, Math.ceil(parseFloat(predictedRps) * 0.045 * headroom));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationId;
    let width = 0;
    let height = 0;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.resetTransform ? ctx.resetTransform() : ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Nodes for Topology mode vs Pipeline mode
    const isMesh = viewMode === 'topology';

    const meshNodes = [
      { id: 'apigw', label: 'API Gateway', sub: 'HTTP Ingress v2', x: 0.12, y: 0.50, color: '#8AF5F2' },
      { id: 'warmify-demo', label: 'warmify-demo', sub: 'Target ML Lambda', x: 0.42, y: 0.25, color: '#E5FFE1', isTarget: true },
      { id: 'auth-authorizer', label: 'auth-authorizer', sub: 'Node.js 20', x: 0.42, y: 0.45, color: '#8AF5F2' },
      { id: 'checkout-payment', label: 'checkout-payment', sub: '1024MB Memory', x: 0.42, y: 0.65, color: '#8AF5F2' },
      { id: 'analytics-stream', label: 'analytics-stream', sub: 'Event Consumer', x: 0.42, y: 0.85, color: '#8AF5F2' },
      { id: 'dynamo', label: 'DynamoDB Table', sub: 'warmify-metrics', x: 0.72, y: 0.35, color: '#E5FFE1' },
      { id: 'controller', label: 'Warmify Controller', sub: 'Quantile AutoScaler', x: 0.72, y: 0.68, color: '#FFA02E' },
      { id: 'cloudwatch', label: 'CloudWatch Alarms', sub: 'Metrics & Logs', x: 0.88, y: 0.50, color: '#8AF5F2' },
    ];

    const pipelineNodes = [
      { id: 'cw', label: 'CloudWatch Stream', sub: '1-min Invocations', x: 0.12, y: 0.50, color: '#8AF5F2' },
      { id: 'collector', label: 'Warmify Collector', sub: 'EventBridge Cron', x: 0.30, y: 0.35, color: '#8AF5F2' },
      { id: 'dynamo', label: 'DynamoDB Table', sub: 'warmify-metrics', x: 0.50, y: 0.25, color: '#E5FFE1' },
      { id: 'controller', label: 'Quantile Regressor', sub: '10-min Forecast', x: 0.70, y: 0.40, color: '#FFA02E' },
      { id: 'lambda', label: 'warmify-demo:prod', sub: `${activeConcurrency} Provisioned Copies`, x: 0.88, y: 0.55, color: '#E5FFE1', isTarget: true },
    ];

    const nodes = isMesh ? meshNodes : pipelineNodes;

    const links = isMesh
      ? [
          [0, 1], [0, 2], [0, 3], [0, 4],
          [1, 5], [2, 5], [3, 5], [4, 5],
          [5, 6], [6, 1], [6, 7], [1, 7]
        ]
      : [
          [0, 1], [1, 2], [2, 3], [3, 4], [0, 4]
        ];

    // Data packet animations
    const packets = [];
    for (let i = 0; i < (isMesh ? 34 : 22); i++) {
      packets.push({
        linkIdx: Math.floor(Math.random() * links.length),
        progress: Math.random(),
        speed: 0.007 + Math.random() * 0.009,
      });
    }

    let pulseTime = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      pulseTime += 0.035;

      // Draw subtle circuit grid background
      ctx.strokeStyle = 'rgba(138, 245, 242, 0.05)';
      ctx.lineWidth = 1;
      const step = 28;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw links
      links.forEach(([fromIdx, toIdx]) => {
        const from = nodes[fromIdx];
        const to = nodes[toIdx];
        if (!from || !to) return;
        const fx = from.x * width;
        const fy = from.y * height;
        const tx = to.x * width;
        const ty = to.y * height;

        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = 'rgba(138, 245, 242, 0.25)';
        ctx.lineWidth = 1.3;
        ctx.stroke();
      });

      // Animate packets
      packets.forEach((p) => {
        p.progress += p.speed;
        if (p.progress >= 1) {
          p.progress = 0;
          p.linkIdx = Math.floor(Math.random() * links.length);
        }
        const [fIdx, tIdx] = links[p.linkIdx % links.length];
        const f = nodes[fIdx];
        const t = nodes[tIdx];
        if (!f || !t) return;
        const px = f.x * width + (t.x * width - f.x * width) * p.progress;
        const py = f.y * height + (t.y * height - f.y * height) * p.progress;

        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#8AF5F2';
        ctx.shadowColor = '#8AF5F2';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw nodes
      nodes.forEach((n) => {
        const nx = n.x * width;
        const ny = n.y * height;
        const isPulse = n.isTarget;

        // Outer glow
        ctx.beginPath();
        ctx.arc(nx, ny, isPulse ? 16 + Math.sin(pulseTime) * 3 : 13, 0, Math.PI * 2);
        ctx.fillStyle = n.color === '#E5FFE1' ? 'rgba(229, 255, 225, 0.16)' : 'rgba(138, 245, 242, 0.14)';
        ctx.fill();

        // Node center
        ctx.beginPath();
        ctx.arc(nx, ny, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.font = '600 11px Orbitron, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, nx, ny - 14);

        ctx.font = '500 9px "Share Tech Mono", monospace';
        ctx.fillStyle = '#B8D0DE';
        ctx.fillText(n.sub, nx, ny + 18);
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [viewMode, activeConcurrency]);

  return (
    <div className="center-main-panel">
      {/* Top Header Strip */}
      <div className="center-header-strip">
        <span className="center-title">
          {viewMode === 'topology' ? 'Serverless Cloud Architecture Mesh' : 'Predictive Little\'s Law Pipeline'}
        </span>
        <div className="center-sub-badges">
          <span className="pill-badge">AWS Region: us-east-1</span>
          <span className="pill-badge active-green">Zero Cold Starts Active</span>
          <button
            className="pill-badge"
            style={{ cursor: 'pointer', borderColor: 'var(--c-mint)', color: 'var(--c-mint)' }}
            onClick={onOpenBenchmarks}
          >
            A/B Evaluation Benchmark &rarr;
          </button>
        </div>
      </div>

      {/* 5-Stage Live Concurrency Flow Pipeline */}
      <div className="pipeline-flow-rack">
        {/* Stage 1 */}
        <div
          className={`pipeline-stage-card ${selectedStage === 'stage-1' ? 'highlight' : ''}`}
          onClick={() => setSelectedStage('stage-1')}
          style={{ cursor: 'pointer' }}
        >
          <span className="pipeline-stage-num">01 // INGESTION</span>
          <span className="pipeline-stage-title">CloudWatch</span>
          <span className="pipeline-stage-metric">{currentInvocations} req/m</span>
          <span className="pipeline-stage-formula">Avg Dur: {avgDuration}</span>
        </div>

        {/* Stage 2 */}
        <div
          className={`pipeline-stage-card ${selectedStage === 'stage-2' || selectedStage === 'pipeline-stage-2' ? 'highlight' : ''}`}
          onClick={() => setSelectedStage('stage-2')}
          style={{ cursor: 'pointer' }}
        >
          <span className="pipeline-stage-num">02 // FORECAST</span>
          <span className="pipeline-stage-title">Quantile ML (+10m)</span>
          <span className="pipeline-stage-metric">{predictedRps} RPS</span>
          <span className="pipeline-stage-formula">Model: {controllerMode.toUpperCase()} Regressor &bull; 10m Ahead</span>
        </div>

        {/* Stage 3 */}
        <div
          className={`pipeline-stage-card ${selectedStage === 'stage-3' ? 'highlight' : ''}`}
          onClick={() => setSelectedStage('stage-3')}
          style={{ cursor: 'pointer' }}
        >
          <span className="pipeline-stage-num">03 // CAPACITY</span>
          <span className="pipeline-stage-title">Little's Law</span>
          <span className="pipeline-stage-metric">{rawCopies} Copies</span>
          <span className="pipeline-stage-formula">
            L = ⌈RPS &times; W &times; {Number(scalingState?.headroom || 1.5).toFixed(1)}⌉
          </span>
        </div>

        {/* Stage 4 */}
        <div
          className={`pipeline-stage-card ${selectedStage === 'stage-4' ? 'highlight' : ''}`}
          onClick={() => setSelectedStage('stage-4')}
          style={{ cursor: 'pointer' }}
        >
          <span className="pipeline-stage-num">04 // GUARDRAILS</span>
          <span className="pipeline-stage-title">Safety Check</span>
          <span className="pipeline-stage-metric">PASS</span>
          <span className="pipeline-stage-formula">
            Floor:{scalingState?.min_floor ?? 1} | Cap:{scalingState?.max_cap ?? 50} | Deadband:{scalingState?.dead_band ?? 2}
          </span>
        </div>

        {/* Stage 5 */}
        <div
          className={`pipeline-stage-card ${selectedStage === 'stage-5' ? 'highlight' : ''}`}
          onClick={() => setSelectedStage('stage-5')}
          style={{ cursor: 'pointer' }}
        >
          <span className="pipeline-stage-num">05 // ALLOCATION</span>
          <span className="pipeline-stage-title">Provisioned PC</span>
          <span className="pipeline-stage-metric">{activeConcurrency} Warm</span>
          <span className="pipeline-stage-formula">0ms Cold Start Suppression</span>
        </div>
      </div>

      {/* Interactive Topology / Pipeline Canvas */}
      <div style={{ position: 'relative', flex: 1, width: '100%', minHeight: 180 }}>
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
