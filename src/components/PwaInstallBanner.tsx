import { Download } from 'lucide-react';
import { useState, useEffect } from 'react';

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show by default to test or if not standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (!isStandalone) {
      setIsVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Show native install prompt
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      // iOS fallback / Browsers that don't support beforeinstallprompt
      alert("Para instalar: No iOS, toque no ícone de Compartilhar e escolha 'Adicionar à Tela de Início'.");
    }
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '0 16px 12px 16px', // Margins match Home padding
        height: '24px', // Tão fino quanto a linha da topbar
      }}
    >
      <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
        Faça suas compras em 1 clique
      </span>
      
      <button
        onClick={handleInstallClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          color: '#FFDF73',
          fontSize: 12,
          fontWeight: 800,
          cursor: 'pointer',
          padding: '0',
          textTransform: 'uppercase',
        }}
      >
        <Download size={14} />
        Instalar App
      </button>
    </div>
  );
}
