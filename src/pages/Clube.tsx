import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  Gem, 
  CheckCircle, 
  Check,
  UserPlus, 
  ShoppingBag, 
  Flame, 
  ArrowRight, 
  MessageCircle,
  ExternalLink,
  Truck,
  Trophy,
  X
} from 'lucide-react';
import { SeasonRanking } from '../components/SeasonRanking';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, updateDoc, arrayUnion, increment, collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { performCheckinTransaction } from '../services/checkinService';
import { useOrders } from '../hooks/useOrders';
import { useCart } from '../hooks/useCart';

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

const formatHistoryDate = (dateVal: any): string => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') return dateVal;
  if (dateVal instanceof Date) return dateVal.toLocaleString('pt-BR');
  if (typeof dateVal.toDate === 'function') return dateVal.toDate().toLocaleString('pt-BR');
  if (typeof dateVal.seconds === 'number') return new Date(dateVal.seconds * 1000).toLocaleString('pt-BR');
  return String(dateVal);
};

export const Clube = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [coins, setCoins] = useState<number>(0);

  const [popBadge, setPopBadge] = useState<boolean>(false);
  const [streak, setStreak] = useState<number>(0);
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [checkedIn, setCheckedIn] = useState<boolean>(false);
  const [vipProgress, setVipProgress] = useState<number>(0);
  const [vipTier, setVipTier] = useState<string>('Bronze');
  const [activeAd, setActiveAd] = useState<SponsorAd | null>(null);
  const [adTimer, setAdTimer] = useState<number>(3);
  const [isAdPlaying, setIsAdPlaying] = useState<boolean>(false);
  const [successModal, setSuccessModal] = useState<{
    title: string;
    coupon: string;
    desc: string;
    amountGained?: number;
    description?: string;
  } | null>(null);
  const [completedAds, setCompletedAds] = useState<string[]>([]);
  
  const [freeSpinUsed, setFreeSpinUsed] = useState<boolean>(false);
  const [showRanking, setShowRanking] = useState<boolean>(false);
  const [showReferralsModal, setShowReferralsModal] = useState<boolean>(false);

  // Dynamic points history ledgers
  const [history, setHistory] = useState<Array<{id: string; desc: string; date: string; value: string; isPlus: boolean}>>([]);

  const [sponsorAds, setSponsorAds] = useState<SponsorAd[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [profileMissions, setProfileMissions] = useState<{ order: boolean; refer: boolean; combo: boolean }>({ order: false, refer: false, combo: false });
  const [referredUsers, setReferredUsers] = useState<any[]>([]);

  const { orders } = useOrders(user?.uid || null);
  const { cartItems } = useCart();

  // Listen to referred users
  useEffect(() => {
    if (!user) return;
    const qRefer = query(collection(db, 'users'), where('referredBy', '==', user.uid));
    const unsubRefer = onSnapshot(qRefer, snap => {
      setReferredUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    return () => unsubRefer();
  }, [user]);

  // Fetch dynamic configurations from Admin Collections
  useEffect(() => {
    const unsub2 = onSnapshot(collection(db, 'premium_offers'), snap => {
      setSponsorAds(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    const unsub3 = onSnapshot(collection(db, 'diamond_rewards'), snap => {
      setRewards(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    return () => { unsub2(); unsub3(); };
  }, []);

  // Firebase Connection and Initialization
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    const clubeRef = doc(db, 'users', user.uid, 'clube', 'profile');
    
    const unsubscribe = onSnapshot(clubeRef, async (snap) => {
      if (!snap.exists()) {
        await setDoc(clubeRef, {
          diamonds: 320,
          streak: 1,
          lastCheckinDate: '',
          freeSpinUsed: false,
          freeSpinDate: '',
          history: [
            { id: '1', desc: 'Bem-vindo ao Clube!', date: 'Hoje', value: '+320', isPlus: true }
          ],
          missions: { order: false, refer: false, combo: false },
          completedAds: []
        });
      } else {
        const data = snap.data();
        setCoins(data.diamonds || 0);
        window.dispatchEvent(new Event('diamonds_updated'));
        
        const now = new Date();
        const todayUTC = now.toISOString().split('T')[0];
        const lastCheckinStr = data.last_checkin_at;
        
        let cDay = data.current_day || 1;
        let cStreak = data.streak || 0;
        
        if (lastCheckinStr) {
          const lastCheckinUTC = new Date(lastCheckinStr).toISOString().split('T')[0];
          
          if (todayUTC === lastCheckinUTC) {
            setCheckedIn(true);
          } else {
            setCheckedIn(false);
            const expectedNextDate = new Date(lastCheckinUTC);
            expectedNextDate.setUTCDate(expectedNextDate.getUTCDate() + 1);
            if (todayUTC !== expectedNextDate.toISOString().split('T')[0]) {
              // Missed a day
              cDay = 1;
              cStreak = 0;
            }
          }
        } else {
          setCheckedIn(false);
          cDay = 1;
          cStreak = 0;
        }
        
        setCurrentDay(cDay);
        setStreak(cStreak);
        const currentStreak = cStreak;
        
        if (currentStreak < 7) {
          setVipTier('Bronze');
          setVipProgress(Math.min((currentStreak / 7) * 100, 100));
        } else if (currentStreak < 30) {
          setVipTier('Prata');
          setVipProgress(Math.min(((currentStreak - 7) / 23) * 100, 100));
        } else {
          setVipTier('Ouro');
          setVipProgress(100);
        }
        
        const todayBr = new Date().toLocaleDateString('pt-BR');
        if (data.freeSpinDate !== todayBr) {
          setFreeSpinUsed(false);
        } else {
          setFreeSpinUsed(data.freeSpinUsed || false);
        }
        
        if (data.history) setHistory(data.history);
        if (data.completedAds) setCompletedAds(data.completedAds);
        if (data.missions) setProfileMissions(data.missions);
        
        setIsLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [user]);

  const completedReferralsCount = referredUsers.filter((u: any) => u.firstOrderPlaced).length;
  const hasDeliveredOrder = orders.some((o: any) => o.status === 'delivered');

  const missions: Mission[] = [
    { 
      id: 'm3', 
      title: 'Fazer Pedido', 
      rewardText: '+100 diamantes', 
      rewardVal: 100, 
      progressText: profileMissions.order 
        ? '1/1 pedido' 
        : (hasDeliveredOrder ? '1/1 concluído! Coletar' : '0/1 pedido'), 
      completed: profileMissions.order || false, 
      type: 'order' 
    },
    { 
      id: 'm4', 
      title: 'Indicar Amigo', 
      rewardText: '+80 diamantes', 
      rewardVal: 80, 
      progressText: profileMissions.refer 
        ? '3/3 indicados' 
        : `${Math.min(completedReferralsCount, 3)}/3 indicados`, 
      completed: profileMissions.refer || false, 
      type: 'refer' 
    },
    { 
      id: 'm5', 
      title: 'Comprar Combo', 
      rewardText: '+120 diamantes', 
      rewardVal: 120, 
      progressText: profileMissions.combo ? '1/1 combo' : '0/1 combo', 
      completed: profileMissions.combo || false, 
      type: 'combo' 
    },
  ];

  // Shimmering Gold Confetti explosion sequence (matching brand premium theme)
  useEffect(() => {
    if (successModal) {
      import('canvas-confetti').then((confettiModule) => {
        const confetti = confettiModule.default;
        const brandColors = ['#FFDF73', '#D4AF37', '#E7BC79', '#FFFFFF', '#FFF8DF'];
        
        // Stage 1: Left side golden fireworks cannon (180 particles, ticks: 300)
        confetti({
          particleCount: 180,
          angle: 60,
          spread: 75,
          origin: { x: 0, y: 0.85 },
          colors: brandColors,
          ticks: 300,
          scalar: 1.2
        });
        
        // Stage 2: Right side golden fireworks cannon (180 particles, ticks: 300)
        confetti({
          particleCount: 180,
          angle: 120,
          spread: 75,
          origin: { x: 1, y: 0.85 },
          colors: brandColors,
          ticks: 300,
          scalar: 1.2
        });

        // Stage 3: Center burst (200 particles)
        setTimeout(() => {
          confetti({
            particleCount: 200,
            spread: 90,
            origin: { y: 0.6 },
            colors: brandColors,
            ticks: 280,
            scalar: 1.15
          });
        }, 150);

        // Stage 4: Secondary double cannons
        setTimeout(() => {
          confetti({
            particleCount: 100,
            angle: 70,
            spread: 60,
            origin: { x: 0.1, y: 0.8 },
            colors: brandColors,
            ticks: 250,
            scalar: 1.0
          });
          confetti({
            particleCount: 100,
            angle: 110,
            spread: 60,
            origin: { x: 0.9, y: 0.8 },
            colors: brandColors,
            ticks: 250,
            scalar: 1.0
          });
        }, 300);
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
    }
    return () => clearInterval(interval);
  }, [isAdPlaying, adTimer]);

  // Lock scrolling when success modal or ad theater overlay is open
  useEffect(() => {
    if (successModal || isAdPlaying) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [successModal, isAdPlaying]);

  const updateFirebaseDoc = async (updates: any) => {
    if (!user) return;
    const clubeRef = doc(db, 'users', user.uid, 'clube', 'profile');
    try {
      await updateDoc(clubeRef, updates);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEarnCoins = async (amount: number, description: string) => {
    // Progressive Count-Up Ticker Animation for Coins Balance
    const startCoins = coins;
    const targetCoins = startCoins + amount;
    let tempCoins = startCoins;
    
    setPopBadge(true);
    
    // Smooth count-up duration: 2.4s (2400ms) for enhanced readability
    const durationMs = 2400;
    const stepTimeMs = 60;
    const totalSteps = durationMs / stepTimeMs;
    const incrementAmount = Math.max(1, Math.round(amount / totalSteps));
    
    const counterInterval = setInterval(() => {
      tempCoins += incrementAmount;
      if (tempCoins >= targetCoins) {
        tempCoins = targetCoins;
        clearInterval(counterInterval);
        setPopBadge(false);
      }
      setCoins(tempCoins);
    }, stepTimeMs);

    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes()}`;
    
    await updateFirebaseDoc({
      diamonds: increment(amount),
      history: arrayUnion({
        id: Math.random().toString(),
        desc: description,
        date: `Hoje, ${timeStr}`,
        value: `+${amount}`,
        isPlus: true
      })
    });
  };

  const handleCheckin = async () => {
    if (checkedIn || !user) return;
    
    // Optimistic UI lock
    setCheckedIn(true);
    
    try {
      const result = await performCheckinTransaction(user.uid);
      if (result.success) {
        setSuccessModal({
          title: 'Check-in Realizado!',
          desc: `Check-in Diário (Dia ${result.currentDay}). Fique ativo para acumular mais diamantes e resgatar prêmios!`,
          coupon: 'CREDITADO',
          amountGained: result.reward,
          description: `Check-in Diário (Dia ${result.currentDay})`
        });
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Erro ao fazer check-in.");
      setCheckedIn(false); // unlock if failed
    }
  };

  const handleAdClick = (ad: SponsorAd) => {
    setActiveAd(ad);
    setAdTimer(ad.duration);
    setIsAdPlaying(true);
  };

  const handleCopyReferralLink = () => {
    if (!user) return;
    const inviteUrl = `${window.location.origin}/register?ref=${user.uid}`;
    navigator.clipboard.writeText(inviteUrl);
    alert('Link de indicação exclusivo copiado! Envie para seus amigos.');
  };

  const handleReferReferralReward = async () => {
    if (profileMissions.refer) return;
    
    setSuccessModal({
      title: 'Indicações Concluídas!',
      desc: 'Parabéns por atingir a meta de 3 indicações qualificadas! Seus diamantes bônus foram ativados com sucesso!',
      coupon: 'CREDITADO',
      amountGained: 80,
      description: 'Missão: Indicar Amigo'
    });
    
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes()}`;
    
    await updateFirebaseDoc({
      'missions.refer': true,
      diamonds: increment(80),
      history: arrayUnion({
        id: Math.random().toString(),
        desc: 'Missão: Indicar Amigos (3/3)',
        date: `Hoje, ${timeStr}`,
        value: `+80`,
        isPlus: true
      })
    });
  };

  const handleCompleteOrder = async () => {
    if (profileMissions.order) return;
    
    setSuccessModal({
      title: 'Pedido Concluído!',
      desc: 'Parabéns por realizar o seu pedido! Seus diamantes bônus foram ativados com sucesso!',
      coupon: 'CREDITADO',
      amountGained: 100,
      description: 'Missão: Fazer Pedido'
    });
    
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes()}`;
    
    await updateFirebaseDoc({
      'missions.order': true,
      diamonds: increment(100),
      history: arrayUnion({
        id: Math.random().toString(),
        desc: 'Missão: Fazer Pedido',
        date: `Hoje, ${timeStr}`,
        value: `+100`,
        isPlus: true
      })
    });
  };

  const handleRedeemReward = async (reward: RewardItem) => {
    if (coins < reward.cost) {
      alert('Diamantes insuficientes para resgatar este benefício premium.');
      return;
    }
    
    setSuccessModal({
      title: 'Benefício Resgatado!',
      desc: `Parabéns! Você trocou seus diamantes por: ${reward.title}. Use o cupom abaixo no checkout.`,
      coupon: reward.code
    });
    
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes()}`;
    
    await updateFirebaseDoc({
      diamonds: increment(-reward.cost),
      history: arrayUnion({
        id: Math.random().toString(),
        desc: `Resgate: ${reward.title}`,
        date: `Hoje, ${timeStr}`,
        value: `-${reward.cost}`,
        isPlus: false
      })
    });
  };

  if (isLoading) {
    return (
      <main className="app clube-page">
        <header className="clube-topbar">
          <div className="safe-area-top-bg" style={{ background: 'var(--bg-secondary)' }} />
          <div className="clube-topbar-content">
            <div className="clube-logo-container">
              <span className="clube-logo-text">clube nosso jeito</span>
            </div>
            <div className="clube-coins-badge">
              <Gem size={11} />
              <span>--- diamantes</span>
            </div>
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
        <div className="safe-area-top-bg" style={{ background: 'var(--bg-secondary)' }} />
        <div className="clube-topbar-content">
          <div className="clube-logo-container">
            <Gem size={15} color="#FFDF73" style={{ filter: 'drop-shadow(0 0 4px rgba(212,175,55,0.6))' }} />
            <span className="clube-logo-text">clube nosso jeito</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button 
              onClick={() => setShowRanking(true)}
              style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 12, padding: 6, color: '#FFDF73', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trophy size={16} />
            </button>
            <div className={`clube-coins-badge ${popBadge ? 'pop' : ''}`}>
              <Gem size={11} fill="#FFDF73" />
              <span>{coins} diamantes</span>
            </div>
          </div>
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

      {/* NOVO BANNER/CARD DE ACESSO À ROLETA */}
      <div 
        onClick={() => !freeSpinUsed && navigate('/roleta')}
        style={{
          background: freeSpinUsed ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.06) 100%)',
          border: freeSpinUsed ? '1px solid rgba(255,255,255,0.1)' : '1.5px solid rgba(212,175,55,0.3)',
          borderRadius: 20,
          padding: '16px 20px',
          margin: '0 0 20px',
          cursor: freeSpinUsed ? 'default' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: freeSpinUsed ? 'none' : '0 8px 24px rgba(212,175,55,0.1)',
          transition: 'all 0.25s ease',
          position: 'relative',
          overflow: 'hidden',
          filter: freeSpinUsed ? 'grayscale(100%) opacity(0.8)' : 'none'
        }}
        className={`clube-roulette-banner ${freeSpinUsed ? '' : 'animate-scale-pulse'}`}
      >
        <style>{`.animate-scale-pulse { animation: scalePulse 2s infinite; } @keyframes scalePulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }`}</style>
        <div style={{ position: 'absolute', right: '-20px', top: '-10px', width: 100, height: 100, opacity: 0.15, background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        
        <div>
          <span style={{ fontSize: 9.5, fontWeight: 900, color: '#FFDF73', textTransform: 'uppercase', letterSpacing: 1 }}>Novidade Exclusiva</span>
          <h4 style={{ fontSize: 15, fontWeight: 900, color: '#fff', margin: '4px 0 2px', letterSpacing: -0.2 }}>Roleta da Sorte 🎰</h4>
          <p style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>Gire grátis diariamente ou use seus diamantes para ganhar!</p>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #FFDF73 100%)', width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(212,175,55,0.35)', flexShrink: 0 }}>
          <ArrowRight size={16} color="#000" strokeWidth={2.5} />
        </div>
      </div>

      {/* RANKING DA TEMPORADA (MODAL) */}
      {showRanking && createPortal(
        <div className="clube-modal-overlay" onClick={() => setShowRanking(false)} style={{ zIndex: 99999, backdropFilter: 'blur(8px)' }}>
          <div className="clube-modal-content" onClick={e => e.stopPropagation()} style={{ width: '92%', maxWidth: 420, padding: 0, overflow: 'hidden', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-gold)', background: 'var(--bg-secondary)' }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#FFDF73', display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={18} /> Ranking da Temporada</h3>
              <button onClick={() => setShowRanking(false)} style={{ background: 'var(--input-bg)', border: 'none', color: 'var(--text-secondary)', width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ maxHeight: '75vh', overflowY: 'auto', padding: '16px' }}>
              <SeasonRanking userPoints={coins * 12 + 4200} />
            </div>
          </div>
        </div>
      , document.body)}

      {/* MISSÕES DIÁRIAS (HORIZONTAL SCROLL) */}
      <div className="clube-section-title-row">
        <h3>Missões Diárias</h3>
        <span className="clube-section-streak-text">🔥 Streak ativo</span>
      </div>

      {/* WEEKLY CALENDAR COMPONENT FOR HIGH DOPAMINE ENGAGEMENT */}
      <div className="clube-weekly-calendar">
        {[...Array(7)].map((_, index) => {
          const dayNum = index + 1;
          
          let isCompleted = false;
          let isTodayPending = false;
          let isFuture = false;

          if (dayNum < currentDay) {
            isCompleted = true;
          } else if (dayNum === currentDay) {
            if (checkedIn) {
              isCompleted = true;
            } else {
              isTodayPending = true;
            }
          } else {
            isFuture = true;
          }

          const dayNames = ['Dia 1', 'Dia 2', 'Dia 3', 'Dia 4', 'Dia 5', 'Dia 6', 'Dia 7'];
          const rewardVal = dayNum === 7 ? 50 : dayNum >= 5 ? 20 : 15;

          // Classes
          let slotClass = 'weekly-day-slot ';
          if (isFuture) slotClass += 'locked ';
          if (isCompleted) slotClass += 'completed ';
          if (isTodayPending) slotClass += 'active ';

          return (
            <div 
              key={index} 
              className={slotClass.trim()}
              onClick={isTodayPending ? handleCheckin : undefined}
              title={isTodayPending ? 'Clique para fazer Check-in!' : undefined}
            >
              <span className="weekly-day-name">{dayNames[index]}</span>
              <div className="weekly-day-icon-wrap">
                {isCompleted ? (
                  <Check size={10} strokeWidth={3} />
                ) : (
                  <PremiumDiamondSVG size={10} fill={isTodayPending ? '#FFDF73' : 'none'} color={isTodayPending ? '#FFDF73' : 'rgba(255,255,255,0.2)'} />
                )}
              </div>
              <span className="weekly-day-val" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <PremiumDiamondSVG size={8} fill={isTodayPending ? '#FFDF73' : 'rgba(255,255,255,0.4)'} color={isTodayPending ? '#FFDF73' : 'rgba(255,255,255,0.4)'} />
                +{rewardVal}
              </span>
            </div>
          );
        })}
      </div>

      <div className="clube-missions-list">
        {missions.map(m => (
          <div className={`clube-mission-row ${m.completed ? 'completed' : ''}`} key={m.id}>
            <div className="clube-mission-left">
              <div className="clube-mission-icon-box">
                {m.type === 'order' && <ShoppingBag size={15} color={m.completed ? "#34C759" : "#D4AF37"} />}
                {m.type === 'refer' && <UserPlus size={15} color={m.completed ? "#34C759" : "#D4AF37"} />}
                {m.type === 'combo' && <Gem size={15} color={m.completed ? "#34C759" : "#D4AF37"} />}
              </div>
              <div className="clube-mission-details">
                <h4>{m.title}</h4>
                <p>{m.progressText}</p>
                {m.type === 'refer' && (
                  <button 
                    onClick={() => setShowReferralsModal(true)}
                    style={{ marginTop: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 10, padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Acompanhar Indicações
                  </button>
                )}
              </div>
            </div>
            <div className="clube-mission-right">
              <div className="clube-mission-reward-badge">
                <PremiumDiamondSVG size={10} fill="#FFDF73" color="#FFDF73" />
                <span>+{m.rewardVal}</span>
              </div>
               <button 
                className={`clube-mission-action-btn ${m.completed ? 'completed' : ''}`}
                onClick={() => {
                  if (m.type === 'order') {
                    if (hasDeliveredOrder) {
                      handleCompleteOrder();
                    } else {
                      if (cartItems.length > 0) {
                        navigate('/cart');
                      } else {
                        navigate('/');
                      }
                    }
                  }
                  if (m.type === 'refer') {
                    if (completedReferralsCount >= 3) {
                      handleReferReferralReward();
                    } else {
                      handleCopyReferralLink();
                    }
                  }
                }}
                disabled={m.completed}
              >
                {m.completed 
                  ? 'Concluído' 
                  : (m.type === 'order' 
                      ? (hasDeliveredOrder ? 'Coletar' : 'Fazer') 
                      : (m.type === 'refer' 
                          ? (completedReferralsCount >= 3 ? 'Coletar' : 'Indicar') 
                          : 'Fazer'
                        )
                    )
                }
              </button>
            </div>
          </div>
        ))}
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
                <span>{formatHistoryDate(h.date)}</span>
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
      {isAdPlaying && activeAd && createPortal((() => {
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

                {/* Circular Story Countdown Timer (Turns into Close X Button when completed) */}
                <div 
                  className={`clube-ad-theater-timer-circle ${adTimer === 0 ? 'ad-completed-closeable' : ''}`}
                  onClick={() => {
                    if (adTimer === 0) {
                      // Finalize active ad playback
                      setIsAdPlaying(false);
                      
                      // Trigger success modal setup
                      if (activeAd.type === 'shipping') {
                        setSuccessModal({
                          title: 'Frete Grátis Ativado!',
                          desc: 'Seu cupom de frete grátis exclusivo da marca Do Bem já está disponível na carteira!',
                          coupon: 'DOBEMFRETE'
                        });
                      } else {
                        setSuccessModal({
                          title: `+${activeAd.rewardVal} Diamantes Ganhos!`,
                          desc: `Obrigado por assistir ao conteúdo patrocinado de ${activeAd.brand}. Seus diamantes foram adicionados.`,
                          coupon: 'CREDITADO',
                          amountGained: activeAd.rewardVal,
                          description: `Anúncio Assistido (${activeAd.brand})`
                        });
                      }
                      
                      // Mark ad completed in Firestore and state
                      updateFirebaseDoc({
                        completedAds: arrayUnion(activeAd.id)
                      }).catch(e => console.error("Error saving completed ad:", e));
                      
                      setCompletedAds(prev => [...prev, activeAd.id]);
                      setActiveAd(null);
                    }
                  }}
                  style={adTimer === 0 ? { cursor: 'pointer' } : undefined}
                >
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
                      strokeDashoffset={adTimer === 0 ? 0 : progressOffset}
                      style={adTimer === 0 ? { stroke: '#FFDF73' } : undefined}
                    />
                  </svg>
                  {adTimer === 0 ? (
                    <span className="clube-ad-theater-timer-text" style={{ fontSize: 16, fontWeight: 900, color: '#FFDF73' }}>✕</span>
                  ) : (
                    <span className="clube-ad-theater-timer-text">{adTimer}s</span>
                  )}
                </div>
              </div>

              {/* Bottom Spotlight Info and Timeline Progress */}
              <div className="clube-ad-theater-bottom-spotlight">
                <div className="clube-ad-theater-subtitles">
                  <h3 className="clube-ad-theater-ad-title" style={{ color: '#fff', fontSize: 16, fontWeight: 900, margin: '6px 0 2px' }}>{activeAd.title}</h3>
                  <p className="clube-ad-theater-ad-desc" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, margin: '0 0 8px' }}>{activeAd.desc}</p>
                  <p className="clube-ad-theater-reward-hint" style={{ color: adTimer === 0 ? '#34C759' : '#FFDF73', fontSize: 10.5, fontWeight: 800 }}>
                    {adTimer === 0 
                      ? "Recompensa Liberada! 🎉"
                      : (activeAd.rewardVal > 0 
                          ? `Aguarde mais ${adTimer} segundos para resgatar +${activeAd.rewardVal} Diamantes!` 
                          : `Aguarde mais ${adTimer} segundos para ativar o seu Frete Grátis!`
                        )
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
      })(), document.body)}

      {/* SUCCESS MODAL POPUP */}
      {successModal && createPortal((
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
                  // Capture modal values for deferred execution
                  const amount = successModal.amountGained;
                  const descText = successModal.description || 'Recompensa Creditada';
                  
                  const startEl = document.querySelector('.reward-icon-box');
                  const targetEl = document.querySelector('.clube-coins-badge');
                  
                  if (startEl && targetEl) {
                    const startRect = startEl.getBoundingClientRect();
                    const targetRect = targetEl.getBoundingClientRect();
                    
                    const flyer = document.createElement('div');
                    flyer.style.position = 'fixed';
                    flyer.style.left = `${startRect.left + startRect.width / 2}px`;
                    flyer.style.top = `${startRect.top + startRect.height / 2}px`;
                    flyer.style.transform = 'translate(-50%, -50%)';
                    flyer.style.zIndex = '99999';
                    flyer.style.display = 'flex';
                    flyer.style.alignItems = 'center';
                    flyer.style.gap = '4px';
                    flyer.style.fontSize = '18px';
                    flyer.style.fontWeight = '900';
                    flyer.style.color = '#FFDF73';
                    flyer.style.textShadow = '0 0 6px rgba(212,175,55,0.75)';
                    flyer.style.pointerEvents = 'none';
                    flyer.style.transition = 'all 2.5s cubic-bezier(0.25, 1, 0.5, 1)';
                    
                    flyer.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 0 6px rgba(212,175,55,0.75))"><path d="M6 2L18 2L22 8L12 22L2 8L6 2Z" stroke="#FFDF73" stroke-width="1.5" stroke-linejoin="round" fill="#FFDF73" /><path d="M6 2L12 8L18 2" stroke="#FFDF73" stroke-width="1" stroke-linejoin="round" /><path d="M2 8H22" stroke="#FFDF73" stroke-width="1" stroke-linejoin="round" /><path d="M12 8V22" stroke="#FFDF73" stroke-width="1" stroke-linejoin="round" /><path d="M6 2L2 8L12 22" stroke="#FFDF73" stroke-width="1" stroke-linejoin="round" /><path d="M18 2L22 8L12 22" stroke="#FFDF73" stroke-width="1" stroke-linejoin="round" /></svg><span>+${amount}</span>`;
                    
                    document.body.appendChild(flyer);
                    
                    flyer.getBoundingClientRect();
                    
                    flyer.style.left = `${targetRect.left + targetRect.width / 2}px`;
                    flyer.style.top = `${targetRect.top + targetRect.height / 2}px`;
                    flyer.style.transform = 'translate(-50%, -50%) scale(0.5)';
                    flyer.style.opacity = '1';
                    
                    setTimeout(() => flyer.remove(), 2500);
                  }
                  
                  // Explode secondary golden confetti cascade instantly
                  import('canvas-confetti').then((confettiModule) => {
                    confettiModule.default({ 
                      particleCount: 80, 
                      angle: 90, 
                      spread: 55, 
                      origin: { y: 0.85 },
                      colors: ['#FFDF73', '#D4AF37', '#E7BC79', '#FFFFFF']
                    });
                  });

                  // Close success modal instantly so user sees the background
                  setSuccessModal(null);

                  // Defer points incrementation until flight animation hits the wallet
                  setTimeout(() => {
                    handleEarnCoins(amount, descText);
                  }, 2500);
                } else {
                  setSuccessModal(null);
                }
              }}
            >
              Sensacional! 💎
            </button>
          </div>
        </div>
      ), document.body)}

      {/* REFERRALS TRACKING MODAL */}
      {showReferralsModal && createPortal((
        <div className="clube-modal-overlay" onClick={() => setShowReferralsModal(false)} style={{ backdropFilter: 'blur(8px)', zIndex: 99999 }}>
          <div className="clube-modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '92%', maxWidth: 400, background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: 0 }}>
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-gold)', background: 'var(--bg-secondary)' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus size={16} /> Acompanhar Indicações</h3>
              <button onClick={() => setShowReferralsModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>Acompanhe o status dos amigos que você indicou. Cada amigo que se cadastrar e realizar o primeiro pedido garante +80 diamantes na sua carteira!</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '300px', overflowY: 'auto' }}>
                {referredUsers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>
                    Nenhuma indicação cadastrada ainda. Compartilhe seu link!
                  </div>
                ) : (
                  referredUsers.map((referred) => (
                    <div key={referred.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <strong style={{ fontSize: 13, color: '#fff' }}>{referred.name}</strong>
                        <span style={{ 
                          fontSize: 10, 
                          background: referred.firstOrderPlaced ? 'rgba(52,199,89,0.2)' : 'rgba(245,158,11,0.2)', 
                          color: referred.firstOrderPlaced ? '#34C759' : '#F59E0B', 
                          padding: '2px 6px', 
                          borderRadius: 8 
                        }}>
                          {referred.firstOrderPlaced ? 'Pedido Realizado (+80 💎)' : 'Cadastro Realizado (Pendente)'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span>Status: {referred.firstOrderPlaced ? 'Pedido Concluído' : 'Aguardando 1º pedido'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* DEV RESET BUTTON */}
      <div style={{ padding: '20px', textAlign: 'center', marginBottom: 40 }}>
        <button 
          onClick={async () => {
            if (window.confirm('Limpar todos os diamantes, histórico e missões de TODOS os usuários para iniciar os testes do zero?')) {
              try {
                const usersSnap = await getDocs(collection(db, 'users'));
                for (const uDoc of usersSnap.docs) {
                  await setDoc(doc(db, 'users', uDoc.id, 'clube', 'profile'), {
                    diamonds: 0,
                    current_day: 0,
                    streak: 0,
                    history: [],
                    freeSpinUsed: false,
                    missions: {}
                  });
                }
                alert('Dados limpos com sucesso para TODOS os usuários! A página será recarregada.');
                window.location.reload();
              } catch (e) {
                console.error(e);
                alert('Erro ao limpar dados de todos os usuários.');
              }
            }
          }}
          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '10px 20px', borderRadius: 12, fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}
        >
          Limpar Dados (Teste)
        </button>
      </div>

    </main>
  );
};
