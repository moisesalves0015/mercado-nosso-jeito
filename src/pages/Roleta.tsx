import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gem, ArrowLeft, Award, Clock, Coins, Zap, TrendingUp, Flame, Gift, Volume2, VolumeX } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import confetti from 'canvas-confetti';

interface RouletteItem {
  text: string;
  color: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  multiplier?: number;
}

interface SpinHistory {
  text: string;
  date: string;
  rarity: string;
  won: boolean;
}


const RARITY_CONFIG = {
  common: { color: "#6B7280", glow: "none", points: 5, label: "COMUM", icon: "⭐" },
  rare: { color: "#3B82F6", glow: "0 0 10px #3B82F6", points: 15, label: "RARO", icon: "🌟" },
  epic: { color: "#8B5CF6", glow: "0 0 15px #8B5CF6", points: 50, label: "ÉPICO", icon: "💫" },
  legendary: { color: "#F59E0B", glow: "0 0 20px #F59E0B", points: 100, label: "LENDÁRIO", icon: "👑" }
};

const DEFAULT_ITEMS: RouletteItem[] = [
  { text: "15 💎", color: "#D4AF37", rarity: "common", multiplier: 1 },
  { text: "Monster Gelado", color: "#E25C1D", rarity: "rare", multiplier: 1.5 },
  { text: "Tente de Novo", color: "#1E150F", rarity: "common", multiplier: 0 },
  { text: "Frete Grátis", color: "#059669", rarity: "rare", multiplier: 1.2 },
  { text: "50 💎 + Bônus", color: "#D4AF37", rarity: "epic", multiplier: 2 },
  { text: "20% OFF", color: "#5B21B6", rarity: "rare", multiplier: 1.3 },
  { text: "Cerveja Spaten", color: "#059669", rarity: "epic", multiplier: 1.8 },
  { text: "100 💎 JACKPOT", color: "#F59E0B", rarity: "legendary", multiplier: 3 },
  { text: "Tente de Novo", color: "#1E150F", rarity: "common", multiplier: 0 },
  { text: "Dobrar Prêmio", color: "#DC2626", rarity: "epic", multiplier: 2.5 }
];

const mapToPremiumColor = (_color: string, index: number): string => {
  const mod = index % 3;
  if (mod === 0) return "linear-gradient(to bottom, #FFDF73 0%, #D4AF37 55%, #AA8214 100%)";
  if (mod === 1) return "linear-gradient(to bottom, #2C2C2C 0%, #151515 55%, #0A0A0A 100%)";
  return "linear-gradient(to bottom, #FFFFFF 0%, #D1D1D1 55%, #8E8E8E 100%)";
};

const getTextColorForBackground = (colorGradient: string) => {
  if (colorGradient.includes("#FFDF73") || colorGradient.includes("#FFFFFF")) {
    return "#121212";
  }
  return "#FFDF73";
};

