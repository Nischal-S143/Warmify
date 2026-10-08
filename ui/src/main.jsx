import React, { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('WARMIFY CRITICAL RENDER ERROR:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#04070D',
          color: '#8AF5F2',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: '"Share Tech Mono", monospace',
          textAlign: 'center'
        }}>
          <div style={{
            border: '1px solid rgba(255, 68, 68, 0.4)',
            background: 'rgba(255, 0, 0, 0.05)',
            padding: '32px',
            borderRadius: '6px',
            maxWidth: '640px',
            boxShadow: '0 0 30px rgba(255, 68, 68, 0.2)'
          }}>
            <h2 style={{ color: '#FF4444', margin: '0 0 12px 0', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>
              WARMIFY // TELEMETRY STACK EXCEPTION
            </h2>
            <p style={{ color: '#B8D0DE', fontSize: '0.85rem', marginBottom: '16px' }}>
              A UI rendering exception was intercepted by the Mission Control Error Boundary.
            </p>
            <div style={{
              background: '#010306',
              padding: '12px',
              borderRadius: '4px',
              border: '1px solid rgba(255, 68, 68, 0.2)',
              color: '#FF8888',
              fontSize: '0.78rem',
              textAlign: 'left',
              overflowX: 'auto',
              marginBottom: '20px'
            }}>
              {this.state.error?.toString() || 'Unknown Runtime Error'}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'rgba(138, 245, 242, 0.15)',
                border: '1px solid #8AF5F2',
                color: '#8AF5F2',
                padding: '8px 20px',
                fontFamily: '"Share Tech Mono", monospace',
                fontSize: '0.85rem',
                cursor: 'pointer',
                borderRadius: '3px'
              }}
            >
              RELOAD DASHBOARD
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
