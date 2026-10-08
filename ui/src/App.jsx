import React, { useState, useEffect, useCallback } from 'react';
import TopNav from './components/TopNav';
import FunctionFleet from './components/FunctionFleet';
import ServerlessTopology from './components/ServerlessTopology';
import PredictionHorizon from './components/PredictionHorizon';
import ActiveFunctionHUD from './components/ActiveFunctionHUD';
import ScalingAnomalyCard from './components/ScalingAnomalyCard';
import BottomDock from './components/BottomDock';
import BenchmarkModal from './components/BenchmarkModal';
import BenchmarkView from './components/BenchmarkView';
import CloudWatchTelemetryView from './components/CloudWatchTelemetryView';
import ConfigModal from './components/ConfigModal';
import HealthModal from './components/HealthModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [controllerMode, setControllerMode] = useState('q90');
  const [viewMode, setViewMode] = useState('pipeline');
  const [selectedFuncId, setSelectedFuncId] = useState('warmify-demo');
  const [utcTime, setUtcTime] = useState('');

  // Modals state
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isHealthOpen, setIsHealthOpen] = useState(false);

  // Real backend states
  const [scalingState, setScalingState] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [evalData, setEvalData] = useState(null);
  const [healthData, setHealthData] = useState(null);

  // Managed Lambda Function Fleet with Clear, Understandable Display Names
  const [functions, setFunctions] = useState([
    {
      id: 'warmify-demo',
      displayName: 'ML Inference Engine',
      name: 'warmify-demo:prod',
      role: 'Heavy Cold-Start ML Target',
      icon: 'cpu',
      runtimeTag: 'PY 3.12',
      status: 'Ready',
      memory: '512 MB',
      runtime: 'Python 3.12',
      region: 'us-east-1',
      provisioned: 2,
      desired: 2,
      loadPct: 88,
    },
    {
      id: 'auth-authorizer',
      displayName: 'API Auth Service',
      name: 'auth-authorizer:prod',
      role: 'JWT & Session Validator',
      icon: 'shield',
      runtimeTag: 'NODE 20',
      status: 'Nominal',
      memory: '128 MB',
      runtime: 'Node.js 20',
      region: 'us-east-1',
      provisioned: 8,
      desired: 8,
      loadPct: 76,
    },
    {
      id: 'checkout-payment',
      displayName: 'Checkout & Payments',
      name: 'checkout-payment:prod',
      role: 'Stripe & Order Transactions',
      icon: 'card',
      runtimeTag: 'PY 3.12',
      status: 'Nominal',
      memory: '1024 MB',
      runtime: 'Python 3.12',
      region: 'us-east-1',
      provisioned: 14,
      desired: 16,
      loadPct: 91,
    },
    {
      id: 'analytics-stream',
      displayName: 'Real-Time Analytics',
      name: 'analytics-stream:prod',
      role: 'Clickstream & Event Ingestion',
      icon: 'activity',
      runtimeTag: 'PY 3.12',
      status: 'Nominal',
      memory: '512 MB',
      runtime: 'Python 3.12',
      region: 'us-east-1',
      provisioned: 6,
      desired: 6,
      loadPct: 72,
    },
    {
      id: 'billing-webhook',
      displayName: 'Billing & Webhooks',
      name: 'billing-webhook:prod',
      role: 'Partner Event Notifications',
      icon: 'radio',
      runtimeTag: 'PY 3.12',
      status: 'Nominal',
      memory: '256 MB',
      runtime: 'Python 3.12',
      region: 'us-east-1',
      provisioned: 4,
      desired: 5,
      loadPct: 84,
    },
  ]);

  // Live UTC Clock updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().split('T')[1].substring(0, 8));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll real FastAPI telemetry
  const pollBackend = useCallback(async () => {
    try {
      const [resScaling, resTimeline, resEval, resHealth] = await Promise.all([
        fetch('/api/scaling').then((r) => r.json()).catch(() => null),
        fetch('/api/timeline?minutes=60').then((r) => r.json()).catch(() => null),
        fetch('/api/evaluation').then((r) => r.json()).catch(() => null),
        fetch('/api/health').then((r) => r.json()).catch(() => null),
      ]);

      if (resScaling?.current_state) {
        setScalingState(resScaling.current_state);
        const allocated = resScaling.current_state.allocated_concurrency || 2;
        const requested = resScaling.current_state.requested_concurrency || allocated;

        setFunctions((prev) =>
          prev.map((fn) =>
            fn.id === 'warmify-demo'
              ? {
                  ...fn,
                  provisioned: allocated,
                  desired: requested,
                  status: resScaling.current_state.status || 'READY',
                }
              : fn
          )
        );
      }

      if (resTimeline) {
        setTimelineData(resTimeline);
      }

      if (resEval?.status === 'complete') {
        setEvalData(resEval);
      }

      if (resHealth) {
        setHealthData(resHealth);
      }
    } catch {
      // Offline fallback handling
    }
  }, []);

  useEffect(() => {
    pollBackend();
    const pollInterval = setInterval(pollBackend, 3000);
    return () => clearInterval(pollInterval);
  }, [pollBackend]);

  // Handle Quantile Scaling Mode Switch
  const handleChangeMode = async (newMode) => {
    setControllerMode(newMode);
    try {
      await fetch(`/api/controller/cycle?quantile=${newMode}`, { method: 'POST' });
      await pollBackend();
    } catch {
      // Offline
    }
  };

  // Handle Guardrails Configuration Update
  const handleSaveConfig = async (newConfig) => {
    try {
      await fetch('/api/scaling/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_floor: newConfig.minFloor,
          max_cap: newConfig.maxCap,
          dead_band: newConfig.deadBand,
          scale_down_step: newConfig.stepDown,
          headroom: newConfig.headroom,
          provisioned_concurrency: newConfig.provisionedConcurrency,
        }),
      });
      await pollBackend();
    } catch (e) {
      console.error('Failed to update guardrails config:', e);
    }
  };

  const selectedFunction = functions.find((f) => f.id === selectedFuncId) || functions[0];
  const latestMetric = timelineData?.traffic_history?.slice(-1)[0] || null;

  return (
    <div className="screen-wrapper">
      <div className="screen-vignette" />
      <div className="screen-scanlines" />

      {/* Top Header Navigation */}
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenBenchmarks={() => setIsBenchmarkOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenHealth={() => setIsHealthOpen(true)}
      />

      {/* Dynamic Tab Body */}
      {activeTab === 'telemetry' ? (
        /* Tab 4: CloudWatch Real-Time Telemetry & Component Health View */
        <main className="main-stage" style={{ gridTemplateColumns: '1fr' }}>
          <CloudWatchTelemetryView
            timelineData={timelineData}
            healthData={healthData}
            scalingState={scalingState}
            selectedFunction={selectedFunction}
          />
        </main>
      ) : activeTab === 'benchmarks' ? (
        /* Tab 3: Full-Page A/B Benchmark Evaluation Suite */
        <main className="main-stage" style={{ gridTemplateColumns: '1fr' }}>
          <BenchmarkView evalData={evalData} />
        </main>
      ) : (
        /* Tab 1 & 2: Pipeline Overview & Interactive Topology View */
        <main className="main-stage">
          {/* Left Column: Lambda Fleet & Controller Mode */}
          <FunctionFleet
            functions={functions}
            selectedFuncId={selectedFuncId}
            onSelectFunc={setSelectedFuncId}
            controllerMode={controllerMode}
            onChangeMode={handleChangeMode}
          />

          {/* Center Column: Serverless Architecture Pipeline & Concurrency Horizon */}
          <section className="center-viewport">
            <ServerlessTopology
              selectedFunction={selectedFunction}
              controllerMode={controllerMode}
              viewMode={activeTab === 'topology' ? 'topology' : viewMode}
              scalingState={scalingState}
              latestMetric={latestMetric}
              onOpenBenchmarks={() => setIsBenchmarkOpen(true)}
              onSelectFunction={setSelectedFuncId}
            />
            <PredictionHorizon
              timelineData={timelineData}
              scalingState={scalingState}
            />
          </section>

          {/* Right Column: Active Function Telemetry & Live Interactive Tester */}
          <aside className="right-sidebar">
            <ActiveFunctionHUD
              selectedFunction={selectedFunction}
              scalingState={scalingState}
              timelineData={timelineData}
              healthData={healthData}
            />
            <ScalingAnomalyCard onActionExecuted={pollBackend} scalingState={scalingState} />
          </aside>
        </main>
      )}

      {/* Bottom Dock Controls */}
      <BottomDock
        viewMode={activeTab === 'topology' ? 'topology' : viewMode}
        onChangeView={(vm) => {
          setViewMode(vm);
          if (vm === 'topology') {
            setActiveTab('topology');
          } else {
            setActiveTab('overview');
          }
        }}
        onOpenBenchmarks={() => setIsBenchmarkOpen(true)}
        utcTime={utcTime}
      />

      {/* Modals */}
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        evalData={evalData}
      />

      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        scalingState={scalingState}
        onSave={handleSaveConfig}
      />

      <HealthModal
        isOpen={isHealthOpen}
        onClose={() => setIsHealthOpen(false)}
        healthData={healthData}
      />
    </div>
  );
}
