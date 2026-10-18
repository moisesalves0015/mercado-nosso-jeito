import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { createOrderViaFunction, type CreateOrderResult } from '../hooks/useOrders';
import { useToast } from '../contexts/ToastContext';
import { useShippingConfig } from '../hooks/useShippingConfig';
import { useAdminConfig } from '../hooks/useAdminConfig';
import { collection, query, getDocs } from 'firebase/firestore';
import { db, fns } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import {
  ArrowLeft, CheckCircle, MapPin,
  ChevronRight, AlertTriangle, ShieldCheck, Clock,
  Plus, Lock, Award, ShoppingCart
} from 'lucide-react';
import { MercadoLogo } from './Login';

// ── Types ─────────────────────────────────────────────────────────────────────
type CheckoutStep = 'summary' | 'delivery' | 'payment' | 'success';

interface SavedAddress {
  id: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  label?: string;
  isDefault?: boolean;
}

/** Maps Cloud Function HttpsError codes to user-friendly messages. */
function parseOrderError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { code?: string; message?: string };
    // FirebaseError from httpsCallable wraps HttpsError
    if (typeof e.message === 'string') {
      const msg = e.message;
      // Strip "internal: " prefix that firebase adds sometimes
      const stripped = msg.replace(/^(internal|functions\/[a-z-]+):\s*/i, '');
      return stripped || 'Erro ao processar o pedido. Tente novamente.';
    }
  }
  return 'Erro ao processar o pedido. Tente novamente.';
}

/**
 * True when we cannot know whether the server created the order (connection lost, timeout,
 * internal/unknown error). Definitive business errors return false.
 */
function isAmbiguousOrderError(err: unknown): boolean {
  const code = err && typeof err === 'object' ? (err as { code?: string }).code : undefined;
  if (!code) return true; // not a Firebase error (e.g. raw network failure)
  return [
    'functions/unavailable',
    'functions/deadline-exceeded',
    'functions/internal',
    'functions/unknown',
    'functions/aborted',
    'functions/cancelled',
  ].includes(code);
}

