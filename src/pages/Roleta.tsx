import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gem, ArrowLeft, Award, Clock, Coins } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';

interface RouletteItem {
  text: string;
  color: string;
}

// Pastel soft colors matching template
const DEFAULT_COLORS = [
  "#f87b8c", "#ffb366", "#ffe066", "#7ee6c8", "#7ecbff", "#6fa8ff", "#a68cff", "#ffb3c6", "#ffd6a5", "#b7e4c7"
];

const DEFAULT_ITEMS: RouletteItem[] = [
  { text: "15 Diamantes 💎", color: DEFAULT_COLORS[0] },
  { text: "Monster Gelado ⚡", color: DEFAULT_COLORS[1] },
  { text: "Tente de Novo 😢", color: DEFAULT_COLORS[2] },
  { text: "Frete Grátis 🚚", color: DEFAULT_COLORS[3] },
  { text: "50 Diamantes 💎", color: DEFAULT_COLORS[4] },
  { text: "10% de Desconto 🏷️", color: DEFAULT_COLORS[5] },
  { text: "Cerveja Spaten 🍺", color: DEFAULT_COLORS[6] },
  { text: "100 Diamantes 💎", color: DEFAULT_COLORS[7] },
  { text: "Tente de Novo 😢", color: DEFAULT_COLORS[8] }
];

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

    // Calculate rotation: 5 full spins + degrees to align slice center to pointer top (270 degrees)
    const degPerSlice = 360 / n;
    const extraDegrees = 270 - (randomIndex * degPerSlice + degPerSlice / 2);
    
    // Add multiple spins and align
    const nextRotation = rotation + (360 * 6) + extraDegrees - (rotation % 360);
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

    // Trigger canvas confetti
    import('canvas-confetti').then((confettiModule) => {
      const confetti = confettiModule.default;
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#FFDF73', '#D4AF37', '#7ecbff', '#FFFFFF', '#f87b8c']
      });
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

  // SVG calculations for React rendering
  const width = 320;
  const height = 320;
  const cx = width / 2;
  const cy = height / 2;
  const r = 140;
  const n = items.length;

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

        {/* Roulette SVG Area */}
        <div className="roulette-area">
          <div className="roulette-area-bg"></div>
          
          {/* Static outline ring */}
          <svg className="roulette-outline animate-glow" width="320" height="320" viewBox="0 0 320 320">
            <circle cx="160" cy="160" r="141" fill="none" stroke="#D4AF37" strokeWidth="2.5" style={{ filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.4))' }} />
            <circle cx="160" cy="160" r="144" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.8" />
          </svg>

          {/* Golden pointer */}
          <div className="pointer-wrap">
            <svg width="34" height="28" viewBox="0 0 34 28">
              <polygon points="0,0 34,0 17,28" fill="#D4AF37" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }} />
              <polygon points="4,2 30,2 17,22" fill="#FFDF73" />
            </svg>
          </div>

          {/* Dynamic SVG Wheel */}
          <svg 
            id="roulette" 
            className="roulette-svg" 
            width="320" 
            height="320" 
            viewBox="0 0 320 320"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4.5s cubic-bezier(0.1, 0.8, 0.1, 1)' : 'none'
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {items.map((item, i) => {
              const startAngle = (2 * Math.PI * i) / n - Math.PI / 2;
              const endAngle = (2 * Math.PI * (i + 1)) / n - Math.PI / 2;
              const x1 = cx + r * Math.cos(startAngle);
              const y1 = cy + r * Math.sin(startAngle);
              const x2 = cx + r * Math.cos(endAngle);
              const y2 = cy + r * Math.sin(endAngle);
              const largeArc = ((endAngle - startAngle + 2 * Math.PI) % (2 * Math.PI)) > Math.PI ? 1 : 0;
              
              const pathData = [
                `M ${cx} ${cy}`,
                `L ${x1} ${y1}`,
                `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
                'Z'
              ].join(' ');

              const textAngle = (startAngle + endAngle) / 2;
              const tx = cx + (r * 0.6) * Math.cos(textAngle);
              const ty = cy + (r * 0.6) * Math.sin(textAngle);
              const rotationAngle = (textAngle * 180) / Math.PI;

              // Cap text length if too long
              const capText = item.text.length > 18 ? item.text.substring(0, 16) + '..' : item.text;

              return (
                <g key={i}>
                  {/* Slice */}
                  <path 
                    d={pathData} 
                    fill={item.color} 
                    stroke="rgba(9,7,5,0.7)" 
                    strokeWidth="0.8" 
                  />
                  
                  {/* Shadow/Backdrop of Text */}
                  <text 
                    x={tx} 
                    y={ty + 0.8} 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    fontSize={n > 8 ? "9px" : "10px"} 
                    fill="#000" 
                    opacity="0.6"
                    fontWeight="800"
                    fontFamily="Manrope, sans-serif"
                    transform={`rotate(${rotationAngle}, ${tx}, ${ty})`}
                    style={{ filter: 'blur(1px)' }}
                  >
                    {capText}
                  </text>

                  {/* Main white text */}
                  <text 
                    x={tx} 
                    y={ty} 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    fontSize={n > 8 ? "9px" : "10px"} 
                    fill="#fff" 
                    fontWeight="800"
                    fontFamily="Manrope, sans-serif"
                    transform={`rotate(${rotationAngle}, ${tx}, ${ty})`}
                  >
                    {capText}
                  </text>
                </g>
              );
            })}
          </svg>
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
