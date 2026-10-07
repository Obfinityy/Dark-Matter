/**
 * PageErrorBoundary — catches render crashes in a page and shows a friendly
 * error instead of unmounting the entire app (blank black screen).
 *
 * A page-level crash must never take down the whole React root. Wrap each
 * agent route's page in this so a bug in one page stays in that page, with
 * a Retry button that resets the boundary.
 */
import React, { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Log for diagnostics; the UI shows the friendly fallback.
    try {
      console.error('[PageErrorBoundary]', this.props.pageName || 'page', error, info?.componentStack);
    } catch { /* ignore */ }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const pageName = this.props.pageName || 'this page';
    return (
      <div className="sg-card sg-card-pad" role="alert" style={{ margin: '24px auto', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={20} color="var(--sg-danger, #f87171)" />
          <strong style={{ fontSize: 17 }}>{pageName} ran into a problem</strong>
        </div>
        <p className="sg-small" style={{ marginBottom: 8 }}>
          Something went wrong while showing {pageName}. Your other pages are fine —
          this error is contained here.
        </p>
        <details className="sg-small" style={{ marginBottom: 16, opacity: 0.75 }}>
          <summary style={{ cursor: 'pointer' }}>Technical details</summary>
          <code style={{ wordBreak: 'break-word' }}>{String(error?.message || error)}</code>
        </details>
        <button
          className="sg-btn sg-btn-primary"
          onClick={() => this.setState({ error: null })}
        >
          <RotateCcw size={15} /> Retry
        </button>
      </div>
    );
  }
}
