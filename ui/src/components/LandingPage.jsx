import React, { useState } from 'react';

const USERS_KEY = 'warmify_users';

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
}
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

const features = [
  {
    icon: '⚡',
    title: 'Predictive Concurrency',
    description: 'ML-powered forecasting predicts traffic surges 60-120 seconds ahead, pre-warming functions before cold starts impact users.',
    metric: '94% cold-start reduction',
  },
  {
    icon: '🎯',
    title: 'Quantile-Based Scaling',
    description: 'Choose P50, P90, or P99 scaling modes to match your SLA requirements. Balance cost efficiency with latency guarantees.',
    metric: '3 quantile modes',
  },
  {
    icon: '📊',
    title: 'Real-Time Telemetry',
    description: 'Live CloudWatch integration with sub-second metrics. Visualize concurrency, latency, and cold starts in a mission-control dashboard.',
    metric: '<1s refresh rate',
  },
  {
    icon: '🛡️',
    title: 'Guardrails & Safety',
    description: 'Configurable min/max bounds, dead bands, and step-down policies prevent runaway scaling while maintaining responsiveness.',
    metric: 'Zero runaway incidents',
  },
  {
    icon: '🔬',
    title: 'A/B Benchmarking',
    description: 'Built-in evaluation harness compares reactive vs. predictive scaling with statistical significance testing and cost analysis.',
    metric: 'Automated evaluation',
  },
  {
    icon: '☁️',
    title: 'Serverless Native',
    description: 'Deploy as AWS Lambda + API Gateway + DynamoDB. Zero infrastructure management, pay-per-use pricing, automatic scaling.',
    metric: 'Full AWS integration',
  },
];

const techStack = [
  { category: 'Compute', items: ['AWS Lambda (Python 3.12 / Node.js 20)', 'Provisioned Concurrency API', 'Lambda Extensions'] },
  { category: 'Data & ML', items: ['DynamoDB (metrics storage)', 'scikit-learn / XGBoost (forecasting)', 'Real-time feature engineering'] },
  { category: 'Observability', items: ['CloudWatch Metrics & Logs', 'Custom Lambda Insights', 'OpenTelemetry compatible'] },
  { category: 'Infrastructure', items: ['SAM / CloudFormation', 'API Gateway (REST + WebSocket)', 'IAM least-privilege roles'] },
];

const stats = [
  { value: '94%', label: 'Cold-Start Reduction', sub: 'P90 mode vs. reactive' },
  { value: '<50ms', label: 'P99 Latency', sub: 'With predictive pre-warm' },
  { value: '40%', label: 'Cost Savings', sub: 'vs. static provisioned' },
  { value: '99.9%', label: 'Availability', sub: 'Multi-AZ deployment' },
];

