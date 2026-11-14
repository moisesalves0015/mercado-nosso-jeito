import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface PageHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  backTo?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  centerContent?: React.ReactNode;
  children?: React.ReactNode;
  background?: string;
  borderColor?: string;
  zIndex?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Standardized TopBar component for all subpages and views across Mercado Nosso Jeito.
 * Guarantees:
 * 1. Immediate positioning below status bar via safe-area-top-bg
 * 2. Visual background continuity extending to the very top edge
 * 3. Consistent sticky behavior without jumps, pops, or voids
 * 4. Calibrated touch targets and typography
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  backTo,
  leftAction,
  rightAction,
  centerContent,
  children,
  background = 'var(--bg-secondary)',
  borderColor = 'var(--border-gold)',
  zIndex = 1000,
  className = '',
  style = {},
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div
      className={`app-header-container ${className}`}
      style={{
        position: 'sticky',
        top: 0,
        zIndex,
        width: '100%',
        background,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${borderColor}`,
        ...style,
      }}
    >
      {/* ── Top Safe Area (OS Status Bar spacer) ── */}
      <div className="safe-area-top-bg" style={{ background }} />

      {/* ── Header Content ── */}
      {children ? (
        children
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            minHeight: 52,
            boxSizing: 'border-box',
            width: '100%',
          }}
        >
          {/* Left Action / Back Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {showBack && (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Voltar"
                style={{
                  background: 'var(--back-btn-bg)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            {leftAction}
          </div>

          {/* Center Title or Custom Content */}
          {centerContent ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              {centerContent}
            </div>
          ) : title ? (
            <div style={{ textAlign: showBack ? 'left' : 'center', flex: 1, margin: '0 8px' }}>
              <h1
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: 0,
                  letterSpacing: '-0.3px',
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    margin: '2px 0 0 0',
                    fontWeight: 500,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          {/* Right Action / Spacer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {rightAction || (showBack && <div style={{ width: 36 }} />)}
          </div>
        </div>
      )}
    </div>
  );
};

