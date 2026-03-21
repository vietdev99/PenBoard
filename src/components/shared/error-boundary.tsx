import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
  errorInfo: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: '' }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info.componentStack ?? '' })
    // Also log to console for developer tools
    console.error('[PenBoard Error]', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleDismiss = () => {
    this.setState({ error: null, errorInfo: '' })
  }

  render() {
    if (!this.state.error) return this.props.children

    if (this.props.fallback) return this.props.fallback

    const { error, errorInfo } = this.state

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'hsl(0 0% 3.9%)',
          color: 'hsl(0 0% 98%)',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 640, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="hsl(0 84% 60%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Something went wrong</h2>
          </div>

          <div
            style={{
              background: 'hsl(0 0% 9%)',
              border: '1px solid hsl(0 0% 15%)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 14, color: 'hsl(0 84% 60%)' }}>
              {error.message}
            </p>
            {error.name !== 'Error' && (
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'hsl(0 0% 55%)' }}>
                {error.name}
              </p>
            )}
          </div>

          <details style={{ marginBottom: 16 }}>
            <summary
              style={{
                cursor: 'pointer',
                fontSize: 13,
                color: 'hsl(0 0% 55%)',
                userSelect: 'none',
              }}
            >
              Stack trace
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                background: 'hsl(0 0% 7%)',
                border: '1px solid hsl(0 0% 15%)',
                borderRadius: 6,
                fontSize: 11,
                lineHeight: 1.5,
                color: 'hsl(0 0% 65%)',
                overflow: 'auto',
                maxHeight: 300,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.stack}
              {errorInfo && `\n\nComponent Stack:${errorInfo}`}
            </pre>
          </details>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '8px 16px',
                background: 'hsl(0 0% 98%)',
                color: 'hsl(0 0% 3.9%)',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reload App
            </button>
            <button
              onClick={this.handleDismiss}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: 'hsl(0 0% 65%)',
                border: '1px solid hsl(0 0% 20%)',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try to Continue
            </button>
            <button
              onClick={() => {
                const text = `${error.name}: ${error.message}\n\n${error.stack ?? ''}\n\nComponent Stack:${errorInfo}`
                navigator.clipboard.writeText(text)
              }}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: 'hsl(0 0% 65%)',
                border: '1px solid hsl(0 0% 20%)',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Copy Error
            </button>
          </div>
        </div>
      </div>
    )
  }
}
