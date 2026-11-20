import React, { useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

interface HomeErrorStateProps {
  onRetry: () => void;
}

/**
 * Tela de erro coerente exibida apenas quando fontes críticas da Home falham
 * sem um snapshot coerente em cache. Nunca expõe conteúdo parcial ou quebrado.
 */
export const HomeErrorState: React.FC<HomeErrorStateProps> = ({ onRetry }) => {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    if (retrying) return;
    setRetrying(true);
    onRetry();
    // Backoff curto para evitar cliques repetidos agressivos
    window.setTimeout(() => setRetrying(false), 1800);
  };

  return (
    <main
      className="app"
      role="alert"
      aria-live="assertive"
      style={{
        minHeight: '72vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(212, 175, 55, 0.12)',
          border: '1.5px solid rgba(212, 175, 55, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
          color: '#D4AF37',
        }}
        aria-hidden="true"
      >
        <WifiOff size={28} />
      </div>

      <h1
        style={{
          fontFamily: "'Outfit', 'Manrope', sans-serif",
          fontSize: 20,
          fontWeight: 800,
          color: 'var(--text-primary)',
          margin: '0 0 8px',
          letterSpacing: '-0.02em',
        }}
      >
        Não foi possível carregar a Home
      </h1>

      <p
        style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 13.5,
          lineHeight: 1.5,
          color: 'var(--text-secondary)',
          maxWidth: 320,
          margin: '0 0 24px',
        }}
      >
        Verifique sua conexão com a internet e tente novamente para carregar as ofertas e vitrines do mercado.
      </p>

      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="btn-primary"
        style={{
          padding: '0 24px',
          minWidth: 190,
          cursor: retrying ? 'wait' : 'pointer',
        }}
      >
        <RefreshCw
          size={16}
          style={{
            animation: retrying ? 'spin 0.8s linear infinite' : undefined,
          }}
        />
        <span>{retrying ? 'Tentando novamente…' : 'Tentar novamente'}</span>
      </button>
    </main>
  );
};

