import React, { useState } from 'react';

export default function ScalingAnomalyCard({ onActionExecuted, scalingState }) {
  const [actionLogs, setActionLogs] = useState([]);
  const [loadingAction, setLoadingAction] = useState('');

  const minFloor = scalingState?.min_floor ?? 1;
  const maxCap = scalingState?.max_cap ?? 50;
  const deadBand = scalingState?.dead_band ?? 2;

  const baseLogs = [
    { text: '[SYSTEM READY] Warmify Controller initialized in local simulation mode.', type: 'mint' },
    { text: `[GUARDRAILS] Min Floor: ${minFloor} | Max Cap: ${maxCap} | Deadband: ${deadBand} applied.`, type: 'cyan' },
  ];

  const logs = [...baseLogs, ...actionLogs].slice(-15);

  const addLog = (text, type = 'cyan') => {
    setActionLogs((prev) => [...prev.slice(-12), { text, type }]);
  };

  // Simulate Traffic Surge
  const handleSimulateSurge = async () => {
    setLoadingAction('surge');
    addLog('[ACTION] Injecting sudden +300% traffic surge to API Gateway...', 'amber');
    try {
      const res = await fetch('/api/demo/surge?magnitude=300', { method: 'POST' });
      const data = await res.json();
      if (data.new_decision) {
        addLog(
          `[SURGE MITIGATED] Little's Law scaled PC to ${data.new_decision.final_copies} copies before cold starts occurred.`,
          'mint'
        );
      }
      if (onActionExecuted) onActionExecuted();
    } catch (e) {
      addLog(`[SURGE ERROR] ${e.message}`, 'red');
    } finally {
      setLoadingAction('');
    }
  };

  // Test Warm Invocation
  const handleInvokeWarm = async () => {
    setLoadingAction('warm');
    addLog('[INVOKE] Sending request to warm provisioned container...', 'cyan');
    try {
      const res = await fetch('/api/demo/invoke?force_cold=false', { method: 'POST' });
      const data = await res.json();
      const resp = data.demo_response || {};
      addLog(
        `[WARM HIT] Container ${resp.container_id} | Init: 0.0ms | Duration: ${data.total_elapsed_ms}ms`,
        'mint'
      );
      if (onActionExecuted) onActionExecuted();
    } catch (e) {
      addLog(`[INVOKE ERROR] ${e.message}`, 'red');
    } finally {
      setLoadingAction('');
    }
  };

  // Test Cold Start Invocation
  const handleInvokeCold = async () => {
    setLoadingAction('cold');
    addLog('[INVOKE] Forcing cold-start invocation (heavy ML model init)...', 'amber');
    try {
      const res = await fetch('/api/demo/invoke?force_cold=true', { method: 'POST' });
      const data = await res.json();
      const resp = data.demo_response || {};
      addLog(
        `[COLD START] Container ${resp.container_id} | Init: ${resp.init_duration_ms}ms | Total: ${data.total_elapsed_ms}ms`,
        'red'
      );
      if (onActionExecuted) onActionExecuted();
    } catch (e) {
      addLog(`[INVOKE ERROR] ${e.message}`, 'red');
    } finally {
      setLoadingAction('');
    }
  };

  // Run Controller Cycle
  const handleRunCycle = async () => {
    setLoadingAction('cycle');
    addLog('[CONTROLLER] Triggering immediate Little\'s Law predictive cycle...', 'cyan');
    try {
      const res = await fetch('/api/controller/cycle', { method: 'POST' });
      const data = await res.json();
      const d = data.decision || {};
      addLog(
        `[DECISION] Predicted RPS: ${d.predicted_rps} | Raw: ${d.raw_copies} -> Final PC: ${d.final_copies}`,
        'mint'
      );
      if (onActionExecuted) onActionExecuted();
    } catch (e) {
      addLog(`[CYCLE ERROR] ${e.message}`, 'red');
    } finally {
      setLoadingAction('');
    }
  };

  // Trigger MLOps Retrain
  const handleRetrainModel = async () => {
    setLoadingAction('retrain');
    addLog('[MLOPS] Initiating automated online retraining on historical telemetry...', 'cyan');
    try {
      const res = await fetch('/api/model/retrain', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'retrained_successfully') {
        addLog(
          `[RETRAIN SUCCESS] Q50/Q90/Q95 retrained on ${data.samples} samples | Drift: ${data.data_drift} | 0 Downtime Deployment`,
          'mint'
        );
      } else {
        addLog(`[RETRAIN NOTICE] ${data.status}`, 'cyan');
      }
      if (onActionExecuted) onActionExecuted();
    } catch (e) {
      addLog(`[RETRAIN ERROR] ${e.message}`, 'red');
    } finally {
      setLoadingAction('');
    }
  };

  // Dispatch Webhook Alert
  const handleSendTestAlert = async () => {
    setLoadingAction('alert');
    addLog('[ALERT] Dispatching incident notification to configured Webhook...', 'amber');
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Proactive Alert: Cold-start surge override triggered.' }),
      });
      const data = await res.json();
      addLog(
        `[ALERT DISPATCHED] ID: ${data.alert?.id} | Severity: ${data.alert?.severity} | Type: ${data.alert?.type}`,
        'mint'
      );
      if (onActionExecuted) onActionExecuted();
    } catch (e) {
      addLog(`[ALERT ERROR] ${e.message}`, 'red');
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <div className="hud-glass-card interactive-control-card">
      <div className="control-title-bar">
        <span className="control-title-text">Interactive Live Demonstration</span>
        <span className="badge-live-dot" style={{ position: 'static' }} />
      </div>

      {/* Action Buttons */}
      <div className="interactive-btn-rack">
        <button
          className="action-trigger-btn btn-surge"
          onClick={handleSimulateSurge}
          disabled={!!loadingAction}
        >
          {loadingAction === 'surge' ? 'PROVISIONING SURGE...' : 'Simulate Traffic Surge (+300%)'}
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            className="action-trigger-btn btn-invoke-warm"
            onClick={handleInvokeWarm}
            disabled={!!loadingAction}
          >
            {loadingAction === 'warm' ? 'INVOKING...' : 'Warm PC Hit (<50ms)'}
          </button>
          <button
            className="action-trigger-btn btn-invoke-cold"
            onClick={handleInvokeCold}
            disabled={!!loadingAction}
          >
            {loadingAction === 'cold' ? 'INIT...' : 'Force Cold Start'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            className="action-trigger-btn btn-ghost-dismiss"
            onClick={handleRunCycle}
            disabled={!!loadingAction}
            style={{ fontSize: '0.68rem', padding: '5px 8px' }}
          >
            {loadingAction === 'cycle' ? 'CALCULATING...' : "Run Little's Law Cycle"}
          </button>
          <button
            className="action-trigger-btn btn-ghost-dismiss"
            onClick={handleRetrainModel}
            disabled={!!loadingAction}
            style={{ fontSize: '0.68rem', padding: '5px 8px', borderColor: 'var(--c-mint)', color: 'var(--c-mint)' }}
          >
            {loadingAction === 'retrain' ? 'RETRAINING...' : 'Retrain ML Models'}
          </button>
        </div>

        <button
          className="action-trigger-btn btn-ghost-dismiss"
          onClick={handleSendTestAlert}
          disabled={!!loadingAction}
          style={{ fontSize: '0.68rem', padding: '5px 8px', borderColor: 'var(--c-amber)', color: 'var(--c-amber)' }}
        >
          {loadingAction === 'alert' ? 'DISPATCHING...' : 'Dispatch Alert Notification'}
        </button>
      </div>

      {/* Real-Time Live Execution Logs Terminal */}
      <div className="terminal-output-box">
        {logs.map((log, idx) => (
          <div key={idx} className={`log-line-${log.type}`}>
            {log.text}
          </div>
        ))}
      </div>
    </div>
  );
}
