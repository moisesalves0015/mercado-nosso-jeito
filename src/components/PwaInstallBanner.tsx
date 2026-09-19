import { Download } from 'lucide-react';
import { useState, useEffect } from 'react';

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => void, userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> } | null>(null);
  const [isVisible, setIsVisible] = useState(() => !window.matchMedia('(display-mode: standalone)').matches);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as { prompt: () => void, userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> });
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

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
      <span className="pwa-banner-text" style={{ fontSize: 12, fontWeight: 600 }}>
        Faça suas compras em 1 clique
      </span>
      
      <button
        onClick={handleInstallClick}
        className="pwa-banner-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
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
