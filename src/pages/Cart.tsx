import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { useShippingConfig } from '../hooks/useShippingConfig';
import { useCatalog } from '../hooks/useCatalog';
import { useUpsellConfig } from '../hooks/useUpsellConfig';
import { getEffectiveProductPrice } from '../utils/productPricing';
import { buildCartComplementaryProducts } from '../utils/upsellRecommendations';
import { cleanImageUrl, handleImageError } from '../utils/imageUrl';
import { useResolvedMediaUrl } from '../services/mediaStorageService';
import { ShoppingBag, ArrowLeft, Trash2, Plus, Minus, Tag, Truck, Sparkles, CheckCircle2, ShieldCheck, ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MercadoLogo } from './Login';

const RAIN_ICONS = [
  { id: 0, left: '6%', delay: '0s', duration: '3.6s', size: 20, kind: 'truck' },
  { id: 1, left: '14%', delay: '0.7s', duration: '4.2s', size: 17, kind: 'tag' },
  { id: 2, left: '22%', delay: '0.2s', duration: '3.4s', size: 18, kind: 'truck' },
  { id: 3, left: '31%', delay: '1.1s', duration: '4.0s', size: 21, kind: 'tag' },
  { id: 4, left: '39%', delay: '0.4s', duration: '3.7s', size: 18, kind: 'truck' },
  { id: 5, left: '48%', delay: '1.4s', duration: '4.3s', size: 19, kind: 'tag' },
  { id: 6, left: '57%', delay: '0.1s', duration: '3.5s', size: 21, kind: 'truck' },
  { id: 7, left: '66%', delay: '0.9s', duration: '4.1s', size: 17, kind: 'tag' },
  { id: 8, left: '74%', delay: '0.5s', duration: '3.8s', size: 19, kind: 'truck' },
  { id: 9, left: '83%', delay: '1.2s', duration: '3.9s', size: 20, kind: 'tag' },
  { id: 10, left: '91%', delay: '0.3s', duration: '4.4s', size: 18, kind: 'truck' },
  { id: 11, left: '19%', delay: '1.8s', duration: '3.8s', size: 19, kind: 'tag' },
  { id: 12, left: '44%', delay: '2.1s', duration: '3.6s', size: 20, kind: 'truck' },
  { id: 13, left: '69%', delay: '1.6s', duration: '4.0s', size: 18, kind: 'tag' },
  { id: 14, left: '88%', delay: '1.9s', duration: '3.5s', size: 19, kind: 'truck' },
] as const;

function playFreeShippingChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 -> E5 -> G5 -> C6
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.11, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.38);
    });
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch {
    // Ignore audio errors when autoplay is blocked
  }
}

