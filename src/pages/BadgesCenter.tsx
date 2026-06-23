import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { useBadges } from '../hooks/useBadges';
import type { BadgeCategory, BadgeDef } from '../hooks/useBadges';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function BadgesCenter() {
  const navigate = useNavigate();
  const { badges, unlockedIds } = useBadges();
  
  // Modal state
  const [selectedBadge, setSelectedBadge] = useState<BadgeDef | null>(null);

  const categories: BadgeCategory[] = ['Pertencimento', 'Compra', 'Constância', 'Diamantes', 'Especiais', 'Secretos'];

  // Stats
  const unlockedCount = unlockedIds.length;
  const totalCount = badges.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100) || 0;

  // Render Stars based on Rarity
  const renderRarityStars = (rarity: string) => {
    if (rarity === 'mitico') return '✨✨✨';
    if (rarity === 'lendario') return '⭐⭐';
    if (rarity === 'epico') return '⭐';
    return null;
  };

  return (
    <div style={{
      position: 'relative', minHeight: '100vh',
      background: 'var(--bg-primary)', // Fundo principal da Home
      fontFamily: "'Manrope','Outfit',sans-serif",
      paddingBottom: '60px',
    }}>
      {/* ── HEADER ──────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--bg-secondary)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-primary)',
        padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)', borderRadius: '50%',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0, marginRight: 8
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
              Minha Estante
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 40px', fontWeight: 500 }}>
            Construa sua história na comunidade.
          </p>
        </div>
      </div>

      <div style={{ padding: '20px 0' }}>
        {/* ── CARD PRINCIPAL (PROGRESSO) ──────────────── */}
        <div style={{
          background: 'var(--card-gradient)', borderRadius: 24, padding: 20, margin: '0 20px 32px',
          border: '1px solid var(--border-primary)', boxShadow: 'var(--card-shadow)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Coleção do Morador</h2>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{unlockedCount}/{totalCount} selos conquistados</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#D4AF37' }}>{progressPercent}%</div>
          </div>
          <div style={{ width: '100%', height: 10, background: 'var(--border-primary)', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #D4AF37, #FFDF73)', borderRadius: 99 }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
            Continue participando para desbloquear novos selos.
          </p>
        </div>

        {/* ── CATEGORY SHELVES (PRATELEIRAS) ────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {categories.map(category => {
            const catBadges = badges.filter(b => b.category === category);
            if (catBadges.length === 0) return null;

            return (
              <div key={category}>
                <div style={{ padding: '0 20px', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {category === 'Pertencimento' && '🏢'}
                    {category === 'Compra' && '🛒'}
                    {category === 'Constância' && '🔥'}
                    {category === 'Diamantes' && '💎'}
                    {category === 'Especiais' && '🎉'}
                    {category === 'Secretos' && '❓'}
                    {category === 'Secretos' ? 'Secretos' : category}
                  </h3>
                </div>

                {/* Horizontal Scroll Shelf */}
                <div style={{
                  display: 'flex', gap: 16, overflowX: 'auto', padding: '0 20px 8px', scrollbarWidth: 'none',
                  WebkitOverflowScrolling: 'touch'
                }}>
                  {catBadges.map(badge => {
                    const isUnlocked = unlockedIds.includes(badge.id);
                    const isSecretHidden = badge.secret && !isUnlocked;
                    
                    let borderCol = 'var(--border-primary)';
                    let glow = 'none';
                    if (isUnlocked) {
                      if (badge.rarity === 'mitico') { borderCol = '#9B5DE5'; glow = '0 0 12px rgba(155, 93, 229, 0.4)'; }
                      if (badge.rarity === 'lendario') { borderCol = '#FFC107'; glow = '0 0 12px rgba(255, 193, 7, 0.4)'; }
                      if (badge.rarity === 'epico') { borderCol = '#FB8500'; glow = '0 0 12px rgba(251, 133, 0, 0.4)'; }
                      if (badge.rarity === 'raro') { borderCol = '#4CC9F0'; glow = '0 0 12px rgba(76, 201, 240, 0.4)'; }
                      if (badge.rarity === 'comum') borderCol = '#06D6A0';
                    }

                    return (
                      <div
                        key={badge.id}
                        onClick={() => setSelectedBadge(badge)}
                        style={{
                          minWidth: 80, width: 80, height: 80,
                          background: isUnlocked ? 'var(--card-bg)' : 'var(--input-bg)',
                          border: `1px solid ${borderCol}`, borderRadius: 20,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', position: 'relative',
                          flexShrink: 0,
                          boxShadow: glow,
                          transition: 'transform 0.2s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        {!isUnlocked && (
                          <div style={{ position: 'absolute', top: -4, right: -4, background: 'var(--bg-primary)', borderRadius: '50%', padding: 4, border: '1px solid var(--border-primary)' }}>
                            <Lock size={10} color="var(--text-muted)" />
                          </div>
                        )}

                        <div style={{
                          fontSize: 32,
                          filter: isUnlocked ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' : 'grayscale(100%) brightness(0.4)',
                        }}>
                          {isSecretHidden ? '?' : badge.icon}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── EXPANSION MODAL ────────────────────────────── */}
      {selectedBadge && (
        <div
          onClick={() => setSelectedBadge(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'var(--overlay-bg)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, animation: 'fadeIn 0.2s ease'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)', borderRadius: 32, padding: '40px 24px',
              width: '100%', maxWidth: 360, position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              border: `1px solid ${unlockedIds.includes(selectedBadge.id) ? selectedBadge.color : 'var(--border-primary)'}`,
              boxShadow: `var(--card-shadow)`,
              animation: 'slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <button
              onClick={() => setSelectedBadge(null)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'var(--back-btn-bg)', border: 'none', borderRadius: '50%',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-primary)', cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            {(() => {
              const isUnlocked = unlockedIds.includes(selectedBadge.id);
              const isSecretHidden = selectedBadge.secret && !isUnlocked;
              
              let rarityLabel = 'Comum';
              if (selectedBadge.rarity === 'raro') rarityLabel = 'Raro';
              if (selectedBadge.rarity === 'epico') rarityLabel = 'Épico';
              if (selectedBadge.rarity === 'lendario') rarityLabel = 'Lendário';
              if (selectedBadge.rarity === 'mitico') rarityLabel = 'Mítico';

              return (
                <>
                  <div style={{
                    width: 120, height: 120, borderRadius: 32,
                    background: isUnlocked ? `linear-gradient(135deg, ${selectedBadge.color}40, var(--bg-primary))` : 'var(--input-bg)',
                    border: `1px solid ${isUnlocked ? selectedBadge.color + '60' : 'var(--border-primary)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 64, marginBottom: 24,
                    filter: isUnlocked ? `drop-shadow(0 8px 16px ${selectedBadge.color}50)` : 'grayscale(100%) brightness(0.4)',
                    boxShadow: isUnlocked ? `inset 0 4px 20px ${selectedBadge.color}30` : 'none',
                  }}>
                    {isSecretHidden ? '?' : selectedBadge.icon}
                  </div>

                  {!isSecretHidden && isUnlocked && (
                    <div style={{
                      background: 'var(--input-bg)', padding: '4px 12px', borderRadius: 99,
                      fontSize: 12, fontWeight: 800, color: selectedBadge.color, marginBottom: 12,
                      letterSpacing: '1px', textTransform: 'uppercase', border: `1px solid ${selectedBadge.color}30`
                    }}>
                      {rarityLabel} {renderRarityStars(selectedBadge.rarity)}
                    </div>
                  )}

                  <h3 style={{ fontSize: 24, fontWeight: 900, color: isUnlocked ? 'var(--text-primary)' : 'var(--text-secondary)', margin: '0 0 12px', textAlign: 'center' }}>
                    {isSecretHidden ? 'Selo Secreto' : selectedBadge.name}
                  </h3>

                  <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
                    {isSecretHidden ? 'Existem conquistas que só os mais curiosos descobrem. Continue explorando para revelar este selo.' : selectedBadge.description}
                  </p>

                  {!isUnlocked && (
                    <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>
                      <Lock size={16} />
                      Ainda não conquistado
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUpModal {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
