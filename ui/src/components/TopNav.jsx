import React from 'react';
import { Activity, Settings, ShieldCheck, BarChart3, Layers, Radio } from 'lucide-react';

export default function TopNav({
  activeTab,
  onSelectTab,
  onOpenBenchmarks,
  onOpenConfig,
  onOpenHealth,
}) {
  const tabs = [
    { id: 'overview', label: 'Pipeline' },
    { id: 'topology', label: 'Topology' },
    { id: 'benchmarks', label: 'A/B Benchmarks' },
    { id: 'telemetry', label: 'CloudWatch' },
  ];

  return (
    <header className="top-header">
      {/* Brand Section */}
      <div className="brand-section">
        <span className="brand-logo-text">WARMIFY</span>
        <span className="brand-subtitle-text">PREDICTIVE CONCURRENCY // AWS LAMBDA</span>
      </div>

      {/* Center Capsule Nav */}
      <nav className="nav-capsule-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-capsule-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Top Right Tools & Operator */}
      <div className="top-tools">
        <button
          className="tool-circle-btn"
          title="Open A/B Evaluation Benchmark Modal"
          onClick={onOpenBenchmarks}
        >
          <BarChart3 size={14} />
        </button>
        <button
          className="tool-circle-btn"
          title="Component Health & Status"
          onClick={onOpenHealth}
        >
          <Activity size={14} />
        </button>
        <button
          className="tool-circle-btn"
          title="Autoscaling Guardrails & Configuration"
          onClick={onOpenConfig}
        >
          <Settings size={14} />
        </button>
        <div className="controller-badge" title="Warmify Predictive Concurrency Controller Active">
          <ShieldCheck size={13} style={{ marginRight: 4, color: 'var(--c-mint)' }} />
          WMF-PROD
        </div>
      </div>
    </header>
  );
}
