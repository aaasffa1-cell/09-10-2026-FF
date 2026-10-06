import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading...', fullScreen = false }) {
  const content = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '40px 20px',
      color: 'var(--text-muted)',
    }}>
      <div style={{ position: 'relative' }}>
        <Loader2 size={36} color="var(--accent-orange)" className="spin-animation" />
      </div>
      <span style={{
        fontFamily: 'var(--font-heading)',
        fontSize: '14px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        fontWeight: 700,
        color: 'var(--text-main)',
      }}>
        {message}
      </span>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {content}
      </div>
    );
  }

  return content;
}
