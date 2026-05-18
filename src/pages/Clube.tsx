import { useState, useEffect } from 'react';
import { 
  Gem, 
  CheckCircle, 
  Check,
  Play, 
  UserPlus, 
  ShoppingBag, 
  Flame, 
  ArrowRight, 
  Sparkles,
  MessageCircle,
  ExternalLink,
  Truck
} from 'lucide-react';

interface Mission {
  id: string;
  title: string;
  rewardText: string;
  rewardVal: number;
  progressText: string;
  completed: boolean;
  type: 'checkin' | 'ad' | 'order' | 'refer' | 'combo';
}

interface SponsorAd {
  id: string;
  brand: string;
  title?: string;
  desc: string;
  logo: string;
  rewardVal: number;
  type: 'coins' | 'shipping';
  buttonLabel?: string;
  bannerImage: string;
  duration: number;
  category?: string;
}

interface RewardItem {
  id: string;
  title: string;
  cost: number;
  desc: string;
  image: string;
  code: string;
}

// Simulated Loading Skeleton Screen
// ... (rest is unchanged)

const PremiumDiamondSVG = ({ size = 24, className = '', style = {}, fill = 'none', color = 'currentColor' }: { size?: number; className?: string; style?: React.CSSProperties; fill?: string; color?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className} 
    style={style}
  >
    <path d="M6 2L18 2L22 8L12 22L2 8L6 2Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={fill} />
    <path d="M6 2L12 8L18 2" stroke={color} strokeWidth="1" strokeLinejoin="round" />
    <path d="M2 8H22" stroke={color} strokeWidth="1" strokeLinejoin="round" />
    <path d="M12 8V22" stroke={color} strokeWidth="1" strokeLinejoin="round" />
    <path d="M6 2L2 8L12 22" stroke={color} strokeWidth="1" strokeLinejoin="round" />
    <path d="M18 2L22 8L12 22" stroke={color} strokeWidth="1" strokeLinejoin="round" />
  </svg>
);

