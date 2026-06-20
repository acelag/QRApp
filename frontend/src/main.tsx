import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import './i18n'   // initialise i18next before any component renders
import App from './App.tsx'

// Set global API base URL — in production this points to the Render backend
if (import.meta.env.VITE_API_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL;
}

// Global axios timeout so API calls never hang indefinitely
axios.defaults.timeout = 15000;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}

class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean; message: string }> {
  state = { crashed: false, message: '' };

  static getDerivedStateFromError(err: unknown) {
    return { crashed: true, message: err instanceof Error ? err.message : 'Unknown error' };
  }

  componentDidCatch(err: unknown, info: unknown) {
    console.error('[ErrorBoundary]', err, info);
  }

  render() {
    if (this.state.crashed) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: 24, gap: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>Something went wrong</h1>
          <p style={{ color: '#666', fontSize: 14 }}>{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 24px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.state.crashed ? null : this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
