import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { createOrder } from '../hooks/useOrders';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  ArrowLeft, CheckCircle, MapPin, 
  ChevronRight, AlertTriangle, ShieldCheck, Clock,
  Plus, Star, Lock, Award, TrendingUp, Zap
} from 'lucide-react';
import { MercadoLogo } from './Login';

type CheckoutStep = 'summary' | 'delivery' | 'payment' | 'success';

export function Checkout() {
  const navigate = useNavigate();
  const { cartItems, totalPrice, clearCart, addToCart } = useCart();
  const { user } = useAuth();
  
  const complementaryProducts = [
    { id: 'prod-danone', title: 'Danone Grego', price: 18.90, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=150&q=80' },
    { id: 'prod-melitta', title: 'Café Melitta', price: 24.50, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=150&q=80' }
  ];
  const freeShippingThreshold = 100;
  const progressPercent = Math.min((totalPrice / freeShippingThreshold) * 100, 100);
  
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Delivery State
  const [deliveryMethod, setDeliveryMethod] = useState<'apartment' | 'lobby'>('apartment');
  const [address, setAddress] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  
  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'on_delivery'>('pix');
  
  // Order State
  const [orderId, setOrderId] = useState<string | null>(null);

  // Discount
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);

  // Countdown timer for payment (10 minutes)
  const [timeLeft, setTimeLeft] = useState(600);

  useEffect(() => {
    if (step === 'success' && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [step, timeLeft]);

  useEffect(() => {
    if (deliveryMethod === 'lobby' && paymentMethod === 'on_delivery') {
      setPaymentMethod('pix');
    }
  }, [deliveryMethod, paymentMethod]);

  useEffect(() => {
    if (cartItems.length > 0) {
      localStorage.setItem('mercado_checkout_recovery', JSON.stringify({
        step, cartItems, totalPrice, lastUpdated: new Date().toISOString()
      }));
    }
  }, [step, cartItems, totalPrice]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load addresses when reaching delivery step
  useEffect(() => {
    if (step === 'delivery' && user) {
      const loadAddresses = async () => {
        try {
          const q = query(collection(db, 'users', user.uid, 'addresses'));
          const snap = await getDocs(q);
          const userAddresses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setAddresses(userAddresses);
          
          const defaultAddr = userAddresses.find((a: any) => a.isDefault);
          if (defaultAddr) {
            setAddress(defaultAddr);
          } else if (userAddresses.length > 0) {
            setAddress(userAddresses[0]);
          }
        } catch (err) {
          console.error("Error loading addresses", err);
        }
      };
      loadAddresses();
    }
  }, [step, user]);

  const applyCoupon = () => {
    if (couponCode.toUpperCase() === 'NOSSOJEITO10') {
      setDiscount(totalPrice * 0.1);
      alert('Cupom aplicado!');
    } else {
      alert('Cupom inválido.');
    }
  };

  const handleNext = () => {
    if (step === 'delivery') {
      if (!address) {
        alert('Selecione um endereço para entrega.');
        return;
      }
      setStep('payment');
    }
  };

  const handleFinish = async () => {
    if (!user) {
      navigate('/login?returnUrl=/checkout');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const finalTotal = totalPrice - discount;
      
      const newOrderId = await createOrder({
        uid: user.uid,
        items: cartItems.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          image: item.image ?? ''
        })),
        subtotal: totalPrice,
        discount: discount,
        deliveryFee: 0,
        total: finalTotal,
        paymentMethod: paymentMethod === 'pix' ? 'Pix' : paymentMethod === 'credit_card' ? 'Cartão de Crédito' : 'Pagamento na Entrega',
        paymentStatus: 'pending',
        deliveryMethod: deliveryMethod === 'apartment' ? 'Entrega no Apartamento' : 'Entrega na Portaria',
        address: address,
        coupon: couponCode || undefined
      });
      
      setOrderId(newOrderId);
      clearCart();
      
      // Fire confetti
      import('canvas-confetti').then((confettiModule) => {
        confettiModule.default({
          particleCount: 150,
          spread: 80,
          colors: ['#FFDF73', '#D4AF37', '#E7BC79', '#FFFFFF'],
        });
      });
      
      setStep('success');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao processar o pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0 && step !== 'success') {
    return (
      <div className="clube-page" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2>Seu carrinho está vazio</h2>
        <button onClick={() => navigate('/')} style={{ marginTop: 20, padding: '10px 20px' }}>Voltar à Loja</button>
      </div>
    );
  }

  return (
    <div className="clube-page" style={{ minHeight: '100vh', paddingBottom: 110, fontFamily: "'Manrope','Outfit',sans-serif" }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Topbar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--bg-secondary)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-gold)'
        }}>
          <div className="safe-area-top-bg" style={{ background: 'var(--bg-secondary)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <button onClick={() => {
              if (step === 'payment') setStep('delivery');
              else if (step === 'delivery') setStep('summary');
              else navigate('/cart');
            }} 
              style={{ background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0 }}>
              <ArrowLeft size={18} />
            </button>
            <MercadoLogo size="sm" />
            <div style={{ width: 38 }} />
          </div>
        </div>

        <div style={{ padding: '18px 16px 4px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Checkout</h1>
        </div>

        <div style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto' }}>
          
          {/* Progress Bar */}
          {step !== 'success' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30, padding: '0 20px' }}>
              <div onClick={() => setStep('summary')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: step === 'summary' ? 1 : 0.5, cursor: 'pointer' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: step === 'summary' ? '#D4AF37' : 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step === 'summary' ? '#000' : 'var(--text-secondary)', fontWeight: 'bold' }}>1</div>
                <span style={{ fontSize: 10, marginTop: 4, color: 'var(--text-primary)' }}>Resumo</span>
              </div>
              <div style={{ flex: 1, height: 2, background: 'var(--border-primary)', margin: '14px 10px 0' }} />
              <div onClick={() => setStep('delivery')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: step === 'delivery' ? 1 : 0.5, cursor: 'pointer' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: step === 'delivery' ? '#D4AF37' : 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step === 'delivery' ? '#000' : 'var(--text-secondary)', fontWeight: 'bold' }}>2</div>
                <span style={{ fontSize: 10, marginTop: 4, color: 'var(--text-primary)' }}>Entrega</span>
              </div>
              <div style={{ flex: 1, height: 2, background: 'var(--border-primary)', margin: '14px 10px 0' }} />
              <div onClick={() => { if (step !== 'summary') setStep('payment'); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: step === 'payment' ? 1 : 0.5, cursor: step === 'summary' ? 'not-allowed' : 'pointer' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: step === 'payment' ? '#D4AF37' : 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step === 'payment' ? '#000' : 'var(--text-secondary)', fontWeight: 'bold' }}>3</div>
                <span style={{ fontSize: 10, marginTop: 4, color: 'var(--text-primary)' }}>Pagamento</span>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: 12, borderRadius: 8, color: '#ef4444', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} /> {error}
            </div>
          )}

          {/* STEP 1: SUMMARY */}
          {step === 'summary' && (
            <div className="checkout-step">
              {/* PROGRESSO DE BENEFÍCIOS */}
              <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid var(--border-gold)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    {totalPrice >= freeShippingThreshold ? '🎉 Você ganhou Frete Grátis!' : `Faltam R$ ${(freeShippingThreshold - totalPrice).toFixed(2)} para Frete Grátis`}
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'var(--input-bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #D4AF37, #FFDF73)', transition: 'width 0.3s ease' }} />
                </div>
              </div>

              {/* RESUMO DE ECONOMIA */}
              {discount > 0 && (
                <div style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)', borderRadius: 12, padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Award size={20} color="#34C759" />
                  <span style={{ color: '#34C759', fontSize: 13, fontWeight: 'bold' }}>
                    Parabéns! Você está economizando R$ {discount.toFixed(2)} nesta compra.
                  </span>
                </div>
              )}

              <h2 style={{ fontSize: 18, color: 'var(--text-primary)', marginBottom: 16 }}>Resumo do Pedido</h2>
              <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-gold)', borderRadius: 16, padding: 16, marginBottom: 24 }}>
                {cartItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border-primary)' }}>
                    <div style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--input-bg)', backgroundImage: `url(${item.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: 13 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.quantity}x R$ {item.price.toFixed(2)}</div>
                    </div>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      R$ {(item.quantity * item.price).toFixed(2)}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 'bold', fontSize: 16, color: 'var(--text-primary)' }}>
                  <span>Subtotal</span>
                  <span>R$ {totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* INCENTIVO AO CLUBE */}
              <div style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(0,0,0,0))', border: '1px solid var(--border-gold)', borderRadius: 16, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Star size={24} color="#D4AF37" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={{ margin: '0 0 4px', color: '#D4AF37', fontSize: 14, fontWeight: 'bold' }}>Clientes do Clube economizam mais!</h4>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>Ganhe preços exclusivos e descontos especiais em todos os pedidos.</p>
                  <button onClick={() => navigate('/clube')} style={{ background: 'transparent', border: '1px solid #D4AF37', color: '#D4AF37', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}>Entrar para o Clube</button>
                </div>
              </div>

              {/* PRODUTOS COMPLEMENTARES */}
              <h3 style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 12 }}>Leve também</h3>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, marginBottom: 8, scrollbarWidth: 'none' }}>
                {complementaryProducts.map(prod => (
                  <div key={prod.id} style={{ minWidth: 120, background: 'var(--card-gradient)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ width: 60, height: 60, borderRadius: 8, background: '#fff', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={prod.image} alt={prod.title} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 4, height: 28, overflow: 'hidden' }}>{prod.title}</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8 }}>R$ {prod.price.toFixed(2)}</span>
                    <button onClick={() => addToCart(prod, 1)} style={{ background: 'var(--input-bg)', border: '1px solid #D4AF37', color: '#D4AF37', borderRadius: 6, padding: '4px 0', width: '100%', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}><Plus size={12} /> Add</button>
                  </div>
                ))}
              </div>

              {/* PROVA SOCIAL */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, color: 'var(--text-secondary)' }}>
                <TrendingUp size={14} color="#D4AF37" />
                <span style={{ fontSize: 11 }}>Mais de 150 clientes compraram hoje.</span>
              </div>

              <button 
                onClick={() => setStep('delivery')}
                style={{ width: '100%', padding: 16, borderRadius: 12, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
              >
                Continuar para Entrega <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* STEP 2: DELIVERY */}
          {step === 'delivery' && (
            <div className="checkout-step">
              <h2 style={{ fontSize: 18, color: 'var(--text-primary)', marginBottom: 16 }}>Onde deseja receber?</h2>
              
              <div style={{ 
                background: 'rgba(212,175,55,0.08)', 
                border: '1px solid var(--border-gold)', 
                borderRadius: 12, 
                padding: 14, 
                marginBottom: 20, 
                fontSize: 13, 
                color: 'var(--text-primary)', 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 10,
                lineHeight: 1.4
              }}>
                <ShieldCheck size={20} color="#D4AF37" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>O Nosso Jeito é 100% digital!</strong> Por isso, não possuímos ponto de retirada física. Realizamos a entrega rápida diretamente no seu condomínio. Escolha abaixo a sua preferência:
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <button 
                  onClick={() => setDeliveryMethod('apartment')}
                  style={{ flex: 1, padding: 16, borderRadius: 12, border: deliveryMethod === 'apartment' ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: deliveryMethod === 'apartment' ? 'rgba(212,175,55,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                >
                  <MapPin size={24} color={deliveryMethod === 'apartment' ? '#D4AF37' : 'var(--text-secondary)'} />
                  <span style={{ fontWeight: 'bold', fontSize: 13 }}>Entregar no Apartamento</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>O entregador sobe até a sua porta</span>
                </button>
                <button 
                  onClick={() => setDeliveryMethod('lobby')}
                  style={{ flex: 1, padding: 16, borderRadius: 12, border: deliveryMethod === 'lobby' ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: deliveryMethod === 'lobby' ? 'rgba(212,175,55,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                >
                  <CheckCircle size={24} color={deliveryMethod === 'lobby' ? '#D4AF37' : 'var(--text-secondary)'} />
                  <span style={{ fontWeight: 'bold', fontSize: 13 }}>Deixar na Portaria</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>Deixamos na portaria ou guarita</span>
                </button>
              </div>

              <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-gold)', borderRadius: 16, padding: 16 }}>
                <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-primary)', fontWeight: 'bold' }}>Endereço de Entrega</h3>
                {addresses.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {addresses.map(a => (
                      <div 
                        key={a.id} 
                        onClick={() => setAddress(a)}
                        style={{ padding: 12, borderRadius: 8, border: address?.id === a.id ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: address?.id === a.id ? 'rgba(212,175,55,0.05)' : 'var(--input-bg)', cursor: 'pointer' }}
                      >
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{a.street}, {a.number}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.neighborhood} - {a.city}</div>
                      </div>
                    ))}
                    <button onClick={() => navigate('/addresses')} style={{ padding: '12px', background: 'var(--input-bg)', border: '1px dashed var(--border-gold)', borderRadius: 8, color: '#D4AF37', marginTop: 8, cursor: 'pointer', fontWeight: 'bold' }}>
                      + Adicionar Novo Endereço
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Nenhum endereço cadastrado.</p>
                    <button onClick={() => navigate('/addresses')} style={{ padding: '8px 16px', background: 'var(--border-primary)', border: 'none', borderRadius: 8, color: 'var(--text-primary)', marginTop: 8, cursor: 'pointer' }}>
                      Adicionar Endereço
                    </button>
                  </div>
                )}
              </div>

              {/* BENEFÍCIOS RESUMIDOS */}
              <div style={{ display: 'flex', justifyContent: 'space-around', background: 'var(--input-bg)', borderRadius: 12, padding: 16, marginTop: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                  <Zap size={18} color="#D4AF37" />
                  <span style={{ fontSize: 10, fontWeight: 'bold' }}>Entrega rápida</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                  <ShieldCheck size={18} color="#D4AF37" />
                  <span style={{ fontSize: 10, fontWeight: 'bold' }}>Compra segura</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                  <Star size={18} color="#D4AF37" />
                  <span style={{ fontSize: 10, fontWeight: 'bold' }}>Itens selecionados</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button 
                  onClick={() => setStep('summary')}
                  style={{ flex: 1, padding: 16, borderRadius: 12, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                >
                  <ArrowLeft size={18} /> Voltar
                </button>
                <button 
                  onClick={handleNext}
                  style={{ flex: 2, padding: 16, borderRadius: 12, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                >
                  Ir p/ Pagamento <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT */}
          {step === 'payment' && (
            <div className="checkout-step">
              <h2 style={{ fontSize: 18, color: 'var(--text-primary)', marginBottom: 16 }}>Pagamento</h2>
              
              <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-gold)', borderRadius: 16, padding: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>R$ {totalPrice.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#34C759' }}>
                    <span>Desconto</span>
                    <span>- R$ {discount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--text-secondary)' }}>
                  <span>Entrega</span>
                  <span>Grátis</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: 18 }}>
                  <span>Total a Pagar</span>
                  <span>R$ {(totalPrice - discount).toFixed(2)}</span>
                </div>

                {/* Coupon input */}
                <div style={{ display: 'flex', gap: 8, marginTop: 16, borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
                  <input 
                    type="text" 
                    placeholder="Cupom de desconto" 
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13 }}
                  />
                  <button onClick={applyCoupon} style={{ padding: '0 16px', borderRadius: 8, background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
                    Aplicar
                  </button>
                </div>
              </div>

              <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-primary)' }}>Forma de Pagamento</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button 
                  onClick={() => setPaymentMethod('pix')}
                  style={{ padding: 16, borderRadius: 12, border: paymentMethod === 'pix' ? '2px solid #34C759' : '1px solid var(--border-primary)', background: paymentMethod === 'pix' ? 'rgba(52,199,89,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: paymentMethod === 'pix' ? '#34C759' : 'transparent', border: '2px solid', borderColor: paymentMethod === 'pix' ? '#34C759' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {paymentMethod === 'pix' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 'bold' }}>Pix</span>
                      <span style={{ fontSize: 9, background: 'rgba(52,199,89,0.15)', color: '#34C759', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold', textTransform: 'uppercase' }}>Recomendado</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Aprovação imediata</span>
                  </div>
                </button>

                <button 
                  onClick={() => setPaymentMethod('credit_card')}
                  style={{ padding: 16, borderRadius: 12, border: paymentMethod === 'credit_card' ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: paymentMethod === 'credit_card' ? 'rgba(212,175,55,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: paymentMethod === 'credit_card' ? '#D4AF37' : 'transparent', border: '2px solid', borderColor: paymentMethod === 'credit_card' ? '#D4AF37' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {paymentMethod === 'credit_card' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#000' }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 'bold' }}>Cartão de Crédito</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Parcele em até 3x sem juros</span>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    if (deliveryMethod !== 'lobby') setPaymentMethod('on_delivery');
                  }}
                  style={{ padding: 16, borderRadius: 12, border: paymentMethod === 'on_delivery' ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: paymentMethod === 'on_delivery' ? 'rgba(212,175,55,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: deliveryMethod === 'lobby' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 12, opacity: deliveryMethod === 'lobby' ? 0.5 : 1 }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: paymentMethod === 'on_delivery' ? '#D4AF37' : 'transparent', border: '2px solid', borderColor: paymentMethod === 'on_delivery' ? '#D4AF37' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {paymentMethod === 'on_delivery' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#000' }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 'bold' }}>Pagamento na Entrega</span>
                    <span style={{ fontSize: 11, color: deliveryMethod === 'lobby' ? '#ef4444' : 'var(--text-secondary)' }}>
                      {deliveryMethod === 'lobby' ? 'Indisponível para entrega na portaria' : 'Pague com cartão ou dinheiro ao receber'}
                    </span>
                  </div>
                </button>
              </div>

              {/* RESUMO FINAL DE BENEFÍCIOS */}
              <div style={{ textAlign: 'center', padding: '0 16px', marginTop: 32, marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8, fontWeight: 'bold' }}>Seu pedido está pronto!</h4>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {discount > 0 ? `Você economizou R$ ${discount.toFixed(2)}! ` : ''} 
                  Receberá seus produtos com segurança. Finalize agora para garantir sua oferta.
                </p>
              </div>

              {/* REFORÇO DE SEGURANÇA */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34C759' }}>
                  <Lock size={12} /> <span style={{ fontSize: 10, fontWeight: 'bold' }}>Pagamento Seguro</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34C759' }}>
                  <ShieldCheck size={12} /> <span style={{ fontSize: 10, fontWeight: 'bold' }}>Dados Criptografados</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button 
                  onClick={() => setStep('delivery')}
                  style={{ flex: 1, padding: 16, borderRadius: 12, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                >
                  <ArrowLeft size={18} /> Voltar
                </button>
                <button 
                  onClick={handleFinish}
                  disabled={loading}
                  style={{ flex: 2, padding: 16, borderRadius: 12, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: 'bold', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Processando...' : <><ShieldCheck size={18} /> Finalizar</>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(52, 199, 89, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={48} color="#34C759" />
              </div>
              <h2 style={{ color: 'var(--text-primary)', marginBottom: 8, fontWeight: 900 }}>Pedido Finalizado!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>Seu pedido {orderId} foi recebido com sucesso.</p>

              {/* Payment countdown & instruction box */}
              <div style={{ 
                background: 'rgba(212,175,55,0.06)', 
                border: '1.5px solid var(--border-gold)', 
                borderRadius: 16, 
                padding: 20, 
                marginBottom: 24, 
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(212,175,55,0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#D4AF37', marginBottom: 10 }}>
                  <Clock size={18} />
                  <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aguardando Pagamento</span>
                </div>
                
                <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '1px', marginBottom: 12 }}>
                  {formatTime(timeLeft)}
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Realize o pagamento em até <strong>10 minutos</strong> para garantir a reserva e a separação dos seus produtos. 
                  Nossa equipe confirmará o pagamento em instantes e atualizará o status do seu pedido.
                </p>
              </div>

              {paymentMethod === 'pix' && (
                <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
                  <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontWeight: 'bold' }}>Pague com Pix</h3>
                  <div style={{ background: '#fff', padding: 20, borderRadius: 12, display: 'inline-block', marginBottom: 16 }}>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${orderId}`} alt="QR Code Pix" />
                  </div>
                  <div style={{ background: 'var(--input-bg)', padding: 12, borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    00020101021126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426655440000...
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 12 }}>
                    Este é um código Pix simulado. Na aplicação real, aqui estaria a chave Copia e Cola.
                  </p>
                </div>
              )}

              <button 
                onClick={() => navigate('/orders')}
                style={{ width: '100%', padding: 16, borderRadius: 12, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer', marginBottom: 12 }}
              >
                Acompanhar Pedido
              </button>
              <button 
                onClick={() => navigate('/')}
                style={{ width: '100%', padding: 16, borderRadius: 12, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
              >
                Voltar à Loja
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