const CartProductThumb = ({ src, alt }: { src?: string; alt: string }) => {
  const isVault = Boolean(src && src.startsWith('firestore-media://'));
  const resolvedVault = useResolvedMediaUrl(isVault ? src : undefined);
  const finalSrc = isVault ? (resolvedVault || cleanImageUrl('')) : cleanImageUrl(src);

  return (
    <img
      src={finalSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={handleImageError}
      style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
    />
  );
};

export function Cart() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice, addToCart } = useCart();
  const { user } = useAuth();
  const { config: shippingConfig } = useShippingConfig();
  const catalog = useCatalog();
  const upsellConfig = useUpsellConfig();
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [showFreeShippingPopup, setShowFreeShippingPopup] = useState(false);
  const celebratedUnlockRef = useRef(false);

  const freeShippingThreshold = shippingConfig?.freeShippingThreshold ?? 60;
  const baseShippingFee = shippingConfig?.baseShippingFee ?? 5;
  const isFreeShipping = totalPrice >= freeShippingThreshold;
  const deliveryFee = isFreeShipping ? 0 : baseShippingFee;
  const missingForFreeShipping = Math.max(0, freeShippingThreshold - totalPrice);
  const progressPercent =
    freeShippingThreshold > 0
      ? Math.min(100, Math.round((totalPrice / freeShippingThreshold) * 100))
      : 100;
  const estimatedTotal = Math.max(0, totalPrice - discount + deliveryFee);
  const totalSavings = discount + (isFreeShipping ? baseShippingFee : 0);

  // Anima a barra de 0% até progressPercent ao carregar e ao atualizar itens
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAnimatedProgress(progressPercent);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [progressPercent]);

  // Ao completar 100% da barra, dispara confetes e exibe popup de Frete Grátis sempre que carregar
  useEffect(() => {
    if (cartItems.length === 0 || !isFreeShipping) {
      celebratedUnlockRef.current = false;
      return;
    }

    if (celebratedUnlockRef.current) return;
    celebratedUnlockRef.current = true;
    let fired = false;

    const celebrateTimer = window.setTimeout(() => {
      fired = true;
      setShowFreeShippingPopup(true);
      playFreeShippingChime();
      import('canvas-confetti')
        .then((confettiModule) => {
          const confetti = confettiModule.default;
          const colors = ['#34D399', '#10B981', '#F0D57B', '#D4AF37', '#FFFFFF'];
          const fireSides = (particleCount: number, spread: number) => {
            confetti({
              particleCount,
              angle: 60,
              spread,
              origin: { x: 0.02, y: 0.62 },
              zIndex: 9999,
              colors,
            });
            confetti({
              particleCount,
              angle: 120,
              spread,
              origin: { x: 0.98, y: 0.62 },
              zIndex: 9999,
              colors,
            });
          };
          fireSides(60, 68);
          window.setTimeout(() => fireSides(45, 58), 220);
        })
        .catch(() => {});
    }, 1850);

    const autoHideTimer = window.setTimeout(() => {
      setShowFreeShippingPopup(false);
    }, 8500);

    return () => {
      window.clearTimeout(celebrateTimer);
      window.clearTimeout(autoHideTimer);
      if (!fired) {
        celebratedUnlockRef.current = false;
      }
    };
  }, [cartItems.length, isFreeShipping]);

  // Bloqueia o scroll da página enquanto a mensagem de tela cheia está visível
  useEffect(() => {
    if (!isFreeShipping || !showFreeShippingPopup) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFreeShipping, showFreeShippingPopup]);
  // Produtos que combinam com o que já está no carrinho (ou escolhidos manualmente no Admin)
  const recommendations = useMemo(() => {
    const resolved = buildCartComplementaryProducts({
      config: upsellConfig.cart,
      cartItems,
      products: catalog.products,
      productsById: catalog.byId,
    });
    return resolved.map((p) => ({
      id: p.id,
      title: p.title,
      price: getEffectiveProductPrice(p),
      image: p.image,
    }));
  }, [upsellConfig.cart, cartItems, catalog.products, catalog.byId]);

  const applyCoupon = () => {
    if (applyingCoupon) return;
    const normalized = couponCode.trim().toUpperCase();
    if (!normalized) {
      setCouponFeedback({ type: 'err', text: 'Digite um código de cupom antes de aplicar.' });
      return;
    }
    setApplyingCoupon(true);
    window.setTimeout(() => {
      if (normalized === 'DOBEMFRETE' || normalized === 'NOSSOJEITO10') {
        setDiscount(totalPrice * 0.1);
        setCouponFeedback({ type: 'ok', text: 'Cupom de 10% aplicado com sucesso!' });
      } else {
        setDiscount(0);
        setCouponFeedback({ type: 'err', text: 'Cupom inválido ou expirado.' });
      }
      setApplyingCoupon(false);
    }, 320);
  };

  const handleCheckout = () => {
    if (cartItems.length === 0 || checkoutLoading) return;
    setCheckoutLoading(true);
    if (!user) {
      navigate('/login?returnUrl=/checkout');
      return;
    }
    navigate('/checkout');
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Manrope','Outfit',sans-serif" }}>
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: 90 }}>
        {/* Topbar */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          background: 'transparent',
          pointerEvents: 'none',
        }}>
          <div className="commerce-topbar-inner" style={{ pointerEvents: 'auto' }}>
            <button
              onClick={() => navigate(-1)}
              className="btn-icon-round"
              aria-label="Voltar"
            >
              <ArrowLeft size={18} />
            </button>

            <MercadoLogo size="sm" />

            <div style={{ width: '38px' }} />
          </div>
        </div>

        <div className="commerce-shell commerce-fade-in">
          {/* ── Page title ──────────────────────────── */}
          <div className="commerce-header-row">
            <div>
              <h1 className="commerce-title">Meu Carrinho</h1>
              <p className="commerce-subtitle">Revise seus itens e aproveite entrega expressa</p>
            </div>
            {totalItems > 0 && (
              <span className="commerce-count-badge">
                {totalItems} {totalItems === 1 ? 'item' : 'itens'}
              </span>
            )}
          </div>

          {cartItems.length === 0 ? (
            <div style={{ padding: '64px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div className="clube-mission-icon-box cart-empty-icon-circle" style={{ width: 68, height: 68, borderRadius: '50%' }}>
                <ShoppingBag size={28} />
              </div>
              <h3 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 800, margin: '18px 0 6px 0', letterSpacing: '-0.3px' }}>Seu carrinho está vazio</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 24px 0', maxWidth: 280, lineHeight: 1.5 }}>
                Que tal adicionar produtos refrescantes, bebidas ou guloseimas e receber em minutos?
              </p>
              <button
                type="button"
                className="commerce-btn-primary"
                style={{ width: '100%', maxWidth: 260 }}
                onClick={() => navigate('/')}
              >
                <span>Ver Ofertas do Dia</span>
                <ChevronRight size={17} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {isFreeShipping &&
                showFreeShippingPopup &&
                typeof document !== 'undefined' &&
                createPortal(
                  <div className="cart-freeship-overlay" role="dialog" aria-modal="true" aria-label="Frete Grátis desbloqueado">
                    <div className="cart-freeship-rain" aria-hidden="true">
                      {RAIN_ICONS.map((item) => (
                        <span
                          key={item.id}
                          className={`cart-freeship-rain-item ${item.id % 2 === 0 ? 'is-emerald' : 'is-gold'}`}
                          style={{
                            left: item.left,
                            animationDelay: item.delay,
                            animationDuration: item.duration,
                          }}
                        >
                          {item.kind === 'truck' ? (
                            <Truck size={item.size} strokeWidth={1.35} />
                          ) : (
                            <Tag size={item.size} strokeWidth={1.35} />
                          )}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      aria-label="Fechar aviso"
                      className="cart-freeship-overlay-close"
                      onClick={() => setShowFreeShippingPopup(false)}
                    >
                      <X size={20} strokeWidth={1.4} />
                    </button>
                    <div className="cart-freeship-overlay-content">
                      <div className="cart-freeship-overlay-title">
                        <span className="cart-freeship-title-main">Frete Grátis</span>
                        <span className="cart-freeship-title-sub">desbloqueado!</span>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )}

              <div>
                {/* PROGRESSO & INCENTIVO PARA FRETE GRÁTIS (SEM FUNDO E SEM BORDA) */}
                <div
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '2px 2px 14px',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, minWidth: 0 }}>
                    {isFreeShipping ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 0 }}>
                          <CheckCircle2 size={14} strokeWidth={1.8} color="#34D399" style={{ flexShrink: 0 }} />
                          <strong style={{ fontSize: 11.5, fontWeight: 900, color: '#34D399', whiteSpace: 'nowrap' }}>
                            Frete Grátis desbloqueado!
                          </strong>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
                          Você já economizou R$ {baseShippingFee.toFixed(2)} na entrega.
                        </span>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 0 }}>
                          <Truck size={14} strokeWidth={1.6} color="#E8C96A" style={{ flexShrink: 0 }} />
                          <strong style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            Faltam R$ {missingForFreeShipping.toFixed(2)}
                          </strong>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
                          para Frete Grátis.
                        </span>
                      </>
                    )}
                  </div>

                  <div style={{ position: 'relative', padding: '4px 0' }}>
                    <div className="commerce-progress-track" style={{ height: 6 }}>
                      <div
                        className="commerce-progress-fill"
                        style={{
                          width: `${animatedProgress}%`,
                          transition: 'width 1.65s cubic-bezier(0.16, 1, 0.3, 1)',
                          background: isFreeShipping
                            ? 'linear-gradient(90deg, #10B981, #34D399)'
                            : 'linear-gradient(90deg, #C9A236, #F0D57B)',
                        }}
                      />
                    </div>
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: `clamp(7px, ${animatedProgress}%, calc(100% - 9px))`,
                        transform: 'translate(-50%, -50%)',
                        transition: 'left 1.65s cubic-bezier(0.16, 1, 0.3, 1)',
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: isFreeShipping ? '#0B2419' : '#121E17',
                        border: isFreeShipping ? '1.2px solid #34D399' : '1.2px solid #E8C96A',
                        color: isFreeShipping ? '#34D399' : '#E8C96A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
                        pointerEvents: 'none',
                      }}
                    >
                      <Truck size={11} strokeWidth={1.6} />
                    </div>
                  </div>
                </div>

                {/* ITEMS LIST CONTAINER */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  {cartItems.map((item) => {
                    const liveProduct = catalog.byId.get(item.id);
                    const resolvedImage = liveProduct?.image || item.image;
                    return (
                    <div
                      key={item.id}
                      className="clube-mission-row cart-glass-card"
                      style={{ borderRadius: 16, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      {/* Product Thumbnail */}
                      <div style={{ width: 50, height: 50, borderRadius: 8, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CartProductThumb src={resolvedImage} alt={item.title} />
                      </div>

                      {/* Info and controls */}
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <h4 style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 3px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary)' }}>R$ {item.price.toFixed(2)}</span>
                      </div>

                      {/* Quantity Controls & Trash */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 2 }}>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', width: 22, height: 22, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}
                          >
                            <Minus size={10} />
                          </button>
                          <span style={{ fontSize: 11.5, fontWeight: 900, color: 'var(--text-primary)', width: 20, textAlign: 'center' }}>{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', width: 22, height: 22, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}
                          >
                            <Plus size={10} />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.id)}
                          style={{ background: 'none', border: 'none', color: '#FF6B6B', cursor: 'pointer', padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* CLEAR CART LINK BUTTON */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                  <button
                    onClick={clearCart}
                    style={{ background: 'none', border: 'none', color: '#FF6B6B', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                  >
                    <Trash2 size={12} />
                    Limpar Carrinho
                  </button>
                </div>

                {/* LISTA "LEVE TAMBÉM" ANTES DO RESUMO DO PEDIDO */}
                {recommendations.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div className="commerce-section-header">
                      <div className="commerce-section-header-title">
                        <Sparkles size={15} color="#E8C96A" />
                        <h3>{upsellConfig.cart.title || 'Aproveite e Leve Também'}</h3>
                      </div>
                      <span className="commerce-section-tag">
                        {upsellConfig.cart.isAuto ? 'Combinações recomendadas' : 'Seleção especial'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                      {recommendations.map((prod) => {
                        const justAdded = recentlyAddedId === prod.id;
                        return (
                          <div
                            key={prod.id}
                            className="cart-glass-card"
                            style={{
                              minWidth: 114,
                              maxWidth: 120,
                              borderRadius: 14,
                              padding: '10px 8px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              textAlign: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <div style={{ width: 48, height: 48, borderRadius: 8, background: '#fff', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CartProductThumb src={prod.image} alt={prod.title} />
                            </div>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, height: 26, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.25 }}>
                              {prod.title}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
                              R$ {prod.price.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                addToCart({ id: prod.id, title: prod.title, price: prod.price, image: prod.image }, 1);
                                setRecentlyAddedId(prod.id);
                                window.setTimeout(() => setRecentlyAddedId((cur) => (cur === prod.id ? null : cur)), 1200);
                              }}
                              className={`commerce-btn-pill-add ${justAdded ? 'is-added' : ''}`}
                            >
                              {justAdded ? (
                                <>
                                  <CheckCircle2 size={12} />
                                  <span>Adicionado!</span>
                                </>
                              ) : (
                                <>
                                  <Plus size={12} />
                                  <span>Adicionar</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* COUPON BOX */}
                <div style={{ marginBottom: 18 }}>
                  <div className="cart-glass-card" style={{ borderRadius: 14, padding: '8px 10px 8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Tag size={16} color="#E8C96A" style={{ flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder="CUPOM DE DESCONTO"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value);
                        if (couponFeedback) setCouponFeedback(null);
                      }}
                      style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={applyingCoupon}
                      className={`commerce-btn-coupon ${applyingCoupon ? 'is-loading' : ''}`}
                    >
                      {applyingCoupon ? 'Aplicando...' : 'Aplicar'}
                    </button>
                  </div>
                  {couponFeedback && (
                    <p
                      style={{
                        margin: '6px 4px 0',
                        fontSize: 11,
                        fontWeight: 700,
                        color: couponFeedback.type === 'ok' ? '#E8C96A' : '#ef4444',
                        textAlign: 'left',
                      }}
                    >
                      {couponFeedback.text}
                    </p>
                  )}
                </div>

                {/* CHECKOUT BOX */}
                <div className="cart-glass-card" style={{ borderRadius: 18, padding: 16, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: 8, textAlign: 'left', letterSpacing: '-0.2px' }}>Resumo do Pedido</h3>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>Itens ({totalItems})</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>R$ {totalPrice.toFixed(2)}</span>
                  </div>

                  {discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#34D399', fontWeight: 700 }}>
                      <span>Desconto Especial (10%)</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>- R$ {discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>Taxa de Entrega</span>
                    {isFreeShipping ? (
                      <span style={{ color: '#34D399', fontWeight: 800 }}>GRÁTIS</span>
                    ) : (
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>R$ {baseShippingFee.toFixed(2)}</span>
                    )}
                  </div>

                  {totalSavings > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: '#34D399',
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(52, 211, 153, 0.3)',
                        padding: '8px 12px',
                        borderRadius: 10,
                      }}
                    >
                      <span>Economia total neste pedido</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>R$ {totalSavings.toFixed(2)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', borderTop: '1px dashed var(--glass-border)', paddingTop: 10, marginTop: 4 }}>
                    <span>Total Estimado</span>
                    <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>R$ {estimatedTotal.toFixed(2)}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: '#E8C96A', fontWeight: 700, marginTop: 4 }}>
                    <ShieldCheck size={14} />
                    <span>Entrega rápida garantida no condomínio</span>
                  </div>

                  <button
                    type="button"
                    className={`commerce-btn-primary cart-checkout-btn ${checkoutLoading ? 'is-loading' : ''}`}
                    style={{ width: '100%', marginTop: 8, justifyContent: 'space-between', padding: '0 16px' }}
                    onClick={handleCheckout}
                    disabled={checkoutLoading}
                  >
                    {checkoutLoading ? (
                      <span style={{ margin: '0 auto' }}>Carregando checkout...</span>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                          <span>Finalizar Compra</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span className="commerce-btn-badge">R$ {estimatedTotal.toFixed(2)}</span>
                          <ChevronRight size={17} className="cart-checkout-arrow" />
                        </div>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
