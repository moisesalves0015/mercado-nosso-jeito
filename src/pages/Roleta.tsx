import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gem, ArrowLeft, Award, Clock, Coins } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import confetti from 'canvas-confetti';

interface RouletteItem {
  text: string;
  color: string;
}

const PREMIUM_COLORS = [
  "#D4AF37", // Dourado Ouro (Home)
  "#1E150F", // Marrom Café Profundo (Home)
  "#E25C1D", // Laranja Vibrante (Home)
  "#5B21B6", // Roxo Premium (Home)
  "#059669"  // Verde Esmeralda (Home)
];

const DEFAULT_ITEMS: RouletteItem[] = [
  { text: "15 Diamantes 💎", color: "#D4AF37" },
  { text: "Monster Gelado ⚡", color: "#E25C1D" },
  { text: "Tente de Novo 😢", color: "#1E150F" },
  { text: "Frete Grátis 🚚", color: "#059669" },
  { text: "50 Diamantes 💎", color: "#D4AF37" },
  { text: "10% de Desconto 🏷️", color: "#5B21B6" },
  { text: "Cerveja Spaten 🍺", color: "#059669" },
  { text: "100 Diamantes 💎", color: "#D4AF37" },
  { text: "Tente de Novo 😢", color: "#1E150F" }
];

const mapToPremiumColor = (color: string, index: number): string => {
  if (!color) return PREMIUM_COLORS[index % PREMIUM_COLORS.length];
  const c = color.toLowerCase();
  const pastelMap: Record<string, string> = {
    "#f87b8c": "#E25C1D",
    "#ffb3c6": "#E25C1D",
    "#ffb366": "#D4AF37",
    "#ffe066": "#D4AF37",
    "#ffd6a5": "#D4AF37",
    "#7ee6c8": "#059669",
    "#b7e4c7": "#059669",
    "#7ecbff": "#5B21B6",
    "#6fa8ff": "#5B21B6",
    "#a68cff": "#5B21B6"
  };
  return pastelMap[c] || color;
};

const getTextColorForBackground = (hexColor: string) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
  const hex = hexColor.replace('#', '');
  let r = 0, g = 0, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
  } else if (hex.length >= 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    return '#ffffff';
  }
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#090705' : '#FFDF73';
};

