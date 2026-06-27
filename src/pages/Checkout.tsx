import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { createOrder } from '../hooks/useOrders';
import { useToast } from '../contexts/ToastContext';
import { useShippingConfig } from '../hooks/useShippingConfig';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  ArrowLeft, CheckCircle, MapPin, 
  ChevronRight, AlertTriangle, ShieldCheck, Clock,
  Plus, Lock, Award, ShoppingCart
} from 'lucide-react';
import { MercadoLogo } from './Login';

type CheckoutStep = 'summary' | 'delivery' | 'payment' | 'success';

export function Checkout() {
  const navigate = useNavigate();
  const { cartItems, totalPrice, clearCart, addToCart } = useCart();
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const { config: shippingConfig } = useShippingConfig();
  // Idempotency guard: prevents duplicate orders from rapid/double clicks.
  const submittingRef = useRef(false);
  
  const complementaryProducts = [
    { id: 'prod-danone', title: 'Danone Grego', price: 18.90, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=150&q=80' },
    { id: 'prod-melitta', title: 'Café Melitta', price: 24.50, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=150&q=80' }
  ];

  // Delivery State
  const [deliveryMethod, setDeliveryMethod] = useState<'apartment' | 'lobby'>('apartment');
  const [address, setAddress] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);

  const freeShippingThreshold = shippingConfig?.freeShippingThreshold ?? 60;
  const baseShippingFee = shippingConfig?.baseShippingFee ?? 5;
  const progressPercent = Math.min((totalPrice / freeShippingThreshold) * 100, 100);

  const getDeliveryFee = () => {
    if (totalPrice >= freeShippingThreshold) return 0;
    if (!address) return baseShippingFee;

    const streetLower = (address.street || '').toLowerCase();
    const neighborhoodLower = (address.neighborhood || '').toLowerCase();
    const cityLower = (address.city || '').toLowerCase();
    const complementLower = (address.complement || '').toLowerCase();
    const labelLower = (address.label || '').toLowerCase();

    const condos = shippingConfig?.condos || {};
    for (const [condoName, fee] of Object.entries(condos)) {
      const nameLower = condoName.toLowerCase();
      if (
        streetLower.includes(nameLower) ||
        neighborhoodLower.includes(nameLower) ||
        cityLower.includes(nameLower) ||
        complementLower.includes(nameLower) ||
        labelLower.includes(nameLower)
      ) {
        return fee;
      }
    }

    return baseShippingFee;
  };

  const deliveryFee = getDeliveryFee();
  
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  

  
  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'on_delivery'>('pix');
  
  // Order State
  const [orderId, setOrderId] = useState<string | null>(null);

  // Discount
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);

  // Countdown timer for payment (10 minutes)
  const [timeLeft, setTimeLeft] = useState(600);

  const finalTotal = totalPrice - discount + deliveryFee;

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
    const code = couponCode.trim().toUpperCase();
    // Recognised coupon codes — in production, validate via a Firestore collection.
    const VALID_COUPONS: Record<string, number> = {
      'NOSSOJEITO10': 0.10,
    };
    if (VALID_COUPONS[code] !== undefined) {
      const discountAmount = totalPrice * VALID_COUPONS[code];
      setDiscount(discountAmount);
      toastSuccess('Cupom aplicado!', `Desconto de R$ ${discountAmount.toFixed(2)} adicionado.`);
    } else if (!code) {
      toastInfo('Campo vazio', 'Digite um código de cupom antes de aplicar.');
    } else {
      toastError('Cupom inválido', 'Código não encontrado ou expirado.');
    }
  };

  const handleNext = () => {
    if (step === 'delivery') {
      if (!address) {
        toastError('Endereço obrigatório', 'Selecione um endereço para entrega.');
        return;
      }
      setStep('payment');
    }
  };

  const handleFinish = async () => {
    // Idempotency: bail out if a submission is already in progress.
    if (submittingRef.current) return;

    if (!user) {
      navigate('/login?returnUrl=/checkout');
      return;
    }
    
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
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
        deliveryFee: deliveryFee,
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
      const msg = err.message || 'Erro ao processar o pedido. Tente novamente.';
      setError(msg);
      toastError('Erro no pedido', msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  if (cartItems.length === 0 && step !== 'success') {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Manrope','Outfit',sans-serif" }}>
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: 110, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--bg-secondary)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-gold)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
            <button onClick={() => navigate(-1)} 
              style={{ background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0 }}>
              <ArrowLeft size={16} />
            </button>
            <MercadoLogo size="sm" />
            <div style={{ width: 34 }} />
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: 16 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShoppingCart size={32} color="#D4AF37" />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
              Seu carrinho está vazio
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 0', maxWidth: 260, lineHeight: 1.5 }}>
              Que tal dar uma olhada em nossas ofertas e encher o carrinho?
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{ marginTop: 8, background: 'linear-gradient(135deg, #D4AF37, #FFDF73)', border: 'none', borderRadius: 14, color: '#090705', fontSize: 14, fontWeight: 900, padding: '14px 32px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            Explorar produtos 🛍️
          </button>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Manrope','Outfit',sans-serif" }}>
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: 90 }}>
        {/* Topbar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--bg-secondary)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-gold)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
            <button onClick={() => {
              if (step === 'payment') setStep('delivery');
              else if (step === 'delivery') setStep('summary');
              else navigate('/cart');
            }} 
              style={{ background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0 }}>
              <ArrowLeft size={16} />
            </button>
            <MercadoLogo size="sm" />
            <div style={{ width: 34 }} />
          </div>
        </div>

        <div style={{ padding: '10px 16px 2px' }}>
          <h1 style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Checkout</h1>
        </div>

        <div style={{ padding: '10px 16px', maxWidth: 600, margin: '0 auto' }}>
          
          {/* Progress Bar */}
          {step !== 'success' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, padding: '0 10px' }}>
              <div onClick={() => setStep('summary')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: step === 'summary' ? 1 : 0.5, cursor: 'pointer' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: step === 'summary' ? '#D4AF37' : 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step === 'summary' ? '#000' : 'var(--text-secondary)', fontWeight: 'bold', fontSize: 12 }}>1</div>
                <span style={{ fontSize: 9, marginTop: 3, color: 'var(--text-primary)' }}>Resumo</span>
              </div>
              <div style={{ flex: 1, height: 2, background: 'var(--border-primary)', margin: '12px 8px 0' }} />
              <div onClick={() => setStep('delivery')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: step === 'delivery' ? 1 : 0.5, cursor: 'pointer' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: step === 'delivery' ? '#D4AF37' : 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step === 'delivery' ? '#000' : 'var(--text-secondary)', fontWeight: 'bold', fontSize: 12 }}>2</div>
                <span style={{ fontSize: 9, marginTop: 3, color: 'var(--text-primary)' }}>Entrega</span>
              </div>
              <div style={{ flex: 1, height: 2, background: 'var(--border-primary)', margin: '12px 8px 0' }} />
              <div onClick={() => { if (step !== 'summary') setStep('payment'); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: step === 'payment' ? 1 : 0.5, cursor: step === 'summary' ? 'not-allowed' : 'pointer' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: step === 'payment' ? '#D4AF37' : 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step === 'payment' ? '#000' : 'var(--text-secondary)', fontWeight: 'bold', fontSize: 12 }}>3</div>
                <span style={{ fontSize: 9, marginTop: 3, color: 'var(--text-primary)' }}>Pagamento</span>
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
              <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid var(--border-gold)', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    {totalPrice >= freeShippingThreshold ? '🎉 Você ganhou Frete Grátis!' : `Faltam R$ ${(freeShippingThreshold - totalPrice).toFixed(2)} para Frete Grátis`}
                  </span>
                </div>
                <div style={{ width: '100%', height: 5, background: 'var(--input-bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #D4AF37, #FFDF73)', transition: 'width 0.3s ease' }} />
                </div>
              </div>

              {/* RESUMO DE ECONOMIA */}
              {discount > 0 && (
                <div style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={16} color="#34C759" />
                  <span style={{ color: '#34C759', fontSize: 12, fontWeight: 'bold' }}>
                    Você economiza R$ {discount.toFixed(2)} nesta compra.
                  </span>
                </div>
              )}

              <h2 style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 8, marginTop: 4 }}>Resumo do Pedido</h2>
              <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-gold)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
                {cartItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-primary)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 7, background: 'var(--input-bg)', backgroundImage: `url(${item.image})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: 12 }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.quantity}x R$ {item.price.toFixed(2)}</div>
                    </div>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: 13 }}>
                      R$ {(item.quantity * item.price).toFixed(2)}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontWeight: 'bold', fontSize: 14, color: 'var(--text-primary)' }}>
                  <span>Subtotal</span>
                  <span>R$ {totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* PRODUTOS COMPLEMENTARES */}
              <h3 style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 8 }}>Leve também</h3>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10, marginBottom: 10, scrollbarWidth: 'none' }}>
                {complementaryProducts.map(prod => (
                  <div key={prod.id} style={{ minWidth: 105, background: 'var(--card-gradient)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 7, background: '#fff', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={prod.image} alt={prod.title} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 3, height: 24, overflow: 'hidden' }}>{prod.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 6 }}>R$ {prod.price.toFixed(2)}</span>
                    <button onClick={() => addToCart(prod, 1)} style={{ background: 'var(--input-bg)', border: '1px solid #D4AF37', color: '#D4AF37', borderRadius: 5, padding: '3px 0', width: '100%', fontSize: 10, fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3 }}><Plus size={10} /> Aproveite</button>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setStep('delivery')}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: 14 }}
              >
                Continuar para Entrega <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: DELIVERY */}
          {step === 'delivery' && (
            <div className="checkout-step">
              <h2 style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 10, marginTop: 2 }}>Onde deseja receber?</h2>
              
              <div style={{ 
                background: 'rgba(212,175,55,0.08)', 
                border: '1px solid var(--border-gold)', 
                borderRadius: 10, 
                padding: '8px 10px', 
                marginBottom: 12, 
                fontSize: 12, 
                color: 'var(--text-primary)', 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 8,
                lineHeight: 1.4
              }}>
                <ShieldCheck size={16} color="#D4AF37" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>O Nosso Jeito é 100% digital!</strong> Entrega rápida direto no seu condomínio. Escolha a preferência:
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <button 
                  onClick={() => setDeliveryMethod('apartment')}
                  style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: deliveryMethod === 'apartment' ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: deliveryMethod === 'apartment' ? 'rgba(212,175,55,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
                >
                  <MapPin size={20} color={deliveryMethod === 'apartment' ? '#D4AF37' : 'var(--text-secondary)'} />
                  <span style={{ fontWeight: 'bold', fontSize: 12 }}>No Apartamento</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>Entregador sobe até a porta</span>
                </button>
                <button 
                  onClick={() => setDeliveryMethod('lobby')}
                  style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: deliveryMethod === 'lobby' ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: deliveryMethod === 'lobby' ? 'rgba(212,175,55,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
                >
                  <CheckCircle size={20} color={deliveryMethod === 'lobby' ? '#D4AF37' : 'var(--text-secondary)'} />
                  <span style={{ fontWeight: 'bold', fontSize: 12 }}>Na Portaria</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>Deixamos na portaria/guarita</span>
                </button>
              </div>

              <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-gold)', borderRadius: 12, padding: '10px 12px' }}>
                <h3 style={{ fontSize: 13, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 'bold' }}>Endereço de Entrega</h3>
                {addresses.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {addresses.map(a => (
                      <div 
                        key={a.id} 
                        onClick={() => setAddress(a)}
                        style={{ padding: '8px 10px', borderRadius: 8, border: address?.id === a.id ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: address?.id === a.id ? 'rgba(212,175,55,0.05)' : 'var(--input-bg)', cursor: 'pointer' }}
                      >
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: 13 }}>{a.street}, {a.number}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.neighborhood} - {a.city}</div>
                      </div>
                    ))}
                    <button onClick={() => navigate('/addresses')} style={{ padding: '8px', background: 'var(--input-bg)', border: '1px dashed var(--border-gold)', borderRadius: 7, color: '#D4AF37', marginTop: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>
                      + Adicionar Novo Endereço
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '12px 20px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum endereço cadastrado.</p>
                    <button onClick={() => navigate('/addresses')} style={{ padding: '7px 16px', background: 'var(--border-primary)', border: 'none', borderRadius: 8, color: 'var(--text-primary)', marginTop: 6, cursor: 'pointer', fontSize: 13 }}>
                      Adicionar Endereço
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button 
                  onClick={() => setStep('summary')}
                  style={{ flex: 1, padding: '11px 12px', borderRadius: 10, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 13 }}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button 
                  onClick={handleNext}
                  style={{ flex: 2, padding: '11px 12px', borderRadius: 10, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 13 }}
                >
                  Ir p/ Pagamento <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT */}
          {step === 'payment' && (
            <div className="checkout-step">
              <h2 style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 10, marginTop: 2 }}>Pagamento</h2>
              
              <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-gold)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: 'var(--text-secondary)', fontSize: 12 }}>
                  <span>Subtotal</span>
                  <span>R$ {totalPrice.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: '#34C759', fontSize: 12 }}>
                    <span>Desconto</span>
                    <span>- R$ {discount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: 'var(--text-secondary)', fontSize: 12 }}>
                  <span>Entrega</span>
                  <span>{deliveryFee === 0 ? 'Grátis' : `R$ ${deliveryFee.toFixed(2)}`}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: 15 }}>
                  <span>Total a Pagar</span>
                  <span>R$ {finalTotal.toFixed(2)}</span>
                </div>

                {/* Coupon input */}
                <div style={{ display: 'flex', gap: 7, marginTop: 10, borderTop: '1px solid var(--border-primary)', paddingTop: 10 }}>
                  <input 
                    type="text" 
                    placeholder="Cupom de desconto" 
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border-primary)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 12 }}
                  />
                  <button onClick={applyCoupon} style={{ padding: '0 12px', borderRadius: 7, background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>
                    Aplicar
                  </button>
                </div>
              </div>

              <h3 style={{ fontSize: 13, marginBottom: 8, color: 'var(--text-primary)' }}>Forma de Pagamento</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button 
                  onClick={() => setPaymentMethod('pix')}
                  style={{ padding: '10px 12px', borderRadius: 10, border: paymentMethod === 'pix' ? '2px solid #34C759' : '1px solid var(--border-primary)', background: paymentMethod === 'pix' ? 'rgba(52,199,89,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: paymentMethod === 'pix' ? '#34C759' : 'transparent', border: '2px solid', borderColor: paymentMethod === 'pix' ? '#34C759' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {paymentMethod === 'pix' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontWeight: 'bold', fontSize: 13 }}>Pix</span>
                      <span style={{ fontSize: 9, background: 'rgba(52,199,89,0.15)', color: '#34C759', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold', textTransform: 'uppercase' }}>Recomendado</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Aprovação imediata</span>
                  </div>
                </button>

                <button 
                  onClick={() => setPaymentMethod('credit_card')}
                  style={{ padding: '10px 12px', borderRadius: 10, border: paymentMethod === 'credit_card' ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: paymentMethod === 'credit_card' ? 'rgba(212,175,55,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: paymentMethod === 'credit_card' ? '#D4AF37' : 'transparent', border: '2px solid', borderColor: paymentMethod === 'credit_card' ? '#D4AF37' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {paymentMethod === 'credit_card' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#000' }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 'bold', fontSize: 13 }}>Cartão de Crédito</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Parcele em até 3x sem juros</span>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    if (deliveryMethod !== 'lobby') setPaymentMethod('on_delivery');
                  }}
                  style={{ padding: '10px 12px', borderRadius: 10, border: paymentMethod === 'on_delivery' ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: paymentMethod === 'on_delivery' ? 'rgba(212,175,55,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: deliveryMethod === 'lobby' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, opacity: deliveryMethod === 'lobby' ? 0.5 : 1 }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: paymentMethod === 'on_delivery' ? '#D4AF37' : 'transparent', border: '2px solid', borderColor: paymentMethod === 'on_delivery' ? '#D4AF37' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {paymentMethod === 'on_delivery' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#000' }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 'bold', fontSize: 13 }}>Pagamento na Entrega</span>
                    <span style={{ fontSize: 11, color: deliveryMethod === 'lobby' ? '#ef4444' : 'var(--text-secondary)' }}>
                      {deliveryMethod === 'lobby' ? 'Indisponível para entrega na portaria' : 'Pague com cartão ou dinheiro ao receber'}
                    </span>
                  </div>
                </button>
              </div>

              {/* REFORÇO DE SEGURANÇA */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34C759' }}>
                  <Lock size={11} /> <span style={{ fontSize: 10, fontWeight: 'bold' }}>Pagamento Seguro</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34C759' }}>
                  <ShieldCheck size={11} /> <span style={{ fontSize: 10, fontWeight: 'bold' }}>Dados Criptografados</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button 
                  onClick={() => setStep('delivery')}
                  style={{ flex: 1, padding: '11px 12px', borderRadius: 10, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 13 }}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button 
                  onClick={handleFinish}
                  disabled={loading}
                  style={{ flex: 2, padding: '11px 12px', borderRadius: 10, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: 'bold', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 13, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Processando...' : <><ShieldCheck size={16} /> Finalizar</>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '20px 8px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(52, 199, 89, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <CheckCircle size={38} color="#34C759" />
              </div>
              <h2 style={{ color: 'var(--text-primary)', marginBottom: 5, fontWeight: 900, fontSize: 18 }}>Pedido Finalizado!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 14, fontSize: 13 }}>Seu pedido {orderId} foi recebido com sucesso.</p>

              {/* Payment countdown & instruction box */}
              <div style={{ 
                background: 'rgba(212,175,55,0.06)', 
                border: '1.5px solid var(--border-gold)', 
                borderRadius: 12, 
                padding: '12px 14px', 
                marginBottom: 14, 
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(212,175,55,0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#D4AF37', marginBottom: 7 }}>
                  <Clock size={15} />
                  <span style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aguardando Pagamento</span>
                </div>
                
                <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '1px', marginBottom: 8 }}>
                  {formatTime(timeLeft)}
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  Realize o pagamento em até <strong>10 minutos</strong> para garantir a reserva dos seus produtos.
                </p>
              </div>

              {paymentMethod === 'pix' && (
                <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10, fontWeight: 'bold' }}>Pague com Pix</h3>
                  <div style={{ background: '#fff', padding: 12, borderRadius: 10, display: 'inline-block', marginBottom: 10 }}>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${orderId}`} alt="QR Code Pix" />
                  </div>
                  <div style={{ background: 'var(--input-bg)', padding: '8px 10px', borderRadius: 7, color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'left' }}>
                    00020101021126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426655440000...
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 8 }}>
                    Este é um código Pix simulado.
                  </p>
                </div>
              )}

              <button 
                onClick={() => navigate('/orders')}
                style={{ width: '100%', padding: '11px 16px', borderRadius: 10, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer', marginBottom: 10, fontSize: 13 }}
              >
                Acompanhar Pedido
              </button>
              <button 
                onClick={() => navigate('/')}
                style={{ width: '100%', padding: '11px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: 13 }}
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