export const Roleta: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<RouletteItem[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ text: string; rarity: string } | null>(null);
  
  const [history, setHistory] = useState<SpinHistory[]>(() => {
    const saved = localStorage.getItem('roulette_history_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [diamonds, setDiamonds] = useState<number>(() => {
    const saved = localStorage.getItem('user_diamonds');
    return saved ? parseInt(saved, 10) : 320;
  });

  const [multiplier, setMultiplier] = useState<number>(1);
  const [combo, setCombo] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('roulette_sound') !== 'false';
  });

  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [showJackpot, setShowJackpot] = useState(false);

  const [freeSpinsLeft, setFreeSpinsLeft] = useState<number>(() => {
    const saved = localStorage.getItem('free_spins_left_v2');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [lastFreeSpin, setLastFreeSpin] = useState<number>(() => {
    const saved = localStorage.getItem('last_free_spin_v2');
    return saved ? parseInt(saved, 10) : 0;
  });

  const audioContext = useRef<AudioContext | null>(null);
  const particleIdRef = useRef(0);

  // Persist free spins left
  useEffect(() => {
    localStorage.setItem('free_spins_left_v2', freeSpinsLeft.toString());
  }, [freeSpinsLeft]);

  // Sound effects helper
  const playSound = useCallback((type: 'spin' | 'win' | 'rare' | 'epic' | 'legendary' | 'lose') => {
    if (!soundEnabled) return;
    
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContext.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      switch(type) {
        case 'spin':
          oscillator.frequency.value = 350;
          gainNode.gain.value = 0.08;
          oscillator.type = 'sine';
          gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.35);
          break;
        case 'win':
          oscillator.frequency.value = 523.25; // C5
          gainNode.gain.value = 0.15;
          oscillator.type = 'sine';
          setTimeout(() => {
            if (oscillator && ctx.state !== 'closed') oscillator.frequency.value = 659.25; // E5
          }, 110);
          gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.6);
          break;
        case 'rare':
          oscillator.frequency.value = 587.33; // D5
          gainNode.gain.value = 0.18;
          oscillator.type = 'triangle';
          setTimeout(() => {
            if (oscillator && ctx.state !== 'closed') oscillator.frequency.value = 783.99; // G5
          }, 90);
          gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
          break;
        case 'epic':
          oscillator.frequency.value = 659.25; // E5
          gainNode.gain.value = 0.22;
          oscillator.type = 'sawtooth';
          setTimeout(() => {
            if (oscillator && ctx.state !== 'closed') oscillator.frequency.value = 987.77; // B5
          }, 100);
          gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.7);
          break;
        case 'legendary':
          [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => {
              if (ctx.state === 'closed') return;
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = freq;
              gain.gain.value = 0.15;
              gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.4);
              osc.start();
              osc.stop(ctx.currentTime + 0.4);
            }, i * 120);
          });
          return;
        case 'lose':
          oscillator.frequency.value = 220;
          gainNode.gain.value = 0.12;
          oscillator.type = 'sawtooth';
          gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.45);
          break;
      }
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.7);
    } catch (e) {
      console.warn("AudioContext failed to start or play sound:", e);
    }
  }, [soundEnabled]);

  // Click particles effect
  const addParticles = useCallback((x: number, y: number, count: number = 20) => {
    for (let i = 0; i < count; i++) {
      const id = particleIdRef.current++;
      setParticles(prev => [...prev, { id, x: x + (Math.random() - 0.5) * 120, y: y + (Math.random() - 0.5) * 120 }]);
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== id));
      }, 1000);
    }
  }, []);

  // Sync with Firestore diamonds if user is logged in
  useEffect(() => {
    if (user) {
      const fetchUserDiamonds = async () => {
        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.diamonds !== undefined) {
              setDiamonds(data.diamonds);
              localStorage.setItem('user_diamonds', data.diamonds.toString());
              window.dispatchEvent(new Event('diamonds_updated'));
            }
          }
        } catch (e) {
          console.error("Erro ao ler diamantes do Firestore:", e);
        }
      };
      fetchUserDiamonds();
    }
  }, [user]);

  // Load configuration from Firestore configs/roulette
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'configs', 'roulette'));
        if (docSnap.exists() && docSnap.data().items) {
          setItems(docSnap.data().items);
        } else {
          setItems(DEFAULT_ITEMS);
        }
      } catch (e) {
        console.error("Erro ao ler config do Firestore:", e);
        setItems(DEFAULT_ITEMS);
      }
    };
    fetchConfig();
  }, []);

  // Check and update free spins left (3 per day)
  useEffect(() => {
    const now = Date.now();
    const diff = now - lastFreeSpin;
    const hours24 = 24 * 60 * 60 * 1000;
    if (diff >= hours24) {
      setFreeSpinsLeft(3);
      setLastFreeSpin(now);
      localStorage.setItem('last_free_spin_v2', now.toString());
    }
  }, [lastFreeSpin]);

  const handleDiamondsUpdate = async (amount: number) => {
    const newTotal = Math.max(0, diamonds + amount);
    setDiamonds(newTotal);
    localStorage.setItem('user_diamonds', newTotal.toString());
    window.dispatchEvent(new Event('diamonds_updated'));

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { diamonds: newTotal });
      } catch (e) {
        console.error("Erro ao atualizar diamantes no Firestore:", e);
      }
    }
  };

  const triggerConfetti = (rarity: string) => {
    const colors = {
      common: ['#6B7280', '#D4AF37'],
      rare: ['#3B82F6', '#60A5FA', '#FFFFFF'],
      epic: ['#8B5CF6', '#A78BFA', '#C084FC', '#FFDF73'],
      legendary: ['#F59E0B', '#FBBF24', '#FCD34D', '#FFDF73', '#E25C1D']
    };

    const selectedColors = colors[rarity as keyof typeof colors] || colors.common;
    
    confetti({
      particleCount: rarity === 'legendary' ? 220 : 120,
      spread: rarity === 'legendary' ? 100 : 75,
      origin: { y: 0.6 },
      colors: selectedColors,
      startVelocity: rarity === 'legendary' ? 25 : 18,
      decay: 0.92
    });

    if (rarity === 'epic' || rarity === 'legendary') {
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { x: 0.15, y: 0.65 },
          colors: selectedColors
        });
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { x: 0.85, y: 0.65 },
          colors: selectedColors
        });
      }, 250);
    }
  };

  const spin = (isFree: boolean) => {
    if (spinning || items.length === 0) return;
    if (!isFree && diamonds < 30 && freeSpinsLeft === 0) {
      alert("💎 Você precisa de 30 diamantes ou usar um giro grátis!");
      return;
    }

    setSpinning(true);
    setResult(null);
    playSound('spin');

    if (isFree && freeSpinsLeft > 0) {
      setFreeSpinsLeft(prev => prev - 1);
    } else if (!isFree) {
      handleDiamondsUpdate(-30);
    }

    const n = items.length;
    let randomIndex = Math.floor(Math.random() * n);
    
    // Weighted rarity validation
    const selectedRarity = items[randomIndex].rarity;
    if (selectedRarity === 'legendary' && Math.random() > 0.08) {
      randomIndex = Math.floor(Math.random() * n);
    } else if (selectedRarity === 'epic' && Math.random() > 0.20) {
      randomIndex = Math.floor(Math.random() * n);
    }

    const degPerSlice = 360 / n;
    // stop exact center of the winning slice
    const stopRotation = 360 - (randomIndex + 0.5) * degPerSlice;
    const nextRotation = rotation + (360 * 12) + stopRotation - (rotation % 360);
    setRotation(nextRotation);
    
    setTimeout(() => {
      const wonItem = items[randomIndex];
      const rarity = wonItem.rarity || 'common';
      
      let finalText = wonItem.text;
      let isWin = true;
      
      if (finalText.toLowerCase().includes("tente de novo") || finalText.includes("😢")) {
        isWin = false;
        setCombo(0);
        setStreak(prev => Math.max(0, prev - 1));
        playSound('lose');
      } else {
        // Tolerant regex matching both '💎' and 'Diamante/s'
        const diamondMatch = finalText.match(/(\d+)\s*(?:Diamante|Diamantes|💎)/i);
        if (diamondMatch) {
          const amount = Math.floor(parseInt(diamondMatch[1], 10) * multiplier);
          finalText = `${amount} 💎 ${multiplier > 1 ? `(x${multiplier} Bônus!)` : ''}`;
          handleDiamondsUpdate(amount);
        }
        
        setCombo(prev => prev + 1);
        setStreak(prev => prev + 1);
        
        if (multiplier < 10 && combo >= 2) {
          setMultiplier(prev => Math.min(10, prev + 0.5));
        }
        
        playSound(rarity as any);
        triggerConfetti(rarity);
        
        if (rarity === 'legendary') {
          setShowJackpot(true);
          setTimeout(() => setShowJackpot(false), 3000);
        }
      }
      
      const dateStr = new Date().toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newHistory = [{ text: finalText, date: dateStr, rarity, won: isWin }, ...history].slice(0, 50);
      setHistory(newHistory);
      localStorage.setItem('roulette_history_v2', JSON.stringify(newHistory));
      
      setResult({ text: finalText, rarity });
      setSpinning(false);
      
      addParticles(window.innerWidth / 2, window.innerHeight / 2, isWin ? 35 : 12);
    }, 10200); // 10.2s matching the ease-out transition
  };

  const resetMultiplier = () => {
    setMultiplier(1);
    setCombo(0);
  };

  const getNextFreeSpinTimeLeft = () => {
    const diff = Date.now() - lastFreeSpin;
    const hours24 = 24 * 60 * 60 * 1000;
    const timeLeft = hours24 - diff;
    if (timeLeft <= 0 || freeSpinsLeft > 0) return "Disponível";
    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
  };

  const n = items.length;
  const deg = n > 0 ? 360 / n : 360;
  const itemWidth = n > 0 ? Math.tan(((deg / 2) * Math.PI) / 180) * 160 * 2 : 0;
  const bdWidth = itemWidth / 2;

  const wrapperStyle = {
    '--len': n,
    '--width': `${itemWidth}px`,
    '--bdWidth': `${bdWidth}px`,
    '--deg': `${deg}deg`,
  } as React.CSSProperties;

  return (
    <main className="app roulette-page-container" style={{ backgroundColor: '#090705', minHeight: '100vh', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Supermarket blurred and darkened background image overlay - exactly matching product details styling */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url("/bg-supermercado.jpeg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(1.5px) brightness(0.45)',
          opacity: 1,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(9, 7, 5, 0) 40%, rgba(9, 7, 5, 1) 100%)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Dynamic particles render */}
      {particles.map(particle => (
        <div
          key={particle.id}
          style={{
            position: 'fixed',
            left: particle.x,
            top: particle.y,
            width: 5,
            height: 5,
            background: 'radial-gradient(circle, #FFDF73, #D4AF37)',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 9999,
            animation: 'particleFade 1s ease-out forwards'
          }}
        />
      ))}

      {/* Jackpot Award Announcement overlay */}
      {showJackpot && (
        <div className="jackpot-overlay" style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(135deg, #F59E0B, #FFDF73)',
          padding: '24px 44px',
          borderRadius: 24,
          zIndex: 10000,
          animation: 'jackpotPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          textAlign: 'center',
          boxShadow: '0 0 60px rgba(245, 158, 11, 0.95)',
          border: '3px solid #fff'
        }}>
          <span style={{ fontSize: 36, display: 'block', fontWeight: 900, color: '#090705' }}>🏆 JACKPOT! 🏆</span>
          <span style={{ fontSize: 18, fontWeight: '900', color: '#090705', textTransform: 'uppercase', letterSpacing: 0.5 }}>Prêmio Lendário!</span>
        </div>
      )}

      {/* HEADER */}
      <header className="clube-topbar" style={{ marginBottom: 12, padding: '12px 16px', position: 'relative', zIndex: 2 }}>
        <button onClick={() => navigate('/clube')} className="roulette-back-btn" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={16} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Clube</span>
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button 
            onClick={() => {
              const nextVal = !soundEnabled;
              setSoundEnabled(nextVal);
              localStorage.setItem('roulette_sound', nextVal.toString());
            }} 
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {soundEnabled ? <Volume2 size={18} color="#D4AF37" /> : <VolumeX size={18} />}
          </button>
 
          <div className="clube-coins-badge">
            <Gem size={12} fill="#FFDF73" color="#FFDF73" />
            <span>{diamonds} diamantes</span>
          </div>
        </div>
      </header>

      {/* Streak and multiplier counters */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(9, 7, 5, 0.65)', padding: '5px 12px', borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
          <Flame size={13} color="#F59E0B" fill="#F59E0B" />
          <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 'bold' }}>{streak} Sequência</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(212, 175, 55, 0.15)', padding: '5px 12px', borderRadius: 12, border: '1px solid rgba(212, 175, 55, 0.35)' }}>
          <TrendingUp size={13} color="#D4AF37" />
          <span style={{ fontSize: 11, color: '#FFDF73', fontWeight: 'bold' }}>{multiplier.toFixed(1)}x Bônus</span>
        </div>

        {combo >= 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(139, 92, 246, 0.15)', padding: '5px 12px', borderRadius: 12, border: '1px solid rgba(139, 92, 246, 0.3)', animation: 'pulse 1.5s infinite' }}>
            <Zap size={13} color="#8B5CF6" fill="#8B5CF6" />
            <span style={{ fontSize: 11, color: '#A78BFA', fontWeight: 'bold' }}>COMBO x{combo}!</span>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="roulette-card-body" style={{ zIndex: 2 }}>
        <h2 style={{ fontSize: '1.5em', fontWeight: 900, textAlign: 'center', marginBottom: 4, letterSpacing: -0.3, background: 'linear-gradient(90deg, #D4AF37, #FFDF73, #F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Roleta Premium
        </h2>
        <p style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', marginBottom: 20 }}>
          Gire e multiplique seus prêmios do clube! 🎰
        </p>

        {/* HTML/CSS Roulette Wheel Area */}
        <div className="roulette-container" onClick={(e) => addParticles(e.clientX, e.clientY, 8)}>
          <div className="roulette-wrapper" style={wrapperStyle}>
            <div className="pin" style={{ boxShadow: '0 0 10px rgba(212,175,55,0.45)' }}></div>
            <button 
              type="button" 
              className="btnStart"
              onClick={() => spin(freeSpinsLeft > 0)}
              disabled={spinning || items.length === 0}
              style={{ background: 'radial-gradient(circle at 30% 30%, #D4AF37, #8B6914)', boxShadow: '0 0 20px rgba(212,175,55,0.45)' }}
            >
              {spinning ? (
                <span style={{ fontSize: '9.5px', color: '#090705', fontWeight: 900, lineHeight: 1.1, textTransform: 'uppercase', textAlign: 'center' }}>
                  NOSSO<br/>CLUBE
                </span>
              ) : freeSpinsLeft > 0 ? (
                <>
                  <span style={{ fontSize: '8px', color: '#090705', fontWeight: 800 }}>{freeSpinsLeft} GRÁTIS</span>
                  <span style={{ fontSize: '11px', color: '#090705', fontWeight: 900 }}>GIRAR</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '10px', color: '#090705', fontWeight: 900 }}>GIRAR</span>
                  <span style={{ fontSize: '10px', color: '#090705', fontWeight: 900 }}>ROLETA</span>
                </>
              )}
            </button>
            <div className="circleWrap">
              <div 
                className={`rouleWrap ${spinning ? 'active' : ''}`}
                style={{ 
                  transform: `rotate(${rotation}deg)`, 
                  transition: spinning ? 'transform 10s cubic-bezier(0.15, 0.85, 0.2, 1)' : 'none' 
                }}
              >
                {items.map((item, i) => {
                  const itemColor = mapToPremiumColor(item.color, i);
                  const textColor = getTextColorForBackground(itemColor);
                  const rarityConfig = RARITY_CONFIG[item.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common;

                  const itemStyle = {
                    '--idx': i + 1,
                    '--bg-color': itemColor,
                    transform: `rotate(calc(var(--deg) * ${i} + var(--deg) / 2))`
                  } as React.CSSProperties;

                  // Limpar emojis e encurtar textos de desconto
                  let cleanText = item.text
                    .replace(/de\s+desconto/gi, 'OFF')
                    .replace(/desconto/gi, 'OFF')
                    .replace(/([\uD800-\uDBFF][\uD800-\uDFFF]|\u00ae|\u00a9|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g, '')
                    .trim();

                  const isDiamond = item.text.toLowerCase().includes('💎') || item.text.toLowerCase().includes('diamante');
                  let displayContent: React.ReactNode;

                  if (isDiamond) {
                    const numMatch = item.text.match(/(\d+)/);
                    const num = numMatch ? numMatch[1] : '';
                    let remaining = cleanText
                      .replace(num, '')
                      .replace(/diamantes?/i, '')
                      .replace(/\s+/g, ' ')
                      .trim();

                    const mainText = `+${num}${remaining ? ` ${remaining}` : ''}`;

                    displayContent = (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        {mainText.split(' ').map((word, wIdx) => (
                          <strong 
                            key={wIdx} 
                            className="roulette-word-line"
                            style={{ fontSize: items.length > 8 ? '0.70rem' : '0.84rem', fontWeight: 900 }}
                          >
                            {word}
                          </strong>
                        ))}
                        <Gem size={13} color={textColor} style={{ marginTop: 2 }} />
                      </div>
                    );
                  } else {
                    displayContent = (
                      <>
                        {cleanText.split(' ').map((word, wIdx) => (
                          <strong 
                            key={wIdx} 
                            className="roulette-word-line"
                            style={{ fontSize: items.length > 8 ? '0.70rem' : '0.84rem', fontWeight: 900 }}
                          >
                            {word}
                          </strong>
                        ))}
                      </>
                    );
                  }

                  return (
                    <div key={i} className="item" style={itemStyle}>
                      <div 
                        className="bx" 
                        style={{ 
                          color: textColor, 
                          textShadow: textColor === '#121212' ? 'none' : '0 1px 2px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.65)',
                          boxShadow: rarityConfig.glow !== 'none' ? rarityConfig.glow : undefined
                        }}
                      >
                        {displayContent}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="roulette-shine-overlay" />
            </div>
            <div className="dotWrap">
              {items.map((_, i) => {
                const dotStyle = {
                  '--idx': i + 1,
                  transform: `rotate(calc(var(--deg) * ${i}))`
                } as React.CSSProperties;
                return <div key={i} style={dotStyle}></div>;
              })}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="roulette-controls" style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 300, margin: '24px auto 0' }}>
          
          {freeSpinsLeft > 0 ? (
            <button 
              className="roulette-spin-btn free-spin animate-pulse"
              onClick={() => spin(true)}
              disabled={spinning || items.length === 0}
              style={{ flex: 1, background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: '#fff', padding: '12px 8px', borderRadius: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Gift size={14} />
              <span>{freeSpinsLeft} Grátis</span>
            </button>
          ) : (
            <button 
              className="roulette-spin-btn locked-spin"
              disabled={true}
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', padding: '12px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', opacity: 0.85 }}
            >
              <Clock size={13} />
              <span style={{ fontSize: '10px' }}>Grátis em {getNextFreeSpinTimeLeft()}</span>
            </button>
          )}

          <button 
            className="roulette-spin-btn diamond-spin"
            onClick={() => spin(false)}
            disabled={spinning || items.length === 0 || diamonds < 30}
            style={{ 
              flex: 1,
              background: diamonds < 30 ? 'rgba(255,255,255,0.02)' : 'linear-gradient(135deg, #D4AF37, #B8942E)', 
              color: diamonds < 30 ? 'rgba(255,255,255,0.25)' : '#090705',
              border: diamonds < 30 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              padding: '12px 8px',
              borderRadius: 12,
              fontWeight: 900,
              cursor: diamonds < 30 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Coins size={14} />
            <span>30 💎</span>
          </button>
        </div>

        {/* Reset Multiplier link button */}
        {multiplier > 1 && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button 
              onClick={resetMultiplier} 
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)', padding: '4px 10px', borderRadius: 8, fontSize: 10, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
            >
              Resetar Bônus
            </button>
          </div>
        )}

        {/* Prize won banner */}
        {result && (
          <div 
            className="prize-won-announcement animate-pop" 
            style={{ 
              marginTop: 20, 
              padding: '14px 18px', 
              background: `linear-gradient(135deg, ${(RARITY_CONFIG[result.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common).color}15 0%, rgba(0,0,0,0.5) 100%)`, 
              border: `1px solid ${(RARITY_CONFIG[result.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common).color}`, 
              borderRadius: 16, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: 4 
            }}
          >
            <span style={{ fontSize: 9.5, fontWeight: 900, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🎉 Prêmio {(RARITY_CONFIG[result.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common).label} Conquistado! 🎉
            </span>
            <span style={{ fontSize: 16, fontWeight: 900, color: (RARITY_CONFIG[result.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common).color, textAlign: 'center' }}>
              {result.text}
            </span>
            {result.text.includes("😢") ? (
              <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Mais sorte no próximo giro!</span>
            ) : (
              <span style={{ fontSize: 9.5, color: '#2ecc71', fontWeight: 800, marginTop: 2 }}>Prêmio adicionado à sua conta!</span>
            )}
          </div>
        )}
      </div>

      {/* HISTORY SECTION */}
      <div className="clube-wallet-section" style={{ marginTop: 20, padding: '16px 20px 20px', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Award size={15} color="#D4AF37" />
            <span style={{ fontSize: 12, fontWeight: 900, color: '#fff', letterSpacing: -0.2 }}>Últimos Prêmios</span>
          </div>
          <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)' }}>({history.length}/50 giros)</span>
        </div>
        
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            Gire a roleta para começar a ganhar! 🎰
          </div>
        ) : (
          <div className="clube-ledger-history" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
            {history.map((h, index) => {
              const config = RARITY_CONFIG[h.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common;
              return (
                <div key={index} className="clube-ledger-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '7px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>{config.icon}</span>
                    <span style={{ fontWeight: 700, color: h.won ? config.color : 'rgba(255,255,255,0.45)' }}>{h.text}</span>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9.5 }}>{h.date}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes particleFade {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0); }
        }
        @keyframes jackpotPop {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.15); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        .animate-pulse {
          animation: pulse 1.6s infinite ease-in-out;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
};
