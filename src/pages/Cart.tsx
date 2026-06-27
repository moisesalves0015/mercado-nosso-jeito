import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { useShippingConfig } from '../hooks/useShippingConfig';
import { ShoppingBag, ArrowLeft, Trash2, Plus, Minus, Tag } from 'lucide-react';
import { useState } from 'react';
import { MercadoLogo } from './Login';

export function Cart() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice, addToCart } = useCart();
  const { user } = useAuth();
  const { config: shippingConfig } = useShippingConfig();
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const checkoutLoading = false;

  const freeShippingThreshold = shippingConfig?.freeShippingThreshold ?? 60;
  const baseShippingFee = shippingConfig?.baseShippingFee ?? 5;
  const isFreeShipping = totalPrice >= freeShippingThreshold;
  const deliveryFee = isFreeShipping ? 0 : baseShippingFee;
  const estimatedTotal = totalPrice - discount + deliveryFee;

  // Recommended related items
  const recommendations = [
    {
      id: 'prod-danone',
      title: 'Danone Grego',
      price: 18.90,
      image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=150&q=80',
    },
    {
      id: 'prod-melitta',
      title: 'Café Melitta',
      price: 24.50,
      image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=150&q=80',
    },
    {
      id: 'prod-dobem',
      title: 'Suco Do Bem',
      price: 12.90,
      image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=150&q=80',
    }
  ];

  const applyCoupon = () => {
    if (couponCode.toUpperCase() === 'DOBEMFRETE' || couponCode.toUpperCase() === 'NOSSOJEITO10') {
      setDiscount(totalPrice * 0.1);
      alert('Cupom premium de 10% de desconto aplicado com sucesso!');
    } else {
      alert('Cupom inválido ou expirado.');
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
          zIndex: 20,
          background: 'var(--bg-secondary)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-gold)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
          }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'var(--back-btn-bg)',
                border: '1px solid var(--border-primary)',
                borderRadius: '50%',
                width: '38px', height: '38px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0,
              }}
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button 
              onClick={clearCart}
              style={{ background: 'none', border: 'none', color: '#FF6B6B', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
            >
              <Trash2 size={12} />
              Limpar Carrinho
            </button>
          </div>

          {/* COUPON BOX */}
          <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border-primary)', borderRadius: 14, padding: 12, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tag size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input 
              type="text" 
              placeholder="CUPOM DE DESCONTO" 
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}
            />
            <button 
              onClick={applyCoupon}
              style={{ background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 9.5, fontWeight: 900, padding: '5px 12px', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Aplicar
            </button>
          </div>

          {/* CHECKOUT BOX */}
          <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-primary)', borderRadius: 18, padding: 16, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', borderTop: '1px dashed var(--border-primary)', paddingTop: 10, marginTop: 4 }}>
              <span>Total Estimado</span>
              <span style={{ color: 'var(--text-primary)' }}>R$ {estimatedTotal.toFixed(2)}</span>
            </div>

            <button
              className="premium-btn-rainbow"
              style={{ width: '100%', marginTop: 10, padding: '12px 0', borderRadius: 8, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, opacity: checkoutLoading ? 0.7 : 1 }}
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Processando...' : 'Seguir com a Compra 💳'}
            </button>
          </div>
        </div>
        </div>
      )}

      {/* RECOMMENDED OFFERS CAROUSEL ROW */}
      <h3 style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 8, padding: '0 16px', textAlign: 'left' }}>Leve também</h3>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px 20px', scrollbarWidth: 'none' }}>
        {recommendations.map((prod) => (
          <div 
            key={prod.id}
            style={{ minWidth: 105, background: 'var(--card-gradient)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 7, background: '#fff', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={prod.image} alt={prod.title} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 3, height: 24, overflow: 'hidden' }}>{prod.title}</span>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 6 }}>R$ {prod.price.toFixed(2)}</span>
            <button 
              onClick={() => addToCart({ id: prod.id, title: prod.title, price: prod.price, image: prod.image }, 1)} 
              style={{ background: 'var(--input-bg)', border: '1px solid #D4AF37', color: '#D4AF37', borderRadius: 5, padding: '3px 0', width: '100%', fontSize: 10, fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3 }}
            >
              <Plus size={10} /> Aproveite
            </button>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