// ── Complementary products shown in summary step ───────────────────────────────
const COMPLEMENTARY_PRODUCTS = [
  { id: 'prod-danone', title: 'Danone Grego', price: 18.90, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=150&q=80' },
  { id: 'prod-melitta', title: 'Café Melitta', price: 24.50, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=150&q=80' },
];

export function Checkout() {
  const navigate = useNavigate();
  const { cartItems, totalPrice, clearCart, addToCart } = useCart();
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const { config: shippingConfig } = useShippingConfig();
  const { config: adminConfig } = useAdminConfig();
  const isPixAvailable = !!adminConfig.pixKey;

  // Idempotency key: generated once per checkout session mount.
  // If the user navigates away and returns, a new key is generated.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  // Double-click guard
  const submittingRef = useRef(false);

  // Delivery
  const [deliveryMethod, setDeliveryMethod] = useState<'apartment' | 'lobby'>('apartment');
  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);

  // Preview totals (display only — authoritative values come from backend)
  const freeShippingThreshold = shippingConfig?.freeShippingThreshold ?? 60;
  const baseShippingFee = shippingConfig?.baseShippingFee ?? 5;
  const progressPercent = Math.min((totalPrice / freeShippingThreshold) * 100, 100);

  const getPreviewDeliveryFee = (afterDiscount: number): number => {
    if (afterDiscount >= freeShippingThreshold) return 0;
    if (!address) return baseShippingFee;
    const streetLower = (address.street ?? '').toLowerCase();
    const neighborhoodLower = (address.neighborhood ?? '').toLowerCase();
    const labelLower = (address.label ?? '').toLowerCase();
    const condos = shippingConfig?.condos ?? {};
    for (const [condoName, fee] of Object.entries(condos)) {
      const nl = condoName.toLowerCase();
      if (streetLower.includes(nl) || neighborhoodLower.includes(nl) || labelLower.includes(nl)) {
        return fee;
      }
    }
    return baseShippingFee;
  };

  // Step / UI
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [loading, setLoading] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<CreateOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'on_delivery'>('pix');

  // Coupon: validated by the backend (validateCoupon); the final discount is always recomputed server-side.
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponInfo, setCouponInfo] = useState<{ type: string; value: number } | null>(null);

  // Preview mirrors the server rules (percentage value is a 0..1 fraction; fixed is capped at subtotal).
  const previewDiscount = (() => {
    if (!couponApplied || !couponInfo) return 0;
    const raw = couponInfo.type === 'percentage'
      ? totalPrice * Math.min(Math.max(couponInfo.value, 0), 1)
      : Math.min(couponInfo.value, totalPrice);
    return Math.max(0, raw);
  })();
  const previewDeliveryFee = getPreviewDeliveryFee(totalPrice - previewDiscount);
  const previewTotal = Math.max(0.01, totalPrice - previewDiscount + previewDeliveryFee);


  useEffect(() => {
    if (deliveryMethod === 'lobby' && paymentMethod === 'on_delivery' && isPixAvailable) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaymentMethod('pix');
    }
  }, [deliveryMethod, paymentMethod, isPixAvailable]);

  useEffect(() => {
    if (!isPixAvailable && paymentMethod === 'pix') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaymentMethod('on_delivery');
    }
  }, [isPixAvailable, paymentMethod]);

  // Load addresses when reaching delivery step
  useEffect(() => {
    if (step !== 'delivery' || !user) return;
    const loadAddresses = async () => {
      try {
        const q = query(collection(db, 'users', user.uid, 'addresses'));
        const snap = await getDocs(q);
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedAddress));
        setAddresses(loaded);
        const defaultAddr = loaded.find((a) => a.isDefault) ?? loaded[0] ?? null;
        setAddress(defaultAddr);
      } catch (err) {
        console.error('Error loading addresses', err);
      }
    };
    void loadAddresses();
  }, [step, user]);


  /** Coupon is validated server-side on submission; this just marks intent. */
  const applyCouponLocally = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      toastInfo('Campo vazio', 'Digite um código de cupom antes de aplicar.');
      return;
    }
    
    setLoading(true);
    try {
      const validateFn = httpsCallable<{ code: string }, { valid: boolean; error?: string; discountType?: string; discountValue?: number; minOrderValue?: number }>(fns, 'validateCoupon');
      const res = await validateFn({ code });

      if (res.data.valid) {
        const minOrder = Number(res.data.minOrderValue ?? 0);
        if (minOrder > 0 && totalPrice < minOrder) {
          setCouponApplied(false);
          setCouponInfo(null);
          toastError('Cupom indisponível', `Pedido mínimo para este cupom: R$ ${minOrder.toFixed(2)}.`);
          return;
        }
        setCouponInfo({ type: String(res.data.discountType ?? 'fixed'), value: Number(res.data.discountValue ?? 0) });
        setCouponApplied(true);
        toastSuccess('Cupom aplicado', 'O valor final é confirmado pelo servidor ao finalizar o pedido.');
      } else {
        setCouponApplied(false);
        setCouponInfo(null);
        toastError('Cupom inválido', res.data.error || 'Não foi possível aplicar o cupom.');
      }
    } catch {
      setCouponApplied(false);
      toastError('Erro', 'Ocorreu um erro ao validar o cupom.');
    } finally {
      setLoading(false);
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
    if (submittingRef.current) return;
    if (!user) {
      navigate('/login?returnUrl=/checkout');
      return;
    }
    if (!address) {
      toastError('Endereço obrigatório', 'Selecione um endereço de entrega.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await createOrderViaFunction({
        productItems: cartItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
        addressId: address.id,
        deliveryMethod,
        paymentMethod,
        couponCode: couponApplied && couponCode ? couponCode.trim().toUpperCase() : undefined,
        idempotencyKey: idempotencyKeyRef.current,
        notes: undefined,
      });

      setConfirmedOrder(result);
      clearCart();
      // Renew key so a revisit to the page generates a fresh order
      idempotencyKeyRef.current = crypto.randomUUID();

      // Fire confetti (lazy loaded)
      import('canvas-confetti').then((confettiModule) => {
        const fireConfetti = confettiModule.default;
        fireConfetti({
          particleCount: 150,
          spread: 80,
          colors: ['#FFDF73', '#D4AF37', '#E7BC79', '#FFFFFF'],
        });
      });

      setStep('success');
    } catch (err: unknown) {
      console.error('createOrderViaFunction error:', err);
      const ambiguous = isAmbiguousOrderError(err);
      const msg = ambiguous
        ? 'Não conseguimos confirmar se o pedido foi criado (falha de conexão). Toque em Finalizar novamente: não vamos duplicar o pedido. Se preferir, confira em "Meus pedidos".'
        : parseOrderError(err);
      setError(msg);
      toastError(ambiguous ? 'Conexão instável' : 'Erro no pedido', msg);
      // Ambiguous failure (network/timeout/internal): the server may already have created the order.
      // KEEP the idempotency key so the retry returns that same order instead of creating a second one.
      // Definitive failure (validation/stock/coupon/permission): nothing was created, so renew the key.
      if (!ambiguous) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  if (cartItems.length === 0 && step !== 'success') {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Manrope','Outfit',sans-serif" }}>
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: 110, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-secondary)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-gold)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
              <button onClick={() => navigate(-1)} style={{ background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0 }}>
                <ArrowLeft size={16} />
              </button>
              <MercadoLogo size="sm" />
              <div style={{ width: 34 }} />
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: 16 }}>
            <div style={{ width: 80, height: 80, borderRadius: 24, background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={32} color="#D4AF37" />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Seu carrinho está vazio</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 0', maxWidth: 260, lineHeight: 1.5 }}>Que tal dar uma olhada em nossas ofertas e encher o carrinho?</p>
            </div>
            <button onClick={() => navigate('/')} style={{ marginTop: 8, background: 'linear-gradient(135deg, #D4AF37, #FFDF73)', border: 'none', borderRadius: 14, color: '#090705', fontSize: 14, fontWeight: 900, padding: '14px 32px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
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
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-secondary)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-gold)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
            <button onClick={() => {
              if (step === 'payment') setStep('delivery');
              else if (step === 'delivery') setStep('summary');
              else navigate('/cart');
            }} style={{ background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0 }}>
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
              {/* Free shipping progress */}
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

              {couponApplied && (
                <div style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={16} color="#34C759" />
                  <span style={{ color: '#34C759', fontSize: 12, fontWeight: 'bold' }}>
                    Cupom registrado — desconto confirmado ao finalizar.
                  </span>
                </div>
              )}

              <h2 style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 8, marginTop: 4 }}>Resumo do Pedido</h2>
              <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-gold)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
                {cartItems.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-primary)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 7, background: 'var(--input-bg)', backgroundImage: `url(${item.image})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: 12 }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.quantity}x R$ {item.price.toFixed(2)}</div>
                    </div>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: 13 }}>R$ {(item.quantity * item.price).toFixed(2)}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontWeight: 'bold', fontSize: 14, color: 'var(--text-primary)' }}>
                  <span>Subtotal</span>
                  <span>R$ {totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <h3 style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 8 }}>Leve também</h3>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10, marginBottom: 10, scrollbarWidth: 'none' }}>
                {COMPLEMENTARY_PRODUCTS.map((prod) => (
                  <div key={prod.id} style={{ minWidth: 105, background: 'var(--card-gradient)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 7, background: '#fff', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={prod.image} alt={prod.title} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} loading="lazy" />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 3, height: 24, overflow: 'hidden' }}>{prod.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 6 }}>R$ {prod.price.toFixed(2)}</span>
                    <button onClick={() => addToCart(prod, 1)} style={{ background: 'var(--input-bg)', border: '1px solid #D4AF37', color: '#D4AF37', borderRadius: 5, padding: '3px 0', width: '100%', fontSize: 10, fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3 }}><Plus size={10} /> Aproveite</button>
                  </div>
                ))}
              </div>

              <button onClick={() => setStep('delivery')} style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: 14 }}>
                Continuar para Entrega <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: DELIVERY */}
          {step === 'delivery' && (
            <div className="checkout-step">
              <h2 style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 10, marginTop: 2 }}>Onde deseja receber?</h2>

              <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid var(--border-gold)', borderRadius: 10, padding: '8px 10px', marginBottom: 12, fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.4 }}>
                <ShieldCheck size={16} color="#D4AF37" style={{ flexShrink: 0, marginTop: 2 }} />
                <span><strong>O Nosso Jeito é 100% digital!</strong> Entrega rápida direto no seu condomínio. Escolha a preferência:</span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <button onClick={() => setDeliveryMethod('apartment')} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: deliveryMethod === 'apartment' ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: deliveryMethod === 'apartment' ? 'rgba(212,175,55,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <MapPin size={20} color={deliveryMethod === 'apartment' ? '#D4AF37' : 'var(--text-secondary)'} />
                  <span style={{ fontWeight: 'bold', fontSize: 12 }}>No Apartamento</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>Entregador sobe até a porta</span>
                </button>
                <button onClick={() => setDeliveryMethod('lobby')} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: deliveryMethod === 'lobby' ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: deliveryMethod === 'lobby' ? 'rgba(212,175,55,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <CheckCircle size={20} color={deliveryMethod === 'lobby' ? '#D4AF37' : 'var(--text-secondary)'} />
                  <span style={{ fontWeight: 'bold', fontSize: 12 }}>Na Portaria</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>Deixamos na portaria/guarita</span>
                </button>
              </div>

              <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-gold)', borderRadius: 12, padding: '10px 12px' }}>
                <h3 style={{ fontSize: 13, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 'bold' }}>Endereço de Entrega</h3>
                {addresses.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {addresses.map((a) => (
                      <div key={a.id} onClick={() => setAddress(a)} style={{ padding: '8px 10px', borderRadius: 8, border: address?.id === a.id ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: address?.id === a.id ? 'rgba(212,175,55,0.05)' : 'var(--input-bg)', cursor: 'pointer' }}>
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
                <button onClick={() => setStep('summary')} style={{ flex: 1, padding: '11px 12px', borderRadius: 10, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button onClick={handleNext} style={{ flex: 2, padding: '11px 12px', borderRadius: 10, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 13 }}>
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
                {couponApplied && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: '#34C759', fontSize: 12 }}>
                    <span>Desconto estimado</span>
                    <span>- R$ {previewDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: 'var(--text-secondary)', fontSize: 12 }}>
                  <span>Entrega (estimada)</span>
                  <span>{previewDeliveryFee === 0 ? 'Grátis' : `R$ ${previewDeliveryFee.toFixed(2)}`}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: 15 }}>
                  <span>Total estimado</span>
                  <span>R$ {previewTotal.toFixed(2)}</span>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '6px 0 0', textAlign: 'right' }}>
                  * Valor final confirmado pelo servidor ao finalizar.
                </p>

                {/* Coupon input */}
                <div style={{ display: 'flex', gap: 7, marginTop: 10, borderTop: '1px solid var(--border-primary)', paddingTop: 10 }}>
                  <input
                    type="text"
                    placeholder="Cupom de desconto"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    disabled={couponApplied}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border-primary)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 12 }}
                  />
                  <button onClick={applyCouponLocally} disabled={couponApplied} style={{ padding: '0 12px', borderRadius: 7, background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', cursor: couponApplied ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                    {couponApplied ? '✓' : 'Aplicar'}
                  </button>
                </div>
              </div>

              <h3 style={{ fontSize: 13, marginBottom: 8, color: 'var(--text-primary)' }}>Forma de Pagamento</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => isPixAvailable && setPaymentMethod('pix')} style={{ padding: '10px 12px', borderRadius: 10, border: paymentMethod === 'pix' ? '2px solid #34C759' : '1px solid var(--border-primary)', background: paymentMethod === 'pix' ? 'rgba(52,199,89,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: isPixAvailable ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 10, opacity: isPixAvailable ? 1 : 0.5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: paymentMethod === 'pix' ? '#34C759' : 'transparent', border: '2px solid', borderColor: paymentMethod === 'pix' ? '#34C759' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {paymentMethod === 'pix' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontWeight: 'bold', fontSize: 13 }}>Pix</span>
                      {isPixAvailable ? (
                        <span style={{ fontSize: 9, background: 'rgba(52,199,89,0.15)', color: '#34C759', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold', textTransform: 'uppercase' }}>Recomendado</span>
                      ) : (
                        <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold', textTransform: 'uppercase' }}>Indisponível</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {isPixAvailable ? 'Aprovação manual (10 mins)' : 'Chave não configurada no admin'}
                    </span>
                  </div>
                </button>

                <button onClick={() => { if (deliveryMethod !== 'lobby') setPaymentMethod('on_delivery'); }} style={{ padding: '10px 12px', borderRadius: 10, border: paymentMethod === 'on_delivery' ? '2px solid #D4AF37' : '1px solid var(--border-primary)', background: paymentMethod === 'on_delivery' ? 'rgba(212,175,55,0.1)' : 'var(--card-bg)', color: 'var(--text-primary)', cursor: deliveryMethod === 'lobby' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, opacity: deliveryMethod === 'lobby' ? 0.5 : 1 }}>
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

              <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34C759' }}>
                  <Lock size={11} /> <span style={{ fontSize: 10, fontWeight: 'bold' }}>Pagamento Seguro</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34C759' }}>
                  <ShieldCheck size={11} /> <span style={{ fontSize: 10, fontWeight: 'bold' }}>Dados Criptografados</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setStep('delivery')} style={{ flex: 1, padding: '11px 12px', borderRadius: 10, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button onClick={() => void handleFinish()} disabled={loading} style={{ flex: 2, padding: '11px 12px', borderRadius: 10, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: 'bold', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 13, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Processando...' : <><ShieldCheck size={16} /> Finalizar</>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && confirmedOrder && (
            <div style={{ textAlign: 'center', padding: '20px 8px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(52, 199, 89, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <CheckCircle size={38} color="#34C759" />
              </div>
              <h2 style={{ color: 'var(--text-primary)', marginBottom: 5, fontWeight: 900, fontSize: 18 }}>Pedido Criado com Sucesso!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 14, fontSize: 13 }}>
                Seu pedido <strong>{confirmedOrder.orderNumber}</strong> foi gravado no sistema.
                Total do pedido: <strong>R$ {confirmedOrder.total.toFixed(2)}</strong>
              </p>

              {/* Payment countdown or On Delivery badge */}
              {confirmedOrder.paymentStatus === 'approved' ? (
                <div style={{ background: 'rgba(52,199,89,0.06)', border: '1.5px solid rgba(52,199,89,0.3)', borderRadius: 12, padding: '14px', marginBottom: 14, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#34C759', marginBottom: 6 }}>
                    <ShieldCheck size={16} />
                    <span style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>Pagamento Aprovado</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                    {confirmedOrder.status === 'delivered'
                      ? 'O pagamento deste pedido foi confirmado e a entrega já foi concluída com sucesso!'
                      : confirmedOrder.status === 'delivering'
                      ? 'O pagamento deste pedido já foi confirmado! Seu pedido está a caminho.'
                      : confirmedOrder.status === 'cancelled'
                      ? 'O pagamento deste pedido consta como aprovado, porém o pedido foi cancelado no sistema. Contate o suporte para esclarecimentos.'
                      : 'O pagamento deste pedido já foi confirmado! Ele está em preparação para entrega.'}
                  </p>
                </div>
              ) : paymentMethod === 'pix' ? (
                <div style={{ background: 'rgba(212,175,55,0.06)', border: '1.5px solid var(--border-gold)', borderRadius: 12, padding: '12px 14px', marginBottom: 14, textAlign: 'center', boxShadow: '0 4px 20px rgba(212,175,55,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#D4AF37', marginBottom: 7 }}>
                    <Clock size={15} />
                    <span style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aguardando Pagamento & Conferência</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                    Transfira o valor exato via Pix abaixo. Seu pedido foi registrado com status <strong>Aguardando Conferência</strong> e será preparado assim que o operador confirmar o recebimento. A conferência é manual e pode levar alguns minutos.
                  </p>
                </div>
              ) : paymentMethod === 'on_delivery' ? (
                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1.5px solid rgba(59,130,246,0.3)', borderRadius: 12, padding: '14px', marginBottom: 14, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#3B82F6', marginBottom: 6 }}>
                    <ShieldCheck size={16} />
                    <span style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>Pagamento na Entrega</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                    Seu pedido está confirmado para cobrança no momento da entrega! Tenha em mãos seu cartão ou dinheiro ao receber o entregador.
                  </p>
                </div>
              ) : null}

              {paymentMethod === 'pix' && adminConfig.pixKey && (
                <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10, fontWeight: 'bold' }}>Dados da Chave Pix</h3>
                  
                  <div style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: 8, textAlign: 'left', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Chave Pix:</div>
                    <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{adminConfig.pixKey}</div>
                    
                    {adminConfig.pixName && (
                      <>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, marginBottom: 4 }}>Nome do Recebedor:</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{adminConfig.pixName}</div>
                      </>
                    )}
                  </div>
                  
                  <button onClick={() => { navigator.clipboard.writeText(adminConfig.pixKey); toastSuccess('Copiado!', 'Chave Pix copiada'); }} style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'rgba(52, 199, 89, 0.1)', color: '#34C759', border: '1px solid #34C759', fontWeight: 'bold', cursor: 'pointer', fontSize: 13 }}>
                    Copiar Chave Pix
                  </button>
                </div>
              )}

              <button onClick={() => navigate('/orders')} style={{ width: '100%', padding: '11px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', color: '#000', fontWeight: '900', cursor: 'pointer', marginBottom: 10, fontSize: 13, border: 'none' }}>
                Acompanhar Status do Pedido
              </button>
              <button onClick={() => navigate('/')} style={{ width: '100%', padding: '11px 16px', borderRadius: 10, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer', fontSize: 13 }}>
                Voltar à Loja
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
