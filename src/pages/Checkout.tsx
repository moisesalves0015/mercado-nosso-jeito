import { useState, useEffect, useMemo, useRef } from 'react';
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
  ArrowLeft, CheckCircle, CheckCircle2, MapPin,
  ChevronRight, AlertTriangle, ShieldCheck, Clock,
  Plus, Lock, Award, ShoppingCart, Sparkles
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

// ── Checkout upsell ("Leve também") uses catalog + Admin upsell-config ─────────
import { useCatalog } from '../hooks/useCatalog';
import { useUpsellConfig } from '../hooks/useUpsellConfig';
import { getEffectiveProductPrice } from '../utils/productPricing';
import { buildCheckoutCandyProducts } from '../utils/upsellRecommendations';

export function Checkout() {
  const navigate = useNavigate();
  const { cartItems, totalPrice, clearCart, addToCart } = useCart();
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const { config: shippingConfig } = useShippingConfig();
  const { config: adminConfig } = useAdminConfig();
  const catalog = useCatalog();
  const upsellConfig = useUpsellConfig();
  const [recentlyAddedUpsellId, setRecentlyAddedUpsellId] = useState<string | null>(null);
  const isPixAvailable = !!adminConfig.pixKey;

  const checkoutRecommendations = useMemo(() => {
    const resolved = buildCheckoutCandyProducts({
      config: upsellConfig.checkout,
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
  }, [upsellConfig.checkout, cartItems, catalog.products, catalog.byId]);

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
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Seu carrinho está vazio</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 0', maxWidth: 280, lineHeight: 1.5 }}>Que tal dar uma olhada em nossas ofertas e encher o carrinho?</p>
            </div>
            <button onClick={() => navigate('/')} className="commerce-btn-primary" style={{ marginTop: 8, width: '100%', maxWidth: 260 }}>
              <span>Explorar Produtos</span>
              <ChevronRight size={17} />
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
        <div style={{ position: 'sticky', top: 0, zIndex: 1000, background: 'var(--bg-secondary)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-gold)' }}>
          <div className="safe-area-top-bg" style={{ background: 'var(--bg-secondary)' }} />
          <div className="commerce-topbar-inner">
            <button onClick={() => {
              if (step === 'payment') setStep('delivery');
              else if (step === 'delivery') setStep('summary');
              else navigate('/cart');
            }} className="btn-icon-round" aria-label="Voltar">
              <ArrowLeft size={16} />
            </button>
            <div className="commerce-topbar-center">
              <span className="commerce-topbar-title">Finalizar Pedido</span>
              <span className="commerce-secure-pill">
                <ShieldCheck size={11} /> Compra 100% Segura
              </span>
            </div>
            <MercadoLogo size="sm" />
          </div>
        </div>

        <div className="commerce-shell commerce-fade-in">
          {/* Stepper */}
          {step !== 'success' && (
            <div className="commerce-stepper">
              <div onClick={() => setStep('summary')} className="commerce-stepper-item">
                <div className={`commerce-stepper-bubble ${step === 'summary' ? 'is-active' : 'is-done'}`}>
                  {step !== 'summary' ? <CheckCircle2 size={15} /> : '1'}
                </div>
                <span className={`commerce-stepper-label ${step === 'summary' ? 'is-active' : ''}`}>1. Itens</span>
              </div>
              <div className={`commerce-stepper-line ${step === 'delivery' || step === 'payment' ? 'is-active' : ''}`} />
              <div onClick={() => setStep('delivery')} className="commerce-stepper-item">
                <div className={`commerce-stepper-bubble ${step === 'delivery' ? 'is-active' : step === 'payment' ? 'is-done' : 'is-idle'}`}>
                  {step === 'payment' ? <CheckCircle2 size={15} /> : '2'}
                </div>
                <span className={`commerce-stepper-label ${step === 'delivery' ? 'is-active' : ''}`}>2. Entrega</span>
              </div>
              <div className={`commerce-stepper-line ${step === 'payment' ? 'is-active' : ''}`} />
              <div onClick={() => { if (step !== 'summary') setStep('payment'); }} className="commerce-stepper-item" style={{ cursor: step === 'summary' ? 'not-allowed' : 'pointer' }}>
                <div className={`commerce-stepper-bubble ${step === 'payment' ? 'is-active' : 'is-idle'}`}>
                  3
                </div>
                <span className={`commerce-stepper-label ${step === 'payment' ? 'is-active' : ''}`}>3. Pagamento</span>
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
              <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid var(--border-gold)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {totalPrice >= freeShippingThreshold ? '🎉 Você ganhou Frete Grátis!' : `Faltam R$ ${(freeShippingThreshold - totalPrice).toFixed(2)} para Frete Grátis`}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 900, color: totalPrice >= freeShippingThreshold ? '#10b981' : '#D4AF37', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(progressPercent)}%
                  </span>
                </div>
                <div className="commerce-progress-track">
                  <div
                    className="commerce-progress-fill"
                    style={{
                      width: `${progressPercent}%`,
                      background: totalPrice >= freeShippingThreshold ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #D4AF37, #FFDF73)',
                    }}
                  />
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

              <div className="commerce-section-header">
                <div className="commerce-section-header-title">
                  <h2>Resumo dos Itens</h2>
                </div>
              </div>
              <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-gold)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
                {cartItems.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-primary)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 7, background: 'var(--input-bg)', backgroundImage: `url(${item.image})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12.5 }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.quantity}x R$ {item.price.toFixed(2)}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>R$ {(item.quantity * item.price).toFixed(2)}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                  <span>Subtotal</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>R$ {totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {checkoutRecommendations.length > 0 && (
                <>
                  <div className="commerce-section-header">
                    <div className="commerce-section-header-title">
                      <Sparkles size={14} color="#10b981" />
                      <h3>{upsellConfig.checkout.title || 'Leve Também'}</h3>
                    </div>
                    <span className="commerce-section-tag">
                      {upsellConfig.checkout.isAuto ? 'Guloseimas & complementos' : 'Seleção especial'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10, marginBottom: 10, scrollbarWidth: 'none' }}>
                    {checkoutRecommendations.map((prod) => {
                      const justAdded = recentlyAddedUpsellId === prod.id;
                      return (
                        <div key={prod.id} style={{ minWidth: 110, maxWidth: 118, flexShrink: 0, background: 'var(--card-gradient)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                          <div style={{ width: 46, height: 46, borderRadius: 7, background: '#fff', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={prod.image} alt={prod.title} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} loading="lazy" />
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, height: 26, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.25 }}>{prod.title}</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>R$ {prod.price.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              addToCart(prod, 1);
                              setRecentlyAddedUpsellId(prod.id);
                              window.setTimeout(() => setRecentlyAddedUpsellId((cur) => (cur === prod.id ? null : cur)), 1200);
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
                </>
              )}

              <button type="button" onClick={() => setStep('delivery')} className="commerce-btn-primary" style={{ width: '100%', marginTop: 6 }}>
                <span>Continuar para a Entrega</span>
                <ChevronRight size={17} />
              </button>
            </div>
          )}

          {/* STEP 2: DELIVERY */}
          {step === 'delivery' && (
            <div className="checkout-step">
              <div className="commerce-section-header">
                <div className="commerce-section-header-title">
                  <h2>Onde deseja receber?</h2>
                </div>
              </div>

              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.4 }}>
                <ShieldCheck size={16} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                <span><strong>O Nosso Jeito é 100% digital!</strong> Entrega expressa direto no seu condomínio. Escolha sua preferência:</span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('apartment')}
                  className={`commerce-select-card ${deliveryMethod === 'apartment' ? 'is-selected' : ''}`}
                  style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                >
                  <MapPin size={22} color={deliveryMethod === 'apartment' ? '#10b981' : 'var(--text-secondary)'} />
                  <span style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--text-primary)' }}>No Apartamento</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.25 }}>Entregador sobe até a porta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('lobby')}
                  className={`commerce-select-card ${deliveryMethod === 'lobby' ? 'is-selected' : ''}`}
                  style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                >
                  <CheckCircle size={22} color={deliveryMethod === 'lobby' ? '#10b981' : 'var(--text-secondary)'} />
                  <span style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--text-primary)' }}>Na Portaria</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.25 }}>Deixamos na portaria/guarita</span>
                </button>
              </div>

              <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-gold)', borderRadius: 12, padding: '12px' }}>
                <h3 style={{ fontSize: 13, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 800 }}>Endereço de Entrega</h3>
                {addresses.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {addresses.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => setAddress(a)}
                        className={`commerce-select-card ${address?.id === a.id ? 'is-selected' : ''}`}
                        style={{ padding: '10px 12px' }}
                      >
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 13 }}>{a.street}, {a.number}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{a.neighborhood} - {a.city}</div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => navigate('/addresses')}
                      className="commerce-btn-dashed"
                      style={{ marginTop: 4 }}
                    >
                      <Plus size={14} /> Adicionar Novo Endereço
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '12px 20px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum endereço cadastrado.</p>
                    <button
                      type="button"
                      onClick={() => navigate('/addresses')}
                      className="commerce-btn-primary"
                      style={{ height: 38, fontSize: 12.5, marginTop: 6 }}
                    >
                      <Plus size={14} /> Cadastrar Endereço
                    </button>
                  </div>
                )}
              </div>

              <div className="commerce-btn-row" style={{ marginTop: 16 }}>
                <button type="button" onClick={() => setStep('summary')} className="commerce-btn-secondary" style={{ flex: 1 }}>
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button type="button" onClick={handleNext} className="commerce-btn-primary" style={{ flex: 2 }}>
                  <span>Avançar para Pagamento</span>
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT */}
          {step === 'payment' && (
            <div className="checkout-step">
              <div className="commerce-section-header">
                <div className="commerce-section-header-title">
                  <h2>3. Forma de Pagamento</h2>
                </div>
              </div>

              <div style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-gold)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
                  <span>Subtotal</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>R$ {totalPrice.toFixed(2)}</span>
                </div>
                {couponApplied && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#10b981', fontSize: 12, fontWeight: 700 }}>
                    <span>Desconto estimado</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>- R$ {previewDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
                  <span>Entrega (estimada)</span>
                  <span>{previewDeliveryFee === 0 ? <strong style={{ color: '#10b981' }}>Grátis</strong> : `R$ ${previewDeliveryFee.toFixed(2)}`}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-primary)', color: 'var(--text-primary)', fontWeight: 800, fontSize: 15 }}>
                  <span>Total estimado</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>R$ {previewTotal.toFixed(2)}</span>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '6px 0 0', textAlign: 'right' }}>
                  * Valor final confirmado pelo servidor ao finalizar.
                </p>

                {/* Coupon input */}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, borderTop: '1px solid var(--border-primary)', paddingTop: 10 }}>
                  <input
                    type="text"
                    placeholder="Cupom de desconto"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    disabled={couponApplied}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}
                  />
                  <button
                    type="button"
                    onClick={applyCouponLocally}
                    disabled={couponApplied}
                    className="commerce-btn-coupon"
                    style={{ cursor: couponApplied ? 'not-allowed' : 'pointer' }}
                  >
                    {couponApplied ? '✓ Aplicado' : 'Aplicar'}
                  </button>
                </div>
              </div>

              <h3 style={{ fontSize: 13, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 800 }}>Escolha como pagar</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => isPixAvailable && setPaymentMethod('pix')}
                  className={`commerce-select-card ${paymentMethod === 'pix' ? 'is-selected' : ''}`}
                  style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: isPixAvailable ? 1 : 0.5, cursor: isPixAvailable ? 'pointer' : 'not-allowed' }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: paymentMethod === 'pix' ? '#10b981' : 'transparent', border: '2px solid', borderColor: paymentMethod === 'pix' ? '#10b981' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {paymentMethod === 'pix' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text-primary)' }}>Pix</span>
                      {isPixAvailable ? (
                        <span style={{ fontSize: 9.5, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 8px', borderRadius: 6, fontWeight: 800, textTransform: 'uppercase' }}>Recomendado</span>
                      ) : (
                        <span style={{ fontSize: 9.5, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: 6, fontWeight: 800, textTransform: 'uppercase' }}>Indisponível</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {isPixAvailable ? 'Aprovação manual (10 mins)' : 'Chave não configurada no admin'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { if (deliveryMethod !== 'lobby') setPaymentMethod('on_delivery'); }}
                  className={`commerce-select-card ${paymentMethod === 'on_delivery' ? 'is-selected' : ''}`}
                  style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: deliveryMethod === 'lobby' ? 0.5 : 1, cursor: deliveryMethod === 'lobby' ? 'not-allowed' : 'pointer' }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: paymentMethod === 'on_delivery' ? '#10b981' : 'transparent', border: '2px solid', borderColor: paymentMethod === 'on_delivery' ? '#10b981' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {paymentMethod === 'on_delivery' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text-primary)' }}>Pagamento na Entrega</span>
                    <span style={{ fontSize: 11, color: deliveryMethod === 'lobby' ? '#ef4444' : 'var(--text-secondary)', marginTop: 2 }}>
                      {deliveryMethod === 'lobby' ? 'Indisponível para entrega na portaria' : 'Pague com cartão ou dinheiro ao receber'}
                    </span>
                  </div>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 14, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981' }}>
                  <Lock size={12} /> <span style={{ fontSize: 10.5, fontWeight: 700 }}>Pagamento Seguro</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981' }}>
                  <ShieldCheck size={12} /> <span style={{ fontSize: 10.5, fontWeight: 700 }}>Dados Criptografados</span>
                </div>
              </div>

              <div className="commerce-btn-row" style={{ marginTop: 10 }}>
                <button type="button" onClick={() => setStep('delivery')} disabled={loading} className="commerce-btn-secondary" style={{ flex: 1 }}>
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button type="button" onClick={() => void handleFinish()} disabled={loading} className={`commerce-btn-primary ${loading ? 'is-loading' : ''}`} style={{ flex: 2 }}>
                  {loading ? (
                    'Finalizando seu pedido...'
                  ) : (
                    <>
                      <ShieldCheck size={17} />
                      <span>Confirmar e Finalizar</span>
                      <span className="commerce-btn-badge">R$ {previewTotal.toFixed(2)}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && confirmedOrder && (
            <div style={{ textAlign: 'center', padding: '20px 8px' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <CheckCircle size={40} color="#10b981" />
              </div>
              <h2 style={{ color: 'var(--text-primary)', marginBottom: 5, fontWeight: 800, fontSize: 19, letterSpacing: '-0.3px' }}>Pedido Criado com Sucesso! 🎉</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 14, fontSize: 13 }}>
                Seu pedido <strong>#{confirmedOrder.orderNumber}</strong> foi gravado no sistema.
                Total: <strong>R$ {confirmedOrder.total.toFixed(2)}</strong>
              </p>

              {/* Payment countdown or On Delivery badge */}
              {confirmedOrder.paymentStatus === 'approved' ? (
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '14px', marginBottom: 14, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#10b981', marginBottom: 6 }}>
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
                  <h3 style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10, fontWeight: 800 }}>Dados da Chave Pix</h3>
                  
                  <div style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: 8, textAlign: 'left', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Chave Pix:</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{adminConfig.pixKey}</div>
                    
                    {adminConfig.pixName && (
                      <>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, marginBottom: 4 }}>Nome do Recebedor:</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{adminConfig.pixName}</div>
                      </>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(adminConfig.pixKey); toastSuccess('Copiado!', 'Chave Pix copiada'); }}
                    className="commerce-btn-dashed"
                    style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: '#10b981', borderStyle: 'solid' }}
                  >
                    Copiar Chave Pix
                  </button>
                </div>
              )}

              <button type="button" onClick={() => navigate('/orders')} className="commerce-btn-primary" style={{ width: '100%', marginBottom: 10 }}>
                <span>Acompanhar Meus Pedidos</span>
                <ChevronRight size={17} />
              </button>
              <button type="button" onClick={() => navigate('/')} className="commerce-btn-secondary" style={{ width: '100%' }}>
                <span>Voltar para a Loja</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