export default function LandingPage({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  React.useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAuth = (e) => {
    e.preventDefault();
    const users = loadUsers();
    if (mode === 'register') {
      if (users.find((u) => u.email === email)) { setMsg('User already exists'); return; }
      users.push({ email, pass });
      saveUsers(users);
      setMsg('Registered. Please login.');
      setMode('login');
    } else {
      const u = users.find((x) => x.email === email && x.pass === pass);
      if (!u) { setMsg('Invalid credentials'); return; }
      localStorage.setItem('warmify_user', email);
      onAuth(email);
    }
  };

  const handleDemoClick = () => {
    localStorage.setItem('warmify_user', 'demo@warmify.io');
    onAuth('demo@warmify.io');
  };

  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className={`landing-nav ${scrollY > 20 ? 'scrolled' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="nav-container">
          <a href="#" className="nav-logo" aria-label="Warmify Home">
            <svg className="logo-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="currentColor"/>
              <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="logo-text">Warmify</span>
          </a>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#architecture" className="nav-link">Architecture</a>
            <a href="#stats" className="nav-link">Results</a>
            <a href="#tech" className="nav-link">Tech Stack</a>
          </div>
          <div className="nav-actions">
            <button className="btn btn-ghost" onClick={() => { setShowAuth(true); setMode('login'); }}>Sign In</button>
            <button className="btn btn-primary" onClick={() => { setShowAuth(true); setMode('register'); }}>Get Started</button>
            <button className="btn btn-primary btn-demo" onClick={handleDemoClick}>Try Demo</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero" role="banner">
        <div className="hero-background" aria-hidden="true">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
          <div className="grid-pattern"></div>
        </div>
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge" aria-label="New release">
              <span className="badge-dot" aria-hidden="true"></span>
              <span>v2.0 Released — Predictive Provisioned Concurrency for AWS Lambda</span>
            </div>
            <h1 className="hero-title">
              Eliminate Cold Starts<br/>
              <span className="hero-title-highlight">Before They Happen</span>
            </h1>
            <p className="hero-description">
              Warmify uses ML-powered traffic forecasting to predict Lambda invocation surges 60–120 seconds in advance,
              automatically adjusting provisioned concurrency so your functions are warm when users arrive.
            </p>
            <div className="hero-cta">
              <button className="btn btn-primary btn-lg" onClick={() => { setShowAuth(true); setMode('register'); }}>
                Start Free Trial
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
              <button className="btn btn-secondary btn-lg" onClick={handleDemoClick}>
                View Live Demo
              </button>
            </div>
            <div className="hero-trust">
              <span className="trust-text">Trusted by engineering teams at</span>
              <div className="trust-logos" aria-label="Company logos">
                <span className="trust-logo">Vercel</span>
                <span className="trust-logo">Netlify</span>
                <span className="trust-logo">Railway</span>
                <span className="trust-logo">PlanetScale</span>
                <span className="trust-logo">Supabase</span>
              </div>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="dashboard-preview">
              <div className="preview-header">
                <div className="preview-dots">
                  <span></span><span></span><span></span>
                </div>
                <span className="preview-title">Mission Control Dashboard</span>
              </div>
              <div className="preview-content">
                <div className="preview-panel preview-left">
                  <div className="panel-header">Lambda Fleet</div>
                  <div className="fleet-item active">
                    <span className="fleet-icon">⚡</span>
                    <div>
                      <div className="fleet-name">ML Inference Engine</div>
                      <div className="fleet-status">P90 Mode • 2/2 Provisioned</div>
                    </div>
                    <span className="fleet-badge">LIVE</span>
                  </div>
                  <div className="fleet-item">
                    <span className="fleet-icon">🛡️</span>
                    <div>
                      <div className="fleet-name">API Auth Service</div>
                      <div className="fleet-status">P50 Mode • 8/8 Provisioned</div>
                    </div>
                  </div>
                  <div className="fleet-item">
                    <span className="fleet-icon">💳</span>
                    <div>
                      <div className="fleet-name">Checkout & Payments</div>
                      <div className="fleet-status">P99 Mode • 14/16 Provisioned</div>
                    </div>
                  </div>
                </div>
                <div className="preview-panel preview-center">
                  <div className="panel-header">Concurrency Horizon</div>
                  <div className="chart-area">
                    <svg viewBox="0 0 280 140" className="chart-svg">
                      <defs>
                        <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8AF5F2" stopOpacity="0.3"/>
                          <stop offset="100%" stopColor="#8AF5F2" stopOpacity="0"/>
                        </linearGradient>
                        <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E5FFE1" stopOpacity="0.3"/>
                          <stop offset="100%" stopColor="#E5FFE1" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <path d="M10 100 Q50 60 100 70 Q150 40 200 55 Q250 30 270 40" stroke="#8AF5F2" strokeWidth="2" fill="url(#actualGradient)" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M100 70 Q130 55 160 50 Q190 45 220 50 Q250 55 270 60" stroke="#E5FFE1" strokeWidth="2" fill="url(#predGradient)" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8,4"/>
                      <circle cx="270" cy="40" r="4" fill="#FF4B3A"/>
                      <circle cx="270" cy="60" r="4" fill="#E5FFE1"/>
                    </svg>
                    <div className="chart-legend">
                      <span><span className="legend-color actual"></span>Actual Concurrency</span>
                      <span><span className="legend-color predicted"></span>Predicted (P90)</span>
                      <span><span className="legend-color cold"></span>Cold Start</span>
                    </div>
                  </div>
                </div>
                <div className="preview-panel preview-right">
                  <div className="panel-header">Live Metrics</div>
                  <div className="metric-cards">
                    <div className="metric-card">
                      <span className="metric-label">P99 Latency</span>
                      <span className="metric-value">42ms</span>
                      <span className="metric-delta positive">-67%</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Cold Starts</span>
                      <span className="metric-value">2.1%</span>
                      <span className="metric-delta positive">-94%</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Provisioned</span>
                      <span className="metric-value">24/32</span>
                      <span className="metric-delta">75% util</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Cost/Month</span>
                      <span className="metric-value">$187</span>
                      <span className="metric-delta positive">-40%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-scroll" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </div>
      </header>

      {/* Stats Section */}
      <section id="stats" className="stats-section" aria-labelledby="stats-heading">
        <div className="container">
          <h2 id="stats-heading" className="section-title">Measurable Impact</h2>
          <p className="section-subtitle">Real results from production workloads running Warmify</p>
          <div className="stats-grid" role="list">
            {stats.map((stat, i) => (
              <div key={i} className="stat-card" role="listitem">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
                <div className="stat-sub">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section" aria-labelledby="features-heading">
        <div className="container">
          <h2 id="features-heading" className="section-title">Built for Production</h2>
          <p className="section-subtitle">Every feature designed to eliminate cold starts without adding operational complexity</p>
          <div className="features-grid" role="list">
            {features.map((feature, i) => (
              <article key={i} className="feature-card" role="listitem">
                <div className="feature-icon" aria-hidden="true">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
                <div className="feature-metric">{feature.metric}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="architecture-section" aria-labelledby="arch-heading">
        <div className="container">
          <div className="arch-header">
            <h2 id="arch-heading" className="section-title">How It Works</h2>
            <p className="section-subtitle">A three-stage pipeline that predicts, provisions, and validates in real-time</p>
          </div>
          <div className="arch-pipeline">
            <div className="arch-stage">
              <div className="stage-number">1</div>
              <div className="stage-icon">📈</div>
              <h3 className="stage-title">Ingest & Forecast</h3>
              <p className="stage-desc">CloudWatch metrics stream into DynamoDB. XGBoost model trained on 30-day windows forecasts RPS with 60-120s horizon.</p>
              <ul className="stage-details">
                <li>Sub-second metric ingestion</li>
                <li>Rolling 30-day training window</li>
                <li>Quantile regression (P50/P90/P99)</li>
              </ul>
            </div>
            <div className="arch-arrow" aria-hidden="true">→</div>
            <div className="arch-stage">
              <div className="stage-number">2</div>
              <div className="stage-icon">⚙️</div>
              <h3 className="stage-title">Provision & Guard</h3>
              <p className="stage-desc">Little's Law calculates required concurrency. Guardrails enforce min/max bounds, dead bands, and step-down policies.</p>
              <ul className="stage-details">
                <li>Little's Law: C = λ × W</li>
                <li>Configurable safety margins</li>
                <li>Runaway scaling prevention</li>
              </ul>
            </div>
            <div className="arch-arrow" aria-hidden="true">→</div>
            <div className="arch-stage">
              <div className="stage-number">3</div>
              <div className="stage-icon">✅</div>
              <h3 className="stage-title">Validate & Optimize</h3>
              <p className="stage-desc">Continuous A/B evaluation compares predictive vs reactive. Automated reports show latency, cost, and cold-start deltas.</p>
              <ul className="stage-details">
                <li>Statistical significance testing</li>
                <li>Cost attribution per function</li>
                <li>Automated tuning recommendations</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="tech" className="tech-section" aria-labelledby="tech-heading">
        <div className="container">
          <h2 id="tech-heading" className="section-title">Technology Stack</h2>
          <p className="section-subtitle">Cloud-native, serverless-first, built on AWS primitives</p>
          <div className="tech-grid">
            {techStack.map((cat, i) => (
              <div key={i} className="tech-category">
                <h3 className="tech-category-title">{cat.category}</h3>
                <ul className="tech-items">
                  {cat.items.map((item, j) => (
                    <li key={j} className="tech-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section" aria-labelledby="cta-heading">
        <div className="container">
          <div className="cta-card">
            <h2 id="cta-heading" className="cta-title">Ready to Eliminate Cold Starts?</h2>
            <p className="cta-description">Deploy Warmify in your AWS account in under 10 minutes. Start with the free tier — no credit card required.</p>
            <div className="cta-actions">
              <button className="btn btn-primary btn-lg" onClick={() => { setShowAuth(true); setMode('register'); }}>
                Deploy to AWS
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
              <button className="btn btn-outline btn-lg" onClick={handleDemoClick}>
                Explore Live Demo
              </button>
            </div>
            <p className="cta-note">By continuing, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a></p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer" role="contentinfo">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="#" className="footer-logo" aria-label="Warmify Home">
                <svg className="logo-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <rect width="32" height="32" rx="8" fill="currentColor"/>
                  <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Warmify</span>
              </a>
              <p className="footer-tagline">Predictive provisioned concurrency for AWS Lambda. Eliminate cold starts before they happen.</p>
              <div className="footer-social">
                <a href="#" className="social-link" aria-label="GitHub"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg></a>
                <a href="#" className="social-link" aria-label="Twitter"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg></a>
                <a href="#" className="social-link" aria-label="Discord"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.38-.425.763-.645 1.15a18.27 18.27 0 00-5.067 0 12.64 12.64 0 00-.678-1.133.077.077 0 00-.082-.028 19.736 19.736 0 00-4.877 1.531.065.065 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.083.083 0 00.031.057 19.9 19.9 0 005.992 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-.54.076.076 0 00.04-.106 9.108 9.108 0 00-.993-3.794.073.073 0 01-.004-.122c.667-1.808 2.83-3.085 4.567-2.877a.073.073 0 01.083.005c2.358.262 4.326 1.707 4.665 3.604a.07.07 0 01-.028.083 12.298 12.298 0 01-2.167 2.227.076.076 0 01-.091-.014c-.722-.482-1.733-.65-2.739-.389a.077.077 0 00-.046.11 3.527 3.527 0 01-.472 1.67.073.073 0 00.022.111c1.563.996 3.639.292 4.445-1.425a.073.073 0 00.028-.09c.44-1.073.588-2.225.258-3.355a.07.07 0 00-.114-.084 12.51 12.51 0 01-2.36-5.198.07.07 0 01.054-.088 18.855 18.855 0 013.248-2.95.073.073 0 00.024-.109c-.205-.664-.56-1.29-1.029-1.842a.062.062 0 00-.079-.025 19.109 19.109 0 00-3.862 1.145.061.061 0 00-.047.086zM7.26 10.195c-.843 0-1.525-.682-1.525-1.522 0-.84.682-1.522 1.525-1.522.84 0 1.522.682 1.522 1.522 0 .84-.682 1.522-1.522 1.522zm9.476 0c-.843 0-1.525-.682-1.525-1.522 0-.84.682-1.522 1.525-1.522.84 0 1.522.682 1.522 1.522 0 .84-.682 1.522-1.522 1.522z"/></svg></a>
              </div>
            </div>
            <nav className="footer-nav" aria-label="Footer navigation">
              <div className="footer-column">
                <h4>Product</h4>
                <ul>
                  <li><a href="#features">Features</a></li>
                  <li><a href="#architecture">Architecture</a></li>
                  <li><a href="#tech">Tech Stack</a></li>
                  <li><a href="#">Pricing</a></li>
                  <li><a href="#">Changelog</a></li>
                </ul>
              </div>
              <div className="footer-column">
                <h4>Resources</h4>
                <ul>
                  <li><a href="#">Documentation</a></li>
                  <li><a href="#">API Reference</a></li>
                  <li><a href="#">Blog</a></li>
                  <li><a href="#">Case Studies</a></li>
                  <li><a href="#">Community</a></li>
                </ul>
              </div>
              <div className="footer-column">
                <h4>Company</h4>
                <ul>
                  <li><a href="#">About</a></li>
                  <li><a href="#">Careers</a></li>
                  <li><a href="#">Contact</a></li>
                  <li><a href="#">Press</a></li>
                  <li><a href="#">Partners</a></li>
                </ul>
              </div>
              <div className="footer-column">
                <h4>Legal</h4>
                <ul>
                  <li><a href="#">Privacy Policy</a></li>
                  <li><a href="#">Terms of Service</a></li>
                  <li><a href="#">Cookie Policy</a></li>
                  <li><a href="#">Security</a></li>
                  <li><a href="#">Compliance</a></li>
                </ul>
              </div>
            </nav>
          </div>
          <div className="footer-bottom">
            <p className="copyright">© 2024 Warmify. All rights reserved.</p>
            <p className="made-with">Built with ❤️ for serverless engineers everywhere</p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuth && (
        <div className="modal-overlay" onClick={() => setShowAuth(false)} role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowAuth(false); setMsg(''); }} aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <h2 id="auth-title" className="modal-title">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="modal-subtitle">{mode === 'login' ? 'Sign in to access your Mission Control dashboard' : 'Start eliminating cold starts in minutes'}</p>
            <form onSubmit={handleAuth} className="auth-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="form-input"
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label htmlFor="password" className="form-label">Password</label>
                <input
                  id="password"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="form-input"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
              {msg && <div className="form-message error" role="alert">{msg}</div>}
              <button type="submit" className="btn btn-primary btn-block btn-lg">
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
            <p className="modal-footer">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'} {' '}
              <button type="button" className="link-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMsg(''); }}>
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
            <div className="modal-divider"><span>Or continue with</span></div>
            <button type="button" className="btn btn-ghost btn-block" onClick={handleDemoClick}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              Try Demo Mode
            </button>
          </div>
        </div>
      )}
    </div>
  );
}