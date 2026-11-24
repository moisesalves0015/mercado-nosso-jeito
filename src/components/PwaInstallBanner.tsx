import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Truck, Gift, Gem, Flame } from 'lucide-react';

interface TickerSlide {
  id: string;
  text: string;
  buttonLabel: string;
  icon: typeof Download;
  action: 'install' | 'navigate' | 'info';
  target?: string;
  infoMessage?: string;
}

export function PwaInstallBanner() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<{
    prompt: () => void;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  } | null>(null);
  const [isStandalone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(display-mode: standalone)').matches : false
  );
  const [slideIndex, setSlideIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(
        e as unknown as {
          prompt: () => void;
          userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
        }
      );
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const slides = useMemo<TickerSlide[]>(() => {
    const baseSlides: TickerSlide[] = [];

    // Se não estiver em modo standalone, inclui o convite de instalação
    if (!isStandalone) {
      baseSlides.push({
        id: 'install',
        text: 'Faça suas compras em 1 clique',
        buttonLabel: 'Instalar App',
        icon: Download,
        action: 'install',
      });
    }

    baseSlides.push(
      {
        id: 'delivery',
        text: 'Entrega rápida no seu condomínio',
        buttonLabel: '15 a 30 min',
        icon: Truck,
        action: 'info',
        infoMessage: 'Entregamos diretamente no seu condomínio em média entre 15 e 30 minutos!',
      },
      {
        id: 'free-shipping',
        text: 'Frete grátis em pedidos acima de R$ 60',
        buttonLabel: 'Aproveitar',
        icon: Gift,
        action: 'navigate',
        target: '/promotions',
      },
      {
        id: 'clube-vip',
        text: 'Ganhe diamantes e gire a Roleta VIP',
        buttonLabel: 'Girar Roleta',
        icon: Gem,
        action: 'navigate',
        target: '/clube',
      },
      {
        id: 'super-ofertas',
        text: 'Super Ofertas selecionadas da semana',
        buttonLabel: 'Ver Ofertas',
        icon: Flame,
        action: 'navigate',
        target: '/promotions',
      }
    );

    return baseSlides;
  }, [isStandalone]);

  // Revezamento a cada 4.5 segundos com transição suave
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setSlideIndex((prev) => (prev + 1) % slides.length);
        setIsTransitioning(false);
      }, 240);
    }, 4500);

    return () => clearInterval(interval);
  }, [slides.length]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      alert("Para instalar: No iOS Safari, toque em Compartilhar e selecione 'Adicionar à Tela de Início'. No Chrome, clique em Instalar no menu.");
    }
  };

  const handleAction = (slide: TickerSlide) => {
    if (slide.action === 'install') {
      handleInstallClick();
    } else if (slide.action === 'navigate' && slide.target) {
      if (slide.target.startsWith('#')) {
        const el = document.querySelector(slide.target);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate(slide.target);
      }
    } else if (slide.action === 'info' && slide.infoMessage) {
      alert(slide.infoMessage);
    }
  };

  const activeSlide = slides[slideIndex] || slides[0];
  if (!activeSlide) return null;

  const Icon = activeSlide.icon;

  return (
    <div
      className="pwa-install-ticker"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '6px 14px 6px',
        height: '26px',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1005,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          minWidth: 0,
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? 'translateY(-4px)' : 'translateY(0)',
          transition: 'opacity 0.24s ease, transform 0.24s ease',
        }}
      >
        <span
          className="pwa-banner-text"
          style={{
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 1px 4px rgba(0, 0, 0, 0.75)',
          }}
        >
          {activeSlide.text}
        </span>
      </div>

      <button
        type="button"
        onClick={() => handleAction(activeSlide)}
        className="pwa-banner-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: 'none',
          border: 'none',
          fontSize: 11.5,
          fontWeight: 900,
          cursor: 'pointer',
          padding: '2px 0 2px 8px',
          textTransform: 'uppercase',
          flexShrink: 0,
          textShadow: '0 1px 4px rgba(0, 0, 0, 0.75)',
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? 'translateY(4px)' : 'translateY(0)',
          transition: 'opacity 0.24s ease, transform 0.24s ease',
        }}
      >
        <Icon size={13} strokeWidth={2.4} />
        <span>{activeSlide.buttonLabel}</span>
      </button>
    </div>
  );
}
