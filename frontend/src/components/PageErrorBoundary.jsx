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
      console.error(
        '[PageErrorBoundary]',
        this.props.pageName || 'page',
        error,
        info?.componentStack
      );
    } catch {
      /* ignore */
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const pageName = this.props.pageName || 'this page';
    return (
      <div className="sg-card sg-card-pad sg-eb" role="alert" aria-labelledby="sg-eb-title">
        <div className="sg-eb-head">
          <span className="sg-eb-icon" aria-hidden="true">
            <AlertTriangle size={22} />
          </span>
          <h2 className="sg-eb-title" id="sg-eb-title">
            {pageName} ran into a problem
          </h2>
        </div>
        <p className="sg-small sg-eb-copy">
          Something went wrong while showing {pageName}. Your other pages are fine — this error is
          contained here.
        </p>
        <details className="sg-small sg-eb-details">
          <summary>Technical details</summary>
          <code className="sg-eb-code">{String(error?.message || error)}</code>
        </details>
        <div className="sg-eb-actions">
          <button
            type="button"
            className="sg-btn sg-btn-primary sg-eb-retry"
            onClick={() => this.setState({ error: null })}
          >
            <RotateCcw size={15} aria-hidden="true" /> Retry
          </button>
        </div>
      </div>
    );
  }
}
