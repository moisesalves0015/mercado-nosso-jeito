import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { useShippingConfig } from '../hooks/useShippingConfig';
import { useCatalog } from '../hooks/useCatalog';
import { useUpsellConfig } from '../hooks/useUpsellConfig';
import { getEffectiveProductPrice } from '../utils/productPricing';
import { buildCartComplementaryProducts } from '../utils/upsellRecommendations';
import { ShoppingBag, ArrowLeft, Trash2, Plus, Minus, Tag, Truck, Sparkles, CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MercadoLogo } from './Login';

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
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const checkoutLoading = false;

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
    const normalized = couponCode.trim().toUpperCase();
    if (!normalized) {
      setCouponFeedback({ type: 'err', text: 'Digite um código de cupom antes de aplicar.' });
      return;
    }
    if (normalized === 'DOBEMFRETE' || normalized === 'NOSSOJEITO10') {
      setDiscount(totalPrice * 0.1);
      setCouponFeedback({ type: 'ok', text: 'Cupom de 10% aplicado com sucesso!' });
    } else {
      setDiscount(0);
      setCouponFeedback({ type: 'err', text: 'Cupom inválido ou expirado.' });
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) return;

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
          background: 'var(--bg-secondary)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-gold)',
        }}>
          <div className="safe-area-top-bg" style={{ background: 'var(--bg-secondary)' }} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
          }}>
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

      {/* ── Page title ──────────────────────────── */}
      <div style={{ padding: '18px 16px 4px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Meu Carrinho</h1>
      </div>

      {cartItems.length === 0 ? (
        <div style={{ padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div className="clube-mission-icon-box" style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--card-bg)', border: '1px solid var(--border-primary)' }}>
            <ShoppingBag size={24} color="var(--text-muted)" />
          </div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 800, margin: '20px 0 6px 0' }}>Seu carrinho está vazio</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '0 0 32px 0', maxWidth: 240 }}>
            Adicione produtos refrescantes ou premium e garanta ótimos descontos!
          </p>
          <button 
            className="clube-mission-action-btn"
            style={{ padding: '10px 24px', borderRadius: 8, fontSize: 10, fontWeight: 900, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000' }}
            onClick={() => navigate('/')}
          >
            Ir às Compras
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* NATIVE ENTREGA RÁPIDA BANNER */}
          <div style={{ padding: '0 16px', marginBottom: 12 }}>
            <div className="promo-banner" style={{ 
              background: 'var(--card-gradient)', 
              border: '1px solid var(--border-gold)',
              boxShadow: 'var(--card-shadow)',
              padding: '12px 16px',
              margin: '0 0 8px 0'
            }}>
              <div className="promo-text">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ color: '#D4AF37', fontSize: '8.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3px' }}>⚡ Envio Condomínio</span>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 2px' }}>Entrega Rápida</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Seus produtos entregues em até 20 minutos direto na sua porta!</p>
              </div>
              <span style={{ fontSize: '30px' }}>⚡</span>
            </div>
          </div>

          <div style={{ padding: '0 16px' }}>
            {/* PROGRESSO & INCENTIVO PARA FRETE GRÁTIS (%) */}
            <div
              style={{
                background: isFreeShipping
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(52, 211, 153, 0.06))'
                  : 'var(--card-gradient)',
                border: isFreeShipping ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid var(--border-gold)',
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  {isFreeShipping ? (
                    <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  ) : (
                    <Truck size={16} color="#D4AF37" style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'left' }}>
                    {isFreeShipping
                      ? 'Parabéns! Você desbloqueou Frete Grátis'
                      : `Faltam R$ ${missingForFreeShipping.toFixed(2)} para Frete Grátis`}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: isFreeShipping ? '#10b981' : 'rgba(212, 175, 55, 0.18)',
                    color: isFreeShipping ? '#ffffff' : '#D4AF37',
                    border: isFreeShipping ? 'none' : '1px solid rgba(212, 175, 55, 0.4)',
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {progressPercent}%
                </span>
              </div>

              <div
                style={{
                  width: '100%',
                  height: 7,
                  borderRadius: 999,
                  background: 'rgba(148, 163, 184, 0.22)',
                  overflow: 'hidden',
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: isFreeShipping
                      ? 'linear-gradient(90deg, #10b981, #34d399)'
                      : 'linear-gradient(90deg, #D4AF37, #FFDF73)',
                    transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </div>

              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'left' }}>
                {isFreeShipping
                  ? `Você já economizou R$ ${baseShippingFee.toFixed(2)} na taxa de entrega!`
                  : `Economize R$ ${baseShippingFee.toFixed(2)} na entrega completando os ${100 - progressPercent}% restantes.`}
              </p>
            </div>

            {/* ITEMS LIST CONTAINER */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {cartItems.map((item) => (
              <div 
                key={item.id} 
                className="clube-mission-row"
                style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-primary)', borderRadius: 14, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}
              >
                {/* Product Thumbnail */}
                <div style={{ width: 50, height: 50, borderRadius: 8, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <img src={item.image} alt={item.title} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
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
            ))}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ fontSize: 12.5, fontWeight: 900, color: 'var(--text-primary)', margin: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Sparkles size={13} color="#D4AF37" />
                  {upsellConfig.cart.title || 'Leve também'}
                </h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {upsellConfig.cart.isAuto ? 'Combinam com seu carrinho' : 'Seleção especial'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                {recommendations.map((prod) => {
                  const justAdded = recentlyAddedId === prod.id;
                  return (
                    <div
                      key={prod.id}
                      style={{
                        minWidth: 112,
                        maxWidth: 118,
                        background: 'var(--card-gradient)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 12,
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ width: 46, height: 46, borderRadius: 8, background: '#fff', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={prod.image} alt={prod.title} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, height: 26, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.25 }}>
                        {prod.title}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 6 }}>
                        R$ {prod.price.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          addToCart({ id: prod.id, title: prod.title, price: prod.price, image: prod.image }, 1);
                          setRecentlyAddedId(prod.id);
                          window.setTimeout(() => setRecentlyAddedId((cur) => (cur === prod.id ? null : cur)), 1200);
                        }}
                        style={{
                          background: justAdded ? '#10b981' : 'var(--input-bg)',
                          border: justAdded ? '1px solid #10b981' : '1px solid #D4AF37',
                          color: justAdded ? '#ffffff' : '#D4AF37',
                          borderRadius: 6,
                          padding: '4px 0',
                          width: '100%',
                          fontSize: 10,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: 3,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <Plus size={10} /> {justAdded ? 'Adicionado!' : 'Aproveite'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* COUPON BOX */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border-primary)', borderRadius: 14, padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Tag size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input 
                type="text" 
                placeholder="CUPOM DE DESCONTO" 
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value);
                  if (couponFeedback) setCouponFeedback(null);
                }}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}
              />
              <button 
                type="button"
                onClick={applyCoupon}
                style={{ background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 9.5, fontWeight: 900, padding: '5px 12px', cursor: 'pointer', textTransform: 'uppercase' }}
              >
                Aplicar
              </button>
            </div>
            {couponFeedback && (
              <p
                style={{
                  margin: '6px 4px 0',
                  fontSize: 11,
                  fontWeight: 700,
                  color: couponFeedback.type === 'ok' ? '#10b981' : '#ef4444',
                  textAlign: 'left',
                }}
              >
                {couponFeedback.text}
              </p>
            )}
          </div>

          {/* CHECKOUT BOX */}
          <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-primary)', borderRadius: 18, padding: 16, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-primary)', margin: '0 0 4px 0', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, textAlign: 'left' }}>Resumo do Pedido</h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <span>Itens ({totalItems})</span>
              <span>R$ {totalPrice.toFixed(2)}</span>
            </div>

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#34C759', fontWeight: 700 }}>
                <span>Desconto Especial (10%)</span>
                <span>- R$ {discount.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <span>Taxa de Entrega</span>
              {isFreeShipping ? (
                <span style={{ color: '#2ecc71', fontWeight: 800 }}>GRÁTIS</span>
              ) : (
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>R$ {baseShippingFee.toFixed(2)}</span>
              )}
            </div>

            {totalSavings > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '6px 10px',
                  borderRadius: 8,
                }}
              >
                <span>Economia total neste pedido</span>
                <span>R$ {totalSavings.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', borderTop: '1px dashed var(--border-primary)', paddingTop: 10, marginTop: 4 }}>
              <span>Total Estimado</span>
              <span style={{ color: 'var(--text-primary)' }}>R$ {estimatedTotal.toFixed(2)}</span>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: 12, height: 48, fontSize: 13.5, letterSpacing: '0.2px', opacity: checkoutLoading ? 0.7 : 1 }}
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Processando...' : 'Seguir com a Compra 💳'}
            </button>
          </div>
        </div>
        </div>
      )}
      </div>
    </div>
  );
}
