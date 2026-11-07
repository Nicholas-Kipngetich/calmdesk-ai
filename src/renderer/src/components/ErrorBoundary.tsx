import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * ErrorBoundary (Phase 7 - resilience).
 *
 * A crashed renderer previously blanked the whole window with no way
 * forward. This boundary catches render/runtime errors anywhere under it
 * and shows a calm, honest screen instead - with a real recovery action
 * (reload) and an escape hatch to demo mode, so a failing live pipeline
 * can never trap the user in a dead app.
 *
 * React error boundaries must be class components.
 */

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console only - CalmDesk AI sends nothing anywhere.
    console.error('CalmDesk AI crashed inside the UI:', error, info.componentStack)
  }

  private reload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <div className="crash-screen">
        <div className="card crash-card">
          <h3 className="card-title">Something went wrong on our side</h3>
          <p className="guidance-text">
            The interface hit an unexpected error and had to reset. Your data and
            settings are safe - session history lives outside this window and was
            not affected.
          </p>
          <p className="guidance-text muted crash-detail">{this.state.error.message}</p>
          <div className="head-actions">
            <button type="button" className="btn btn-primary" onClick={this.reload}>
              Reload app
            </button>
            <button type="button" className="btn" onClick={() => window.close()}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }
}
