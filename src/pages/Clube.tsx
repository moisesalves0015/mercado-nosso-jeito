import { useState, useEffect } from 'react';
import { 
  Gem, 
  CheckCircle, 
  Play, 
  UserPlus, 
  ShoppingBag, 
  Flame, 
  ArrowRight, 
  Sparkles
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
  desc: string;
  logo: string;
  rewardVal: number;
  type: 'coins' | 'shipping';
}

interface RewardItem {
  id: string;
  title: string;
  cost: number;
  desc: string;
  image: string;
  code: string;
}

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
  const [successModal, setSuccessModal] = useState<{title: string; coupon: string; desc: string} | null>(null);

  // Simulated points history ledgers
  const [history, setHistory] = useState<Array<{id: string; desc: string; date: string; value: string; isPlus: boolean}>>([
    { id: '1', desc: 'Indicação de Amigo (Marcos)', date: 'Hoje, 10:42', value: '+80', isPlus: true },
    { id: '2', desc: 'Check-in Diário (Dia 6)', date: 'Ontem, 08:15', value: '+15', isPlus: true },
    { id: '3', desc: 'Desconto Resgatado R$ 5,00', date: '15 Mai, 19:30', value: '-150', isPlus: false },
    { id: '4', desc: 'Pedido Completado #8942', date: '14 Mai, 14:22', value: '+100', isPlus: true },
  ]);

  const [missions, setMissions] = useState<Mission[]>([
    { id: 'm1', title: 'Check-in Diário', rewardText: '+15 moedas', rewardVal: 15, progressText: '0/1 dia', completed: false, type: 'checkin' },
    { id: 'm2', title: 'Assistir Anúncio', rewardText: '+50 moedas', rewardVal: 50, progressText: '0/1 vídeo', completed: false, type: 'ad' },
    { id: 'm3', title: 'Fazer Pedido', rewardText: '+100 moedas', rewardVal: 100, progressText: '0/1 pedido', completed: false, type: 'order' },
    { id: 'm4', title: 'Indicar Amigo', rewardText: '+80 moedas', rewardVal: 80, progressText: '0/3 indicados', completed: false, type: 'refer' },
    { id: 'm5', title: 'Comprar Combo', rewardText: '+120 moedas', rewardVal: 120, progressText: '0/1 combo', completed: false, type: 'combo' },
  ]);

  const sponsorAds: SponsorAd[] = [
    { id: 'ad1', brand: 'Melitta', desc: 'Assista e ganhe 50 moedas do café perfeito.', logo: '/cafe-novo.png', rewardVal: 50, type: 'coins' },
    { id: 'ad2', brand: 'Danone Grego', desc: 'Assista ao spot do Danone Grego e ganhe 40 moedas.', logo: '/iogurte-novo.webp', rewardVal: 40, type: 'coins' },
    { id: 'ad3', brand: 'Do Bem', desc: 'Conheça os sucos integrais e garanta frete grátis.', logo: '/suco_do_bem_laranja_integral.png', rewardVal: 0, type: 'shipping' },
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
      
      if (activeAd?.type === 'shipping') {
        setSuccessModal({
          title: 'Frete Grátis Ativado!',
          desc: 'Seu cupom de frete grátis exclusivo da marca Do Bem já está disponível na carteira!',
          coupon: 'DOBEMFRETE'
        });
      } else {
        setSuccessModal({
          title: `+${activeAd?.rewardVal} Moedas Ganhas!`,
          desc: `Obrigado por assistir ao conteúdo patrocinado de ${activeAd?.brand}. Suas moedas foram adicionadas.`,
          coupon: 'CREDITADO'
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
    setAdTimer(3);
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
      alert('Moedas insuficientes para resgatar este benefício premium.');
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
      desc: `Parabéns! Você trocou suas moedas por: ${reward.title}. Use o cupom abaixo no checkout.`,
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
            <span>--- moedas</span>
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
          <span>{coins} moedas</span>
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
          <p>Complete missões diárias, assista a spots exclusivos e troque suas moedas por produtos, cupons e frete grátis.</p>
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

      <div className="clube-missions-scroll">
        {/* CHECK-IN CARD */}
        <div className={`clube-mission-card ${checkedIn ? 'completed' : ''}`}>
          <div className="clube-mission-icon-box">
            <CheckCircle size={15} color={checkedIn ? "#34C759" : "#D4AF37"} />
          </div>
          <div className="clube-mission-info">
            <h4>Check-in Diário</h4>
            <p>{missions[0].rewardText}</p>
          </div>
          <button 
            className={`clube-mission-btn ${checkedIn ? 'completed' : ''}`}
            onClick={handleCheckin}
            disabled={checkedIn}
          >
            {checkedIn ? 'Resgatado' : 'Check-in'}
          </button>
        </div>

        {/* AD CARD */}
        <div className={`clube-mission-card ${missions[1].completed ? 'completed' : ''}`}>
          <div className="clube-mission-icon-box">
            <Play size={14} color={missions[1].completed ? "#34C759" : "#D4AF37"} />
          </div>
          <div className="clube-mission-info">
            <h4>Assistir Spot</h4>
            <p>{missions[1].rewardText}</p>
          </div>
          <button 
            className={`clube-mission-btn ${missions[1].completed ? 'completed' : ''}`}
            onClick={() => handleAdClick(sponsorAds[0])}
            disabled={missions[1].completed}
          >
            {missions[1].completed ? 'Concluído' : 'Assistir'}
          </button>
        </div>

        {/* REFER FRIEND */}
        <div className={`clube-mission-card ${missions[3].completed ? 'completed' : ''}`}>
          <div className="clube-mission-icon-box">
            <UserPlus size={14} color={missions[3].completed ? "#34C759" : "#D4AF37"} />
          </div>
          <div className="clube-mission-info">
            <h4>Indicar Amigo</h4>
            <p>{missions[3].rewardText}</p>
          </div>
          <button 
            className={`clube-mission-btn ${missions[3].completed ? 'completed' : ''}`}
            onClick={handleReferral}
            disabled={missions[3].completed}
          >
            {missions[3].completed ? 'Concluído' : 'Indicar'}
          </button>
        </div>

        {/* COMPLETE ORDER */}
        <div className={`clube-mission-card ${missions[2].completed ? 'completed' : ''}`}>
          <div className="clube-mission-icon-box">
            <ShoppingBag size={14} color={missions[2].completed ? "#34C759" : "#D4AF37"} />
          </div>
          <div className="clube-mission-info">
            <h4>Fazer Pedido</h4>
            <p>{missions[2].rewardText}</p>
          </div>
          <button 
            className={`clube-mission-btn ${missions[2].completed ? 'completed' : ''}`}
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

      {/* ÁREA DE ANÚNCIOS OPCIONAIS (SPONSORED) */}
      <div className="clube-section-title-row">
        <h3>Ofertas Patrocinadas Premium</h3>
      </div>
      <div className="clube-ads-grid">
        {sponsorAds.map((ad) => (
          <div className="clube-ad-card" key={ad.id}>
            <div className="clube-ad-left">
              <div className="clube-ad-logo-box">
                <img src={ad.logo} alt={ad.brand} />
              </div>
              <div className="clube-ad-text">
                <h4>{ad.brand} Especial</h4>
                <p>{ad.desc}</p>
              </div>
            </div>
            <button 
              className="clube-ad-btn"
              onClick={() => handleAdClick(ad)}
            >
              {ad.type === 'shipping' ? 'Ativar Frete' : 'Assistir'}
            </button>
          </div>
        ))}
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
            <span style={{ color: '#34C759' }}>+95 moedas</span>
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

      {/* RESGATE DE BENEFÍCIOS (TROQUE SUAS MOEDAS) */}
      <div className="clube-section-title-row">
        <h3>Troque suas Moedas</h3>
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
              <span className="clube-reward-cost-text">{reward.cost} moedas</span>
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

      {/* SPONSOR VIDEO MODAL POPUP */}
      {isAdPlaying && activeAd && (
        <div className="clube-modal-overlay">
          <div className="clube-modal-content" style={{ borderColor: '#FFDF73' }}>
            <div className="clube-modal-icon-box" style={{ animation: 'spin 2s linear infinite' }}>
              <Sparkles size={20} />
            </div>
            <div className="clube-modal-text">
              <h3>Spot Patrocinado: {activeAd.brand}</h3>
              <p style={{ marginTop: 6 }}>
                Carregando a melhor experiência de mercado do nosso jeito...
              </p>
              <p style={{ color: '#D4AF37', fontWeight: 800, marginTop: 12, fontSize: 13 }}>
                Ganhando recompensas em {adTimer} segundos
              </p>
            </div>
            <div className="clube-modal-coupon-box" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Patrocinador Oficial</span>
              <span style={{ fontSize: 12, letterSpacing: '0.2px' }}>{activeAd.desc}</span>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL POPUP */}
      {successModal && (
        <div className="clube-modal-overlay" onClick={() => setSuccessModal(null)}>
          <div className="clube-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="clube-modal-icon-box">
              <CheckCircle size={22} color="#34C759" />
            </div>
            <div className="clube-modal-text">
              <h3>{successModal.title}</h3>
              <p>{successModal.desc}</p>
            </div>
            {successModal.coupon !== 'CREDITADO' && (
              <div className="clube-modal-coupon-box">
                {successModal.coupon}
              </div>
            )}
            <button 
              className="clube-modal-btn"
              onClick={() => setSuccessModal(null)}
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
