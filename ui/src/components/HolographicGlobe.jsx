import React, { useRef, useEffect } from 'react';

export default function HolographicGlobe({
  selectedFunction,
  controllerMode,
  viewMode,
  utcTime
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationId;
    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.resetTransform ? ctx.resetTransform() : ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      cx = width / 2;
      cy = height / 2;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const sphereR = Math.min(width, height) * 0.36;

    // Dot Matrix Planet Surface
    const numPoints = 280;
    const spherePoints = [];
    for (let i = 0; i < numPoints; i++) {
      const lat = (Math.random() - 0.5) * Math.PI;
      const lon = Math.random() * Math.PI * 2;
      spherePoints.push({
        lat,
        lon,
        size: 0.9 + Math.random() * 1.5,
      });
    }

    // Tilted Orbital Rings
    const orbits = [
      { rx: sphereR * 1.34, ry: sphereR * 0.38, tilt: -0.24, dash: [4, 6] },
      { rx: sphereR * 1.56, ry: sphereR * 0.45, tilt: 0.38, dash: [8, 8] },
      { rx: sphereR * 1.74, ry: sphereR * 0.52, tilt: -0.52, dash: [3, 9] },
      { rx: sphereR * 1.46, ry: sphereR * 0.40, tilt: 0.16, dash: [] },
      { rx: sphereR * 1.88, ry: sphereR * 0.58, tilt: -0.08, dash: [5, 5] },
    ];

    // Execution Nodes mapped to AWS Lambda Fleet
    const nodes = [
      { id: 'warmify-demo-func', name: 'demo-func:prod', orbitIdx: 0, angle: 0.25, speed: 0.0032, color: '#8AF5F2' },
      { id: 'auth-authorizer', name: 'auth:prod', orbitIdx: 0, angle: 3.42, speed: 0.0032, color: '#E5FFE1' },
      { id: 'checkout-payment', name: 'checkout:prod', orbitIdx: 1, angle: 1.85, speed: 0.0028, color: '#8AF5F2' },
      { id: 'analytics-stream', name: 'analytics:prod', orbitIdx: 2, angle: 4.60, speed: 0.0022, color: '#E5FFE1' },
      { id: 'billing-webhook', name: 'billing:prod', orbitIdx: 3, angle: 2.10, speed: 0.0038, color: '#8AF5F2' },
    ];

    // Traffic streaming packets
    const trafficPackets = [];
    for (let i = 0; i < 46; i++) {
      trafficPackets.push({
        orbitIdx: Math.floor(Math.random() * orbits.length),
        angle: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.007,
        size: 1.1 + Math.random() * 1.6,
        color: Math.random() > 0.35 ? '#8AF5F2' : (Math.random() > 0.5 ? '#E5FFE1' : '#FF4B3A')
      });
    }

    let rotationAngle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (viewMode === '3d') {
        render3D();
      } else if (viewMode === '2d') {
        render2D();
      } else {
        renderRegional();
      }

      animationId = requestAnimationFrame(render);
    };

    function render3D() {
      rotationAngle += 0.0014;

      ctx.save();
      ctx.translate(cx, cy);

      // 1. Dark Sphere Base
      ctx.beginPath();
      ctx.arc(0, 0, sphereR, 0, Math.PI * 2);
      ctx.fillStyle = '#050B0E';
      ctx.fill();

      // 2. Atmospheric Crescent Glow (#E5FFE1 -> #8AF5F2)
      // Matches the signature top-right rim glow from the reference image
      const rimGrad = ctx.createRadialGradient(
        sphereR * 0.65, -sphereR * 0.65, sphereR * 0.08,
        sphereR * 0.52, -sphereR * 0.52, sphereR * 1.25
      );
      rimGrad.addColorStop(0.0, 'rgba(229, 255, 225, 0.65)'); // #E5FFE1 Mint
      rimGrad.addColorStop(0.3, 'rgba(138, 245, 242, 0.28)'); // #8AF5F2 Cyan
      rimGrad.addColorStop(0.65, 'rgba(10, 24, 28, 0.06)');
      rimGrad.addColorStop(1.0, 'transparent');

      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(0, 0, sphereR + 6, 0, Math.PI * 2);
      ctx.fill();

      // 3. Crisp Top-Right Horizon Arc Stroke
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, sphereR, -Math.PI * 0.55, 0.15);
      ctx.strokeStyle = '#E5FFE1';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#E5FFE1';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();

      // 4. Subtle Outer Silhouette
      ctx.strokeStyle = 'rgba(138, 245, 242, 0.22)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, sphereR, 0, Math.PI * 2);
      ctx.stroke();

      // 5. Rotating Surface Dot Matrix
      spherePoints.forEach(p => {
        const curLon = p.lon + rotationAngle;
        const x = Math.cos(p.lat) * Math.sin(curLon);
        const y = Math.sin(p.lat);
        const z = Math.cos(p.lat) * Math.cos(curLon);

        if (z > 0) {
          const px = x * sphereR;
          const py = y * sphereR;
          const alpha = Math.max(0.12, (z * 0.75));
          const isNearGlow = (px > 0 && py < 0);

          ctx.fillStyle = isNearGlow
            ? `rgba(229, 255, 225, ${alpha * 1.2})`
            : `rgba(138, 245, 242, ${alpha})`;

          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 6. Equator Ring
      ctx.strokeStyle = 'rgba(138, 245, 242, 0.12)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(0, 0, sphereR, sphereR * 0.26, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 7. Glowing Lambda Core Symbol (λ)
      ctx.font = '700 24px "Orbitron", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#8AF5F2';
      ctx.shadowBlur = 14;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('λ', 0, 0);
      ctx.shadowBlur = 0;

      ctx.restore();

      // 8. Tilted Orbital Execution Rings
      orbits.forEach(orb => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(orb.tilt);
        ctx.strokeStyle = 'rgba(138, 245, 242, 0.22)';
        ctx.lineWidth = 0.9;
        ctx.setLineDash(orb.dash);
        ctx.beginPath();
        ctx.ellipse(0, 0, orb.rx, orb.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // 9. Traffic Stream Packets
      trafficPackets.forEach(p => {
        p.angle += p.speed;
        const orb = orbits[p.orbitIdx];

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(orb.tilt);

        const px = Math.cos(p.angle) * orb.rx;
        const py = Math.sin(p.angle) * orb.ry;

        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 10. Execution Unit Reticles & Leader Lines
      nodes.forEach(node => {
        node.angle += node.speed;
        const orb = orbits[node.orbitIdx];
        const cosA = Math.cos(node.angle);
        const sinA = Math.sin(node.angle);
        const ex = cosA * orb.rx;
        const ey = sinA * orb.ry;
        const nx = cx + (ex * Math.cos(orb.tilt) - ey * Math.sin(orb.tilt));
        const ny = cy + (ex * Math.sin(orb.tilt) + ey * Math.cos(orb.tilt));

        const isSelected = selectedFunction?.id?.includes(node.id) || (node.id === 'warmify-demo-func' && !selectedFunction);

        ctx.save();

        if (isSelected) {
          // Cyan Targeting Reticle
          ctx.strokeStyle = '#8AF5F2';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(nx, ny, 11, 0, Math.PI * 2);
          ctx.stroke();

          // 4 Crosshairs
          const dist = 15;
          const len = 4;
          ctx.beginPath();
          ctx.moveTo(nx - dist - len, ny); ctx.lineTo(nx - dist, ny);
          ctx.moveTo(nx + dist, ny); ctx.lineTo(nx + dist + len, ny);
          ctx.moveTo(nx, ny - dist - len); ctx.lineTo(nx, ny - dist);
          ctx.moveTo(nx, ny + dist); ctx.lineTo(nx, ny + dist + len);
          ctx.stroke();

          // Angled Dashed Leader Line
          ctx.strokeStyle = 'rgba(229, 255, 225, 0.7)';
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(nx + 9, ny - 7);
          ctx.lineTo(nx + 32, ny - 24);
          ctx.lineTo(nx + 130, ny - 24);
          ctx.stroke();
          ctx.setLineDash([]);

          // HUD Floating Badge
          ctx.fillStyle = 'rgba(6, 12, 16, 0.90)';
          ctx.strokeStyle = 'rgba(138, 245, 242, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(nx + 28, ny - 44, 130, 38, 4);
          ctx.fill();
          ctx.stroke();

          // Text in Orbitron
          ctx.font = '700 10.5px "Orbitron", sans-serif';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText((selectedFunction?.shortName || node.name).toUpperCase(), nx + 34, ny - 29);

          ctx.font = '500 8.5px "Share Tech Mono", monospace';
          ctx.fillStyle = '#E5FFE1';
          ctx.fillText(`WARM: ${selectedFunction?.provisioned || 12} / DES: ${selectedFunction?.desired || 15} PC`, nx + 34, ny - 15);

          // Glowing Node Center
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = '#8AF5F2';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(nx, ny, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = node.color;
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = '500 8.5px "Share Tech Mono", monospace';
          ctx.fillStyle = 'rgba(110, 128, 125, 0.9)';
          ctx.fillText(node.name, nx + 7, ny + 3);
        }

        ctx.restore();
      });
    }

    function render2D() {
      ctx.save();
      ctx.strokeStyle = 'rgba(138, 245, 242, 0.12)';
      ctx.lineWidth = 0.8;
      for (let x = 40; x < width - 40; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, height - 40); ctx.stroke();
      }
      for (let y = 40; y < height - 40; y += 30) {
        ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(width - 40, y); ctx.stroke();
      }

      spherePoints.forEach((p, idx) => {
        const px = 60 + ((p.lon / (Math.PI * 2)) * (width - 120));
        const py = height / 2 + ((p.lat / Math.PI) * (height - 120));
        ctx.fillStyle = (idx % 2 === 0) ? '#8AF5F2' : '#E5FFE1';
        ctx.fillRect(px, py, 1.8, 1.8);
      });

      // Sinusoidal Ground Track for Active Function
      ctx.strokeStyle = '#8AF5F2';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let x = 40; x <= width - 40; x += 5) {
        const y = height / 2 + Math.sin((x / 60) + (Date.now() / 2000)) * (height * 0.28);
        if (x === 40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.font = '700 12px "Orbitron", sans-serif';
      ctx.fillStyle = '#E5FFE1';
      ctx.fillText('2D REGIONAL TOPOLOGY // AWS GLOBAL BACKBONE', 50, 60);

      ctx.restore();
    }

    function renderRegional() {
      ctx.save();
      const regions = [
        { name: 'us-east-1 (N. Virginia)', x: width * 0.28, y: height * 0.38, prov: '15 PC' },
        { name: 'us-west-2 (Oregon)', x: width * 0.18, y: height * 0.34, prov: '10 PC' },
        { name: 'eu-west-1 (Ireland)', x: width * 0.52, y: height * 0.32, prov: '12 PC' },
        { name: 'ap-northeast-1 (Tokyo)', x: width * 0.78, y: height * 0.42, prov: '8 PC' },
        { name: 'sa-east-1 (São Paulo)', x: width * 0.36, y: height * 0.68, prov: '6 PC' },
      ];

      regions.forEach(st => {
        ctx.strokeStyle = 'rgba(229, 255, 225, 0.4)';
        ctx.beginPath();
        ctx.arc(st.x, st.y, 16 + Math.sin(Date.now() / 300) * 3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#8AF5F2';
        ctx.beginPath();
        ctx.arc(st.x, st.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '700 10px "Orbitron", sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(st.name, st.x + 12, st.y - 4);
        ctx.font = '9px "Share Tech Mono", monospace';
        ctx.fillStyle = '#E5FFE1';
        ctx.fillText(`WARM CAPACITY: ${st.prov} • STATUS: SYNCHRONIZED`, st.x + 12, st.y + 10);
      });

      ctx.restore();
    }

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedFunction, controllerMode, viewMode]);

  return (
    <div className="canvas-surround">
      {/* Floating HUD Telemetry Labels */}
      <div className="hud-telemetry-text hud-pos-tl">
        <div>Mode: <span className="val-mint">{controllerMode.toUpperCase()}</span> &bull; Lead: <span className="val-mint">+10 MIN</span></div>
        <div>Target: <span className="val-cyan">{selectedFunction?.name || 'warmify-demo-func:prod'}</span></div>
      </div>

      <div className="hud-telemetry-text hud-pos-tc">
        <div>AWS Multi-Region Mesh &bull; us-east-1</div>
        <div style={{ fontSize: '9px', color: '#4E605D' }}>WARMIFY PREDICTIVE MATRIX</div>
      </div>

      <div className="hud-telemetry-text hud-pos-tr">
        <div>UTC <span className="val-mint">{utcTime}</span></div>
        <div>Cold-Start Shield: <span className="val-mint">99.4%</span> (Zero Penalty)</div>
      </div>

      <canvas id="missionControlCanvas" ref={canvasRef}></canvas>
    </div>
  );
}