export const Clube = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [coins, setCoins] = useState<number>(320);
  const [popBadge, setPopBadge] = useState<boolean>(false);
  const [streak, setStreak] = useState<number>(7);
  const [checkedIn, setCheckedIn] = useState<boolean>(false);
  const [vipProgress, setVipProgress] = useState<number>(64);
  const [vipTier, setVipTier] = useState<string>('Bronze');
  const [activeAd, setActiveAd] = useState<SponsorAd | null>(null);
  const [adTimer, setAdTimer] = useState<number>(3);
  const [isAdPlaying, setIsAdPlaying] = useState<boolean>(false);
  const [successModal, setSuccessModal] = useState<{title: string; coupon: string; desc: string; amountGained?: number} | null>(null);
  const [completedAds, setCompletedAds] = useState<string[]>([]);

  // Simulated points history ledgers
  const [history, setHistory] = useState<Array<{id: string; desc: string; date: string; value: string; isPlus: boolean}>>([
    { id: '1', desc: 'Indicação de Amigo (Marcos)', date: 'Hoje, 10:42', value: '+80', isPlus: true },
    { id: '2', desc: 'Check-in Diário (Dia 6)', date: 'Ontem, 08:15', value: '+15', isPlus: true },
    { id: '3', desc: 'Desconto Resgatado R$ 5,00', date: '15 Mai, 19:30', value: '-150', isPlus: false },
    { id: '4', desc: 'Pedido Completado #8942', date: '14 Mai, 14:22', value: '+100', isPlus: true },
  ]);

  const [missions, setMissions] = useState<Mission[]>([
    { id: 'm1', title: 'Check-in Diário', rewardText: '+15 diamantes', rewardVal: 15, progressText: '0/1 dia', completed: false, type: 'checkin' },
    { id: 'm2', title: 'Assistir Anúncio', rewardText: '+50 diamantes', rewardVal: 50, progressText: '0/1 vídeo', completed: false, type: 'ad' },
    { id: 'm3', title: 'Fazer Pedido', rewardText: '+100 diamantes', rewardVal: 100, progressText: '0/1 pedido', completed: false, type: 'order' },
    { id: 'm4', title: 'Indicar Amigo', rewardText: '+80 diamantes', rewardVal: 80, progressText: '0/3 indicados', completed: false, type: 'refer' },
    { id: 'm5', title: 'Comprar Combo', rewardText: '+120 diamantes', rewardVal: 120, progressText: '0/1 combo', completed: false, type: 'combo' },
  ]);

  const sponsorAds: SponsorAd[] = [
    { 
      id: 'ad1', 
      brand: 'Melitta', 
      title: 'Melitta Especial', 
      desc: 'Café fresquinho do condomínio! Assista e ganhe 50 diamantes.', 
      logo: '/cafe-novo.png', 
      rewardVal: 50, 
      type: 'coins', 
      buttonLabel: 'Assistir',
      bannerImage: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=400',
      duration: 20,
      category: 'Serviço Premium'
    },
    { 
      id: 'ad2', 
      brand: 'Danone Grego', 
      title: 'Danone Grego Especial', 
      desc: 'Estilo de vida leve e saudável! Assista ao spot e ganhe 40 diamantes.', 
      logo: '/iogurte-novo.webp', 
      rewardVal: 40, 
      type: 'coins', 
      buttonLabel: 'Assistir',
      bannerImage: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=400',
      duration: 30,
      category: 'Bem-Estar'
    },
    { 
      id: 'ad3', 
      brand: 'Do Bem', 
      title: 'Do Bem Especial', 
      desc: 'Sucos 100% naturais! Conheça a nossa história e ganhe frete grátis.', 
      logo: '/suco_do_bem_laranja_integral.png', 
      rewardVal: 0, 
      type: 'shipping', 
      buttonLabel: 'Ativar Frete',
      bannerImage: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?q=80&w=400',
      duration: 25,
      category: 'Parceiro Local'
    },
  ];

  const rewards: RewardItem[] = [
    { id: 'r1', title: 'Frete Grátis Recorrente', cost: 100, desc: 'Clube Exclusivo', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=200', code: 'FREEFREQ' },
    { id: 'r2', title: 'Cupom de R$ 5,00 OFF', cost: 150, desc: 'Válido para todo o app', image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=200', code: 'NOSSOCINCO' },
    { id: 'r3', title: 'Energético Monster 473ml', cost: 250, desc: 'Ganhe um Monster gelado', image: 'https://images.unsplash.com/photo-1622543953490-0b70039a23f9?q=80&w=200', code: 'MONSTERCLUB' },
    { id: 'r4', title: 'Iogurte Danone Grego', cost: 200, desc: 'Copinho unitário grátis', image: '/iogurte-novo.webp', code: 'GREGOGRATS' },
    { id: 'r5', title: 'Cashback R$ 10,00', cost: 300, desc: 'Crédito na próxima compra', image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=200', code: 'CASHBACK10' },
  ];

  // Simulated Loading Skeleton Screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 850);
    return () => clearTimeout(timer);
  }, []);

  // Shimmering Gold Confetti explosion sequence (matching brand premium theme)
  useEffect(() => {
    if (successModal && successModal.amountGained) {
      import('canvas-confetti').then((confettiModule) => {
        const confetti = confettiModule.default;
        const brandColors = ['#FFDF73', '#D4AF37', '#E7BC79', '#FFFFFF', '#FFF8DF'];
        
        // Stage 1: Giant bottom-center golden burst (320 particles!)
        confetti({
          particleCount: 320,
          spread: 100,
          origin: { y: 0.6 },
          colors: brandColors,
          scalar: 1.2
        });
        
        // Stage 2: Left side golden fireworks cannon (150 particles)
        setTimeout(() => {
          confetti({
            particleCount: 150,
            angle: 60,
            spread: 65,
            origin: { x: 0, y: 0.75 },
            colors: brandColors,
            scalar: 1.1
          });
        }, 180);
        
        // Stage 3: Right side golden fireworks cannon (150 particles)
        setTimeout(() => {
          confetti({
            particleCount: 150,
            angle: 120,
            spread: 65,
            origin: { x: 1, y: 0.75 },
            colors: brandColors,
            scalar: 1.1
          });
        }, 320);

        // Stage 4: Secondary center golden shimmer shower (120 particles)
        setTimeout(() => {
          confetti({
            particleCount: 120,
            spread: 120,
            origin: { y: 0.55 },
            colors: brandColors,
            scalar: 0.95
          });
        }, 450);
      });
    }
  }, [successModal]);

  // Timer for simulated sponsored ad video play
  useEffect(() => {
    let interval: any;
    if (isAdPlaying && adTimer > 0) {
      interval = setInterval(() => {
        setAdTimer((prev) => prev - 1);
      }, 1000);
    } else if (isAdPlaying && adTimer === 0) {
      setIsAdPlaying(false);
      handleEarnCoins(activeAd?.rewardVal || 50, `Anúncio Assistido (${activeAd?.brand})`);
      
      // Mark ad mission completed
      setMissions(prev => prev.map(m => m.type === 'ad' ? { ...m, completed: true, progressText: '1/1 vídeo' } : m));
      
      if (activeAd) {
        setCompletedAds(prev => [...prev, activeAd.id]);
      }
      
      if (activeAd?.type === 'shipping') {
        setSuccessModal({
          title: 'Frete Grátis Ativado!',
          desc: 'Seu cupom de frete grátis exclusivo da marca Do Bem já está disponível na carteira!',
          coupon: 'DOBEMFRETE'
        });
      } else {
        setSuccessModal({
          title: `+${activeAd?.rewardVal} Diamantes Ganhos!`,
          desc: `Obrigado por assistir ao conteúdo patrocinado de ${activeAd?.brand}. Seus diamantes foram adicionados.`,
          coupon: 'CREDITADO',
          amountGained: activeAd?.rewardVal
        });
      }
      setActiveAd(null);
    }
    return () => clearInterval(interval);
  }, [isAdPlaying, adTimer]);

  const handleEarnCoins = (amount: number, description: string) => {
    setCoins((prev) => prev + amount);
    setPopBadge(true);
    setTimeout(() => setPopBadge(false), 300);

    // Update VIP progress
    setVipProgress((prev) => {
      const next = prev + (amount / 10);
      if (next >= 100) {
        setVipTier('Prata');
        return next - 100;
      }
      return next;
    });

    // Append to ledger history
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes()}`;
    setHistory((prev) => [
      {
        id: Math.random().toString(),
        desc: description,
        date: `Hoje, ${timeStr}`,
        value: `+${amount}`,
        isPlus: true,
      },
      ...prev,
    ]);

    // Automatically trigger visual success modal for checkin / other earns
    setSuccessModal({
      title: 'Diamantes Creditados!',
      desc: `${description}. Fique ativo para acumular mais diamantes e resgatar prêmios!`,
      coupon: 'CREDITADO',
      amountGained: amount
    });
  };

  const handleCheckin = () => {
    if (checkedIn) return;
    setCheckedIn(true);
    setStreak(prev => prev + 1);
    handleEarnCoins(15, 'Check-in Diário (Dia 8)');
    
    // Mark checkin mission completed
    setMissions(prev => prev.map(m => m.type === 'checkin' ? { ...m, completed: true, progressText: '1/1 dia' } : m));
  };

  const handleAdClick = (ad: SponsorAd) => {
    setActiveAd(ad);
    setAdTimer(ad.duration);
    setIsAdPlaying(true);
  };

  const handleReferral = () => {
    navigator.clipboard.writeText('https://mercado.nossojeito/invite?ref=MEMBER320');
    alert('Link de indicação exclusivo copiado!');
    handleEarnCoins(80, 'Indicação Compartilhada');
    
    // Mark refer mission completed
    setMissions(prev => prev.map(m => m.type === 'refer' ? { ...m, completed: true, progressText: '1/3 indicados' } : m));
  };

  const handleRedeemReward = (reward: RewardItem) => {
    if (coins < reward.cost) {
      alert('Diamantes insuficientes para resgatar este benefício premium.');
      return;
    }
    setCoins(prev => prev - reward.cost);
    
    // Append to ledger history
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes()}`;
    setHistory((prev) => [
      {
        id: Math.random().toString(),
        desc: `Resgate: ${reward.title}`,
        date: `Hoje, ${timeStr}`,
        value: `-${reward.cost}`,
        isPlus: false,
      },
      ...prev,
    ]);

    // Show beautiful coupon modal
    setSuccessModal({
      title: 'Benefício Resgatado!',
      desc: `Parabéns! Você trocou seus diamantes por: ${reward.title}. Use o cupom abaixo no checkout.`,
      coupon: reward.code
    });
  };

  if (isLoading) {
    return (
      <main className="app clube-page">
        <header className="clube-topbar">
          <div className="clube-logo-container">
            <span className="clube-logo-text">clube nosso jeito</span>
          </div>
          <div className="clube-coins-badge">
            <Gem size={11} />
            <span>--- diamantes</span>
          </div>
        </header>
        <div className="clube-skeleton-wrapper">
          <div className="skeleton-shimmer" style={{ height: 180 }} />
          <div className="skeleton-shimmer" style={{ height: 35, width: '60%' }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="skeleton-shimmer" style={{ height: 120, width: 110 }} />
            <div className="skeleton-shimmer" style={{ height: 120, width: 110 }} />
            <div className="skeleton-shimmer" style={{ height: 120, width: 110 }} />
          </div>
          <div className="skeleton-shimmer" style={{ height: 160 }} />
          <div className="skeleton-shimmer" style={{ height: 35, width: '45%' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="skeleton-shimmer" style={{ height: 140 }} />
            <div className="skeleton-shimmer" style={{ height: 140 }} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app clube-page">
      {/* HEADER PREMIUM */}
      <header className="clube-topbar">
        <div className="clube-logo-container">
          <Gem size={15} color="#FFDF73" style={{ filter: 'drop-shadow(0 0 4px rgba(212,175,55,0.6))' }} />
          <span className="clube-logo-text">clube nosso jeito</span>
        </div>
        <div className={`clube-coins-badge ${popBadge ? 'pop' : ''}`}>
          <Gem size={11} fill="#FFDF73" />
          <span>{coins} diamantes</span>
        </div>
      </header>

      {/* CARD PRINCIPAL DE RECOMPENSAS (APPLE WALLET-STYLE) */}
      <div className="clube-hero-card">
        <div className="clube-hero-header">
          <span className="clube-vip-tier">Membro {vipTier}</span>
          <div className="streak-indicator" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#FF6B6B', fontWeight: 800 }}>
            <Flame size={12} fill="#FF6B6B" />
            <span>{streak} Dias Seguindo</span>
          </div>
        </div>
        
        <div className="clube-hero-body">
          <h2>Economize de verdade nas suas compras premium</h2>
          <p>Complete missões diárias, assista a spots exclusivos e troque seus diamantes por produtos, cupons e frete grátis.</p>
        </div>

        <div className="clube-progress-container">
          <div className="clube-progress-label-row">
            <span>VIP {vipTier}</span>
            <span>{Math.round(vipProgress)}% para VIP Prata</span>
          </div>
          <div className="clube-progress-track">
            <div className="clube-progress-fill" style={{ width: `${vipProgress}%` }}></div>
          </div>
        </div>
      </div>

      {/* MISSÕES DIÁRIAS (HORIZONTAL SCROLL) */}
      <div className="clube-section-title-row">
        <h3>Missões Diárias</h3>
        <span className="clube-section-streak-text">🔥 Streak ativo</span>
      </div>

      {/* WEEKLY CALENDAR COMPONENT FOR HIGH DOPAMINE ENGAGEMENT */}
      <div className="clube-weekly-calendar">
        {[...Array(7)].map((_, index) => {
          const dayNum = index + 1;
          const isCompleted = streak >= dayNum || (checkedIn && dayNum === streak);
          const isActive = dayNum === (checkedIn ? streak : streak + 1);
          const isLocked = dayNum > (checkedIn ? streak : streak + 1);
          const rewardVal = dayNum === 7 ? 50 : dayNum >= 5 ? 20 : 15;
          const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

          return (
            <div 
              key={index} 
              className={`weekly-day-slot ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
              onClick={isActive ? handleCheckin : undefined}
              title={isActive ? 'Clique para fazer Check-in!' : undefined}
            >
              <span className="weekly-day-name">{dayNames[index]}</span>
              <div className="weekly-day-icon-wrap">
                {isCompleted ? (
                  <Check size={10} strokeWidth={3} />
                ) : (
                  <PremiumDiamondSVG size={10} fill={isActive ? '#FFDF73' : 'none'} color={isActive ? '#FFDF73' : 'rgba(255,255,255,0.2)'} />
                )}
              </div>
              <span className="weekly-day-val" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <PremiumDiamondSVG size={8} fill={isActive ? '#FFDF73' : 'rgba(255,255,255,0.4)'} color={isActive ? '#FFDF73' : 'rgba(255,255,255,0.4)'} />
                +{rewardVal}
              </span>
            </div>
          );
        })}
      </div>

      <div className="clube-missions-list">
        {/* CHECK-IN ROW */}
        <div className={`clube-mission-row ${checkedIn ? 'completed' : ''}`}>
          <div className="clube-mission-left">
            <div className="clube-mission-icon-box">
              <CheckCircle size={16} color={checkedIn ? "#34C759" : "#D4AF37"} />
            </div>
            <div className="clube-mission-details">
              <h4>Check-in Diário</h4>
              <p>Acesse o app diariamente e acumule diamantes</p>
            </div>
          </div>
          <div className="clube-mission-right">
            <div className="clube-mission-reward-badge">
              <PremiumDiamondSVG size={10} fill="#FFDF73" color="#FFDF73" />
              <span>+15</span>
            </div>
            <button 
              className={`clube-mission-action-btn ${checkedIn ? 'completed' : ''}`}
              onClick={handleCheckin}
              disabled={checkedIn}
            >
              {checkedIn ? 'Resgatado' : 'Check-in'}
            </button>
          </div>
        </div>

        {/* AD ROW */}
        <div className={`clube-mission-row ${missions[1].completed ? 'completed' : ''}`}>
          <div className="clube-mission-left">
            <div className="clube-mission-icon-box">
              <Play size={15} color={missions[1].completed ? "#34C759" : "#D4AF37"} />
            </div>
            <div className="clube-mission-details">
              <h4>Assistir Spot</h4>
              <p>Assista a anúncios rápidos de marcas parceiras</p>
            </div>
          </div>
          <div className="clube-mission-right">
            <div className="clube-mission-reward-badge">
              <PremiumDiamondSVG size={10} fill="#FFDF73" color="#FFDF73" />
              <span>+50</span>
            </div>
            <button 
              className={`clube-mission-action-btn ${missions[1].completed ? 'completed' : ''}`}
              onClick={() => handleAdClick(sponsorAds[0])}
              disabled={missions[1].completed}
            >
              {missions[1].completed ? 'Concluído' : 'Assistir'}
            </button>
          </div>
        </div>

        {/* REFER FRIEND ROW */}
        <div className={`clube-mission-row ${missions[3].completed ? 'completed' : ''}`}>
          <div className="clube-mission-left">
            <div className="clube-mission-icon-box">
              <UserPlus size={15} color={missions[3].completed ? "#34C759" : "#D4AF37"} />
            </div>
            <div className="clube-mission-details">
              <h4>Indicar Amigo</h4>
              <p>Convide novos contatos para economizar no app</p>
            </div>
          </div>
          <div className="clube-mission-right">
            <div className="clube-mission-reward-badge">
              <PremiumDiamondSVG size={10} fill="#FFDF73" color="#FFDF73" />
              <span>+80</span>
            </div>
            <button 
              className={`clube-mission-action-btn ${missions[3].completed ? 'completed' : ''}`}
              onClick={handleReferral}
              disabled={missions[3].completed}
            >
              {missions[3].completed ? 'Concluído' : 'Indicar'}
            </button>
          </div>
        </div>

        {/* COMPLETE ORDER ROW */}
        <div className={`clube-mission-row ${missions[2].completed ? 'completed' : ''}`}>
          <div className="clube-mission-left">
            <div className="clube-mission-icon-box">
              <ShoppingBag size={15} color={missions[2].completed ? "#34C759" : "#D4AF37"} />
            </div>
            <div className="clube-mission-details">
              <h4>Fazer Pedido</h4>
              <p>Receba recompensas a cada compra concluída</p>
            </div>
          </div>
          <div className="clube-mission-right">
            <div className="clube-mission-reward-badge">
              <PremiumDiamondSVG size={10} fill="#FFDF73" color="#FFDF73" />
              <span>+100</span>
            </div>
            <button 
              className={`clube-mission-action-btn ${missions[2].completed ? 'completed' : ''}`}
              onClick={() => {
                handleEarnCoins(100, 'Pedido Completado #9021');
                setMissions(prev => prev.map(m => m.type === 'order' ? { ...m, completed: true, progressText: '1/1 pedido' } : m));
              }}
              disabled={missions[2].completed}
            >
              {missions[2].completed ? 'Concluído' : 'Completar'}
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE ANÚNCIOS OPCIONAIS (SPONSORED) */}
      <div className="clube-section-title-row">
        <h3>Ofertas Patrocinadas Premium</h3>
      </div>
      <div className="clube-ads-grid-vertical">
        {sponsorAds.map((ad) => {
          const isCompleted = completedAds.includes(ad.id);
          const brandClass = `brand-${ad.brand.toLowerCase().replace(/\s+/g, '')}`;
          
          return (
            <div className={`clube-ad-card-vertical ${brandClass} ${isCompleted ? 'completed' : ''}`} key={ad.id}>
              {/* TOP BANNER VISUAL */}
              <div className="clube-ad-banner-wrapper">
                <img src={ad.bannerImage} alt={ad.brand} className="clube-ad-banner" />
                <div className="clube-ad-banner-overlay-dark" />
                
                {/* Floating Tags */}
                <span className="clube-ad-category-tag">{ad.category || 'Parceiro'}</span>
                <span className="clube-ad-duration-tag">{ad.duration}s</span>
              </div>
              
              {/* BRAND LOGO CIRCLE (overlapped floating) */}
              <div className="clube-ad-logo-wrapper">
                <div className="clube-ad-logo-box">
                  <img src={ad.logo} alt={ad.brand} />
                </div>
              </div>
              
              {/* CARD DETAILS */}
              <div className="clube-ad-details">
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span className="clube-ad-brand-tag-vertical">{ad.brand}</span>
                </div>
                <h4 className="clube-ad-title-vertical">{ad.title || `${ad.brand} Especial`}</h4>
                <p className="clube-ad-desc-vertical">{ad.desc}</p>
                
                {/* Reward Pill */}
                <div className="clube-ad-reward-wrapper">
                  {isCompleted ? (
                    <div className="clube-ad-reward-badge-vertical completed">
                      <span>CONCLUÍDO</span>
                    </div>
                  ) : ad.rewardVal > 0 ? (
                    <div className="clube-ad-reward-badge-vertical">
                      <PremiumDiamondSVG size={9} fill="#FFDF73" color="#FFDF73" />
                      <span>+{ad.rewardVal}</span>
                    </div>
                  ) : (
                    <div className="clube-ad-reward-badge-vertical free">
                      <span>FRETE GRÁTIS</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* FULL WIDTH ACTION BUTTON */}
              <div className="clube-ad-action-wrapper">
                <button 
                  className={`clube-ad-btn-vertical ${isCompleted ? 'completed' : ''}`}
                  onClick={() => !isCompleted && handleAdClick(ad)}
                  disabled={isCompleted}
                >
                  {isCompleted 
                    ? (ad.type === 'shipping' ? 'Ativado' : 'Concluído') 
                    : (ad.type === 'shipping' ? 'Ativar Frete' : 'Assistir')
                  }
                </button>
              </div>

              {/* GLASS COMPLETED COVER */}
              {isCompleted && (
                <div className="clube-ad-completed-overlay">
                  <div className="clube-ad-completed-check">✓</div>
                  <span>Resgatado</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SISTEMA DE MOEDAS E WALLET LEDGER */}
      <div className="clube-wallet-section">
        <div className="clube-wallet-stats">
          <div className="clube-stat-box">
            <span>Saldo da Carteira</span>
            <span style={{ color: '#FFDF73', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Gem size={13} fill="#FFDF73" /> {coins}
            </span>
          </div>
          <div className="clube-stat-box">
            <span>Ganho Hoje</span>
            <span style={{ color: '#34C759' }}>+95 diamantes</span>
          </div>
          <div className="clube-stat-box">
            <span>VIP Streak</span>
            <span style={{ color: '#FF6B6B' }}>{streak} Dias</span>
          </div>
        </div>

        <div className="clube-ledger-history">
          <div className="clube-ledger-title">Histórico Recente</div>
          {history.map((h) => (
            <div className="clube-ledger-row" key={h.id}>
              <div className="clube-ledger-left">
                <span>{h.desc}</span>
                <span>{h.date}</span>
              </div>
              <span className={`clube-ledger-val ${h.isPlus ? 'plus' : 'minus'}`}>
                {h.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* RESGATE DE BENEFÍCIOS (TROQUE SEUS DIAMANTES) */}
      <div className="clube-section-title-row">
        <h3>Troque seus Diamantes</h3>
      </div>
      
      <div className="clube-rewards-grid">
        {rewards.map((reward) => (
          <div className="clube-reward-card" key={reward.id}>
            <div className="clube-reward-img-wrapper">
              <img src={reward.image} alt={reward.title} />
            </div>
            <div className="clube-reward-details">
              <h4>{reward.title}</h4>
              <p>{reward.desc}</p>
            </div>
            <div className="clube-reward-cost-pill">
              <span className="clube-reward-cost-text">{reward.cost} diamantes</span>
              <button 
                className="clube-reward-claim-btn"
                onClick={() => handleRedeemReward(reward)}
              >
                <ArrowRight size={8} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* SPONSOR VIDEO MODAL POPUP (FULL-SCREEN AD THEATER OVERLAY) */}
      {isAdPlaying && activeAd && (() => {
        const radius = 18;
        const circumference = 2 * Math.PI * radius; // ~113.097
        const progressOffset = circumference - (adTimer / activeAd.duration) * circumference;
        const brandColorClass = `brand-${activeAd.brand.toLowerCase().replace(/\s+/g, '')}`;

        return (
          <div className={`clube-ad-theater-overlay ${brandColorClass}`}>
            <div className="clube-ad-theater-screen">
              {/* Main Ad Banner Display */}
              <img src={activeAd.bannerImage} alt={activeAd.brand} className="clube-ad-theater-billboard" />
              <div className="clube-ad-theater-shade" />

              {/* Top Bar with Watermark and Circular Timer */}
              <div className="clube-ad-theater-top-bar">
                <div className="clube-ad-theater-brand-box">
                  <div className="clube-ad-theater-logo">
                    <img src={activeAd.logo} alt={activeAd.brand} />
                  </div>
                  <div>
                    <span className="clube-ad-theater-sponsor-label">Patrocinador Oficial</span>
                    <h4 className="clube-ad-theater-brand-name">{activeAd.brand}</h4>
                  </div>
                </div>

                {/* Circular Story Countdown Timer */}
                <div className="clube-ad-theater-timer-circle">
                  <svg width="46" height="46" viewBox="0 0 46 46">
                    <circle 
                      cx="23" 
                      cy="23" 
                      r={radius} 
                      className="clube-ad-theater-timer-bg"
                    />
                    <circle 
                      cx="23" 
                      cy="23" 
                      r={radius} 
                      className="clube-ad-theater-timer-fill"
                      strokeDasharray={circumference}
                      strokeDashoffset={progressOffset}
                    />
                  </svg>
                  <span className="clube-ad-theater-timer-text">{adTimer}s</span>
                </div>
              </div>

              {/* Bottom Spotlight Info and Timeline Progress */}
              <div className="clube-ad-theater-bottom-spotlight">
                <div className="clube-ad-theater-subtitles">
                  <h3 className="clube-ad-theater-ad-title" style={{ color: '#fff', fontSize: 16, fontWeight: 900, margin: '6px 0 2px' }}>{activeAd.title}</h3>
                  <p className="clube-ad-theater-ad-desc" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, margin: '0 0 8px' }}>{activeAd.desc}</p>
                  <p className="clube-ad-theater-reward-hint" style={{ color: '#FFDF73', fontSize: 10.5, fontWeight: 800 }}>
                    {activeAd.rewardVal > 0 
                      ? `Aguarde mais ${adTimer} segundos para resgatar +${activeAd.rewardVal} Diamantes!` 
                      : `Aguarde mais ${adTimer} segundos para ativar o seu Frete Grátis!`
                    }
                  </p>
                </div>

                {/* Interactive Sponsor spotlight CTA button */}
                <div className="clube-ad-theater-cta-wrapper" style={{ margin: '12px 0 16px', display: 'flex', justifyContent: 'center' }}>
                  <button 
                    className="clube-ad-theater-action-cta"
                    onClick={() => {
                      let actionText = '';
                      if (activeAd.brand === 'Melitta') {
                        actionText = 'Abrindo WhatsApp do Consultor de Café Melitta no Condomínio...';
                      } else if (activeAd.brand === 'Danone Grego') {
                        actionText = 'Redirecionando para o Site Oficial da Danone Grego...';
                      } else {
                        actionText = 'Resgatando Cupom de Frete Grátis Do Bem...';
                      }
                      alert(actionText);
                    }}
                  >
                    {activeAd.brand === 'Melitta' && (
                      <>
                        <MessageCircle size={13} fill="currentColor" />
                        <span>Falar no WhatsApp</span>
                      </>
                    )}
                    {activeAd.brand === 'Danone Grego' && (
                      <>
                        <ExternalLink size={13} />
                        <span>Visitar Site Oficial</span>
                      </>
                    )}
                    {activeAd.brand === 'Do Bem' && (
                      <>
                        <Truck size={13} />
                        <span>Ativar Frete Grátis</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Simulated Interactive Video Timeline Progress Bar */}
                <div className="clube-ad-theater-timeline-track">
                  <div 
                    className="clube-ad-theater-timeline-fill" 
                    style={{ width: `${((activeAd.duration - adTimer) / activeAd.duration) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SUCCESS MODAL POPUP */}
      {successModal && (
        <div className="clube-modal-overlay" onClick={() => setSuccessModal(null)}>
          {/* FLOATING FALLING DIAMONDS CASCADE (FULL VIEWPORT BACKGROUND EFFECT) */}
          {successModal.amountGained && (
            <div className="falling-diamonds-container">
              {[...Array(35)].map((_, i) => (
                <PremiumDiamondSVG 
                  key={i} 
                  className="falling-diamond" 
                  size={Math.random() * 26 + 18}
                  style={{
                    left: `${Math.random() * 96 + 2}%`,
                    animationDelay: `${Math.random() * 3.5}s`,
                    animationDuration: `${Math.random() * 2.5 + 1.5}s`,
                    filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.9))',
                    color: i % 3 === 0 ? '#FFDF73' : i % 3 === 1 ? '#E7BC79' : '#FFF'
                  }}
                  fill={i % 2 === 0 ? (i % 4 === 0 ? '#FFDF73' : '#E7BC79') : 'none'}
                />
              ))}
            </div>
          )}

          <div className="clube-modal-content reward-modal-premium" onClick={(e) => e.stopPropagation()}>
            <div className="clube-modal-icon-box reward-icon-box animate-pop">
              {successModal.amountGained ? (
                <PremiumDiamondSVG size={32} fill="#FFDF73" color="#FFDF73" style={{ filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.85))' }} />
              ) : (
                <CheckCircle size={28} color="#34C759" />
              )}
            </div>

            <div className="clube-modal-text">
              <span className="premium-congrats-tag">✨ RECOMPENSA INCRÍVEL ✨</span>
              {successModal.amountGained ? (
                <div className="reward-amount-display">
                  <span className="reward-plus">+</span>
                  <span className="reward-val-shimmer">{successModal.amountGained}</span>
                  <span className="reward-unit">Diamantes</span>
                </div>
              ) : (
                <h3 style={{ marginTop: 8 }}>{successModal.title}</h3>
              )}
              <p className="reward-premium-desc">{successModal.desc}</p>
            </div>

            {successModal.coupon && successModal.coupon !== 'CREDITADO' && (
              <div className="clube-modal-coupon-box" style={{ zIndex: 1 }}>
                <span className="coupon-label">CUPOM DE RESGATE</span>
                <span className="coupon-code-value">{successModal.coupon}</span>
              </div>
            )}

            <button 
              className="clube-modal-btn premium-btn-rainbow"
              onClick={() => {
                if (successModal.amountGained) {
                  import('canvas-confetti').then((confettiModule) => {
                    confettiModule.default({ 
                      particleCount: 80, 
                      angle: 90, 
                      spread: 55, 
                      origin: { y: 0.85 },
                      colors: ['#FFDF73', '#D4AF37', '#E7BC79', '#FFFFFF']
                    });
                  });
                }
                setSuccessModal(null);
              }}
            >
              Sensacional! 💎
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
