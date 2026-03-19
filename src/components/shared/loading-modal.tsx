import { createPortal } from 'react-dom'

interface LoadingModalProps {
  open: boolean
  fileName?: string
  status?: string
}

/**
 * Full-screen loading overlay shown during heavy file operations.
 * Uses a React portal to document.body with inline styles (z-index: 99999)
 * to guarantee visibility above all other layers (per [07-04] pattern).
 */
export default function LoadingModal({ open, fileName, status }: LoadingModalProps) {
  if (!open) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      <div
        className="bg-card border border-border text-foreground"
        style={{
          borderRadius: 12,
          padding: '28px 36px',
          minWidth: 260,
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Spinner */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          style={{ animation: 'penboard-spin 0.8s linear infinite' }}
        >
          <circle
            cx="16"
            cy="16"
            r="13"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.2"
          />
          <path
            d="M16 3 A13 13 0 0 1 29 16"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        {/* File name */}
        {fileName && (
          <span
            className="text-foreground"
            style={{
              fontSize: 13,
              fontWeight: 500,
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'center',
            }}
          >
            {fileName}
          </span>
        )}

        {/* Status text */}
        <span
          className="text-muted-foreground"
          style={{ fontSize: 12 }}
        >
          {status || 'Loading...'}
        </span>
      </div>

      {/* Keyframes injected inline to avoid depending on global CSS */}
      <style>{`
        @keyframes penboard-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>,
    document.body,
  )
}