export const Roleta: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<RouletteItem[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ text: string; date: string }>>(() => {
    const saved = localStorage.getItem('roulette_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [diamonds, setDiamonds] = useState<number>(() => {
    const saved = localStorage.getItem('user_diamonds');
    return saved ? parseInt(saved, 10) : 320;
  });

  const [lastFreeSpin, setLastFreeSpin] = useState<number>(() => {
    const saved = localStorage.getItem('last_free_spin');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [isFreeSpinAvailable, setIsFreeSpinAvailable] = useState(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

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
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            setItems(data.items);
          } else {
            setItems(DEFAULT_ITEMS);
          }
        } else {
          setItems(DEFAULT_ITEMS);
        }
      } catch (e) {
        console.error("Erro ao ler configuração da roleta:", e);
        setItems(DEFAULT_ITEMS);
      }
    };
    fetchConfig();
  }, []);

  // Check if free spin is available (24 hours rule)
  useEffect(() => {
    const now = Date.now();
    const diff = now - lastFreeSpin;
    const hours24 = 24 * 60 * 60 * 1000;
    setIsFreeSpinAvailable(diff >= hours24);
  }, [lastFreeSpin]);

  const handleEarnDiamonds = async (amount: number) => {
    const newTotal = diamonds + amount;
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

  const handleDeductDiamonds = async (amount: number) => {
    const newTotal = Math.max(0, diamonds - amount);
    setDiamonds(newTotal);
    localStorage.setItem('user_diamonds', newTotal.toString());
    window.dispatchEvent(new Event('diamonds_updated'));

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { diamonds: newTotal });
      } catch (e) {
        console.error("Erro ao deduzir diamantes no Firestore:", e);
      }
    }
  };

  const spin = (isFree: boolean) => {
    if (spinning || items.length === 0) return;
    if (!isFree && diamonds < 30) {
      alert("Você precisa de pelo menos 30 diamantes 💎 para girar!");
      return;
    }

    setSpinning(true);
    setResult(null);

    // Pay for the spin
    if (isFree) {
      const now = Date.now();
      setLastFreeSpin(now);
      localStorage.setItem('last_free_spin', now.toString());
      setIsFreeSpinAvailable(false);
    } else {
      handleDeductDiamonds(30);
    }

    const n = items.length;
    const randomIndex = Math.floor(Math.random() * n);
    setTargetIndex(randomIndex);

    const degPerSlice = 360 / n;
    // Calculate rotation to align the slice to the top pin (12 o'clock / 0 or 360 deg)
    const stopRotation = 360 - (randomIndex + 1) * degPerSlice;
    const nextRotation = rotation + (360 * 10) + stopRotation - (rotation % 360);
    setRotation(nextRotation);
  };

  const handleTransitionEnd = () => {
    if (targetIndex === null || !spinning) return;
    setSpinning(false);
    
    const wonItem = items[targetIndex];
    setResult(wonItem.text);

    // Add to local history
    const dateStr = new Date().toLocaleString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const newHistory = [{ text: wonItem.text, date: dateStr }, ...history].slice(0, 30);
    setHistory(newHistory);
    localStorage.setItem('roulette_history', JSON.stringify(newHistory));

    // Handle rewards processing
    const diamondMatch = wonItem.text.match(/(\d+)\s+Diamante/i);
    if (diamondMatch) {
      const amount = parseInt(diamondMatch[1], 10);
      handleEarnDiamonds(amount);
    }

    // Trigger rich multi-burst canvas confetti
    const confettiColors = ['#FFDF73', '#D4AF37', '#E25C1D', '#5B21B6', '#FFFFFF'];
    
    // Left burst
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.8 },
      colors: confettiColors
    });
    
    // Right burst
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.8 },
      colors: confettiColors
    });
    
    // Center splash
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.65 },
      colors: confettiColors
    });
  };

  // Helper to format remaining time for free spin
  const getNextFreeSpinTimeLeft = () => {
    const diff = Date.now() - lastFreeSpin;
    const hours24 = 24 * 60 * 60 * 1000;
    const timeLeft = hours24 - diff;
    if (timeLeft <= 0) return "Disponível";
    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
  };

  // Calculations for dynamic HTML/CSS roulette
  const n = items.length;
  const deg = n > 0 ? 360 / n : 360;
  // radius = 160px for a 320px diameter wheel
  const itemWidth = n > 0 ? Math.tan(((deg / 2) * Math.PI) / 180) * 160 * 2 : 0;
  const bdWidth = itemWidth / 2;

  const wrapperStyle = {
    '--len': n,
    '--width': `${itemWidth}px`,
    '--bdWidth': `${bdWidth}px`,
    '--deg': `${deg}deg`,
  } as React.CSSProperties;

  const rouleStyle = {
    transform: `rotate(${rotation}deg)`,
    transition: spinning ? 'transform 10s cubic-bezier(0.15, 0.85, 0.2, 1)' : 'none'
  } as React.CSSProperties;

  const handleCenterSpinClick = () => {
    if (isFreeSpinAvailable) {
      spin(true);
    } else {
      spin(false);
    }
  };

  return (
    <main className="app roulette-page-container">
      {/* HEADER */}
      <header className="clube-topbar" style={{ marginBottom: 12 }}>
        <button onClick={() => navigate('/clube')} className="roulette-back-btn" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={16} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Clube</span>
        </button>
        
        <div className="clube-coins-badge">
          <Gem size={12} fill="#FFDF73" color="#FFDF73" />
          <span>{diamonds} diamantes</span>
        </div>
      </header>

      {/* BODY */}
      <div className="roulette-card-body">
        <h2 style={{ fontSize: '1.4em', fontWeight: 900, textAlign: 'center', marginBottom: 4, letterSpacing: -0.3, background: 'linear-gradient(90deg, #D4AF37, #FFDF73)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Roleta da Sorte
        </h2>
        <p style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', marginBottom: 20 }}>
          Gire e concorra a prêmios especiais do clube!
        </p>

        {/* New HTML/CSS Roulette Area */}
        <div className="roulette-container">
          <div className="roulette-wrapper" style={wrapperStyle}>
            <div className="pin"></div>
            <button 
              type="button" 
              className="btnStart"
              onClick={handleCenterSpinClick}
              disabled={spinning || items.length === 0}
            >
              {spinning ? (
                <span style={{ fontSize: '10px' }}>GIRANDO</span>
              ) : isFreeSpinAvailable ? (
                <>
                  <span style={{ fontSize: '9px', color: '#ffca12', fontWeight: 800 }}>GRÁTIS</span>
                  <span style={{ fontSize: '13px' }}>START</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '9px', fontWeight: 800 }}>JOGAR</span>
                  <span style={{ fontSize: '13px' }}>START</span>
                </>
              )}
            </button>
            <div className="circleWrap">
              <div 
                className={`rouleWrap ${spinning ? 'active' : ''}`}
                style={rouleStyle}
                onTransitionEnd={handleTransitionEnd}
              >
                {items.map((item, i) => {
                  const itemColor = mapToPremiumColor(item.color, i);
                  const textColor = getTextColorForBackground(itemColor);

                  const itemStyle = {
                    '--idx': i + 1,
                    '--bg-color': itemColor,
                    transform: `rotate(calc(var(--deg) * ${i + 1}))`
                  } as React.CSSProperties;

                  // Extract emoji to show in separate line
                  const emojiMatch = item.text.match(/([\uD800-\uDBFF][\uD800-\uDFFF]|\u00ae|\u00a9|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g);
                  const emoji = emojiMatch ? emojiMatch[0] : '';
                  const cleanText = item.text.replace(emoji, '').trim();

                  return (
                    <div key={i} className="item" style={itemStyle}>
                      <div 
                        className="bx" 
                        style={{ 
                          color: textColor, 
                          textShadow: textColor === '#090705' ? 'none' : '0 1px 2px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.65)' 
                        }}
                      >
                        <span className="txt" style={{ color: textColor === '#090705' ? 'rgba(9, 7, 5, 0.45)' : 'rgba(255, 255, 255, 0.45)' }}>
                          PRÊMIO
                        </span>
                        {cleanText.split(' ').map((word, wIdx) => (
                          <strong 
                            key={wIdx} 
                            className="roulette-word-line"
                            style={{ fontSize: items.length > 8 ? '0.72rem' : '0.86rem' }}
                          >
                            {word}
                          </strong>
                        ))}
                        {emoji && <span className="img" style={{ fontSize: '1.05rem', marginTop: 4 }}>{emoji}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="dotWrap">
                {items.map((_, i) => {
                  const dotStyle = {
                    '--idx': i + 1,
                    transform: `rotate(calc(var(--deg) * ${i + 1} - (var(--deg) / 2)))`
                  } as React.CSSProperties;
                  return <div key={i} style={dotStyle}></div>;
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="roulette-controls" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280, margin: '16px auto 0' }}>
          
          {isFreeSpinAvailable ? (
            <button 
              className="roulette-spin-btn free-spin animate-pulse"
              onClick={() => spin(true)}
              disabled={spinning || items.length === 0}
            >
              <span>🎁 Giro Grátis Diário</span>
            </button>
          ) : (
            <button 
              className="roulette-spin-btn locked-spin"
              disabled={true}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', opacity: 0.85 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <Clock size={13} />
                <span>Giro Grátis em {getNextFreeSpinTimeLeft()}</span>
              </div>
            </button>
          )}

          <button 
            className="roulette-spin-btn diamond-spin"
            onClick={() => spin(false)}
            disabled={spinning || items.length === 0 || diamonds < 30}
            style={diamonds < 30 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <Coins size={14} />
              <span>Girar por 30 💎</span>
            </div>
          </button>
        </div>

        {/* Prize popup banner */}
        {result && (
          <div className="prize-won-announcement animate-pop" style={{ marginTop: 20, padding: '14px 18px', background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.04) 100%)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Prêmio Conquistado!</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#FFDF73', textAlign: 'center' }}>{result}</span>
            {result.includes("😢") && (
              <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Mais sorte no próximo giro!</span>
            )}
            {!result.includes("😢") && (
              <span style={{ fontSize: 9.5, color: '#2ecc71', fontWeight: 800, marginTop: 2 }}>Prêmio adicionado à sua conta!</span>
            )}
          </div>
        )}
      </div>

      {/* HISTORY LEDGER */}
      <div className="clube-wallet-section" style={{ marginTop: 16, padding: '16px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Award size={15} color="#D4AF37" />
          <span style={{ fontSize: 12, fontWeight: 900, color: '#fff', letterSpacing: -0.2 }}>Seus Giros Recentes</span>
        </div>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            Nenhum prêmio conquistado recentemente.
          </div>
        ) : (
          <div className="clube-ledger-history" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map((h, index) => (
              <div key={index} className="clube-ledger-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{h.text}</span>
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>{h.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
