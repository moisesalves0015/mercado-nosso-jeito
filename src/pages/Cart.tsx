import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { ShoppingBag, ArrowLeft, Trash2, Plus, Minus, CheckCircle, Tag } from 'lucide-react';
import { useState } from 'react';
import bannerEntregaRapida from '../assets/banners/bannerEntregaRapida.svg';

export function Cart() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [successOrder, setSuccessOrder] = useState<any>(null);

  // Recommended related items
  const recommendations = [
    {
      id: 'prod-danone',
      title: 'Danone Grego Tradicional 400g',
      price: 18.90,
      image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=150&q=80',
    },
    {
      id: 'prod-melitta',
      title: 'Café Torrado Melitta Especial 500g',
      price: 24.50,
      image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=150&q=80',
    },
    {
      id: 'prod-dobem',
      title: 'Suco de Laranja Integral Do Bem 1L',
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
    
    // Stage orders ledger mock history persistence
    const finalAmount = totalPrice - discount;
    const orderNumber = Math.floor(Math.random() * 9000) + 1000;
    
    // Trigger canvas confetti explosion
    import('canvas-confetti').then((confettiModule) => {
      confettiModule.default({ 
        particleCount: 100, 
        angle: 90, 
        spread: 60, 
        origin: { y: 0.8 },
        colors: ['#FFDF73', '#D4AF37', '#E7BC79', '#FFFFFF']
      });
    });

    setSuccessOrder({
      orderId: `#MJ-${orderNumber}`,
      itemsCount: totalItems,
      total: finalAmount
    });
    
    // Clear global cart state
    clearCart();
  };

  if (successOrder) {
    return (
      <div className="clube-page" style={{ padding: '80px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div className="reward-icon-box animate-pop" style={{ background: 'rgba(52, 199, 89, 0.1)', borderColor: '#34C759', width: 64, height: 64 }}>
          <CheckCircle size={36} color="#34C759" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: '24px 0 8px 0' }}>Pedido Realizado!</h2>
        <p style={{ fontSize: 13, color: '#34C759', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>{successOrder.orderId}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '8px 0 32px 0', maxWidth: 280 }}>
          Seu pedido com {successOrder.itemsCount} itens foi registrado com sucesso e já está sendo preparado para entrega!
        </p>

        <div className="clube-modal-coupon-box" style={{ width: '100%', maxWidth: 280, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, marginBottom: 32 }}>
          <span className="coupon-label" style={{ fontSize: 9 }}>TOTAL PAGO</span>
          <span className="coupon-code-value" style={{ fontSize: 18, color: '#34C759' }}>R$ {successOrder.total.toFixed(2)}</span>
        </div>

        <button 
          className="clube-mission-action-btn"
          style={{ width: '100%', maxWidth: 280, padding: '12px 0', borderRadius: 8, fontSize: 11, fontWeight: 900, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000' }}
          onClick={() => navigate('/')}
        >
          Voltar para a Loja 🛍️
        </button>
      </div>
    );
  }

  return (
    <div className="clube-page" style={{ minHeight: '100vh', paddingBottom: 110 }}>
      {/* HEADER SECTION */}
      <header className="clube-topbar">
        <button 
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ fontSize: 15, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0, color: '#fff' }}>Meu Carrinho</h2>
        <div style={{ width: 20 }}></div>
      </header>

      {cartItems.length === 0 ? (
        <div style={{ padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div className="clube-mission-icon-box" style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <ShoppingBag size={24} color="rgba(255,255,255,0.3)" />
          </div>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: '20px 0 6px 0' }}>Seu carrinho está vazio</h3>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '0 0 32px 0', maxWidth: 240 }}>
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
          
          {/* ENTREGA RÁPIDA BANNER */}
          <div style={{ width: '100%', marginBottom: 20 }}>
            <img 
              src={bannerEntregaRapida} 
              alt="Entrega Rápida" 
              style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }} 
            />
          </div>

          <div style={{ padding: '0 16px' }}>
            {/* ITEMS LIST CONTAINER */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {cartItems.map((item) => (
              <div 
                key={item.id} 
                className="clube-mission-row"
                style={{ background: 'rgba(14, 11, 9, 0.7)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}
              >
                {/* Product Thumbnail */}
                <div style={{ width: 50, height: 50, borderRadius: 8, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <img src={item.image} alt={item.title} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                </div>

                {/* Info and controls */}
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <h4 style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', margin: '0 0 3px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#FFDF73' }}>R$ {item.price.toFixed(2)}</span>
                </div>

                {/* Quantity Controls & Trash */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 2 }}>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', width: 22, height: 22, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}
                    >
                      <Minus size={10} />
                    </button>
                    <span style={{ fontSize: 11.5, fontWeight: 900, color: '#fff', width: 20, textAlign: 'center' }}>{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', width: 22, height: 22, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}
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
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: 12, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tag size={16} color="#FFDF73" style={{ flexShrink: 0 }} />
            <input 
              type="text" 
              placeholder="CUPOM DE DESCONTO" 
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}
            />
            <button 
              onClick={applyCoupon}
              style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 6, color: '#FFDF73', fontSize: 9.5, fontWeight: 900, padding: '5px 12px', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Aplicar
            </button>
          </div>

          {/* CHECKOUT BOX */}
          <div style={{ background: 'rgba(14, 11, 9, 0.9)', border: '1.5px solid rgba(212,175,55,0.35)', borderRadius: 18, padding: 16, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#FFDF73', margin: '0 0 4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6, textAlign: 'left' }}>Resumo do Pedido</h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>
              <span>Itens ({totalItems})</span>
              <span>R$ {totalPrice.toFixed(2)}</span>
            </div>

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#34C759', fontWeight: 700 }}>
                <span>Desconto Especial (10%)</span>
                <span>- R$ {discount.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>
              <span>Taxa de Entrega</span>
              <span style={{ color: '#34C759', fontWeight: 800 }}>GRÁTIS</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, color: '#fff', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 10, marginTop: 4 }}>
              <span>Total Estimado</span>
              <span style={{ color: '#FFDF73' }}>R$ {(totalPrice - discount).toFixed(2)}</span>
            </div>

            <button 
              className="premium-btn-rainbow"
              style={{ width: '100%', marginTop: 10, padding: '12px 0', borderRadius: 8, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}
              onClick={handleCheckout}
            >
              Concluir Compra 💳
            </button>
          </div>
        </div>
        </div>
      )}

      {/* RECOMMENDED OFFERS CAROUSEL ROW */}
      <div className="clube-section-title-row" style={{ marginTop: 10 }}>
        <h3>Recomendações Especiais</h3>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 20px', scrollbarWidth: 'none' }}>
        {recommendations.map((prod) => (
          <div 
            key={prod.id}
            style={{ width: 115, flexShrink: 0, padding: '12px 10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}
          >
            <div style={{ width: 36, height: 36, background: '#fff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src={prod.image} alt={prod.title} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
            </div>
            <h4 style={{ fontSize: 9.5, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.15, height: 22, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {prod.title}
            </h4>
            <span style={{ fontSize: 10, fontWeight: 900, color: '#FFDF73' }}>R$ {prod.price.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
