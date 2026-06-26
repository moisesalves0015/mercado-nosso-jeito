import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle, ArrowLeft, ChevronDown, ChevronUp, MessageCircle,
  Phone, Mail, FileText, ShoppingBag, Truck, CreditCard,
  Shield, ChevronRight, ExternalLink, Clock,
  Zap, Star, Send, Check, X, Bot,
} from 'lucide-react';
import { MercadoLogo, AuthBackground, AuthStyles } from './Login';
import { useToast } from '../contexts/ToastContext';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

type ContactType = 'chat' | 'email' | 'phone' | 'whatsapp';

// ──────────────────────────────────────────────────────────────
// Design tokens
// ──────────────────────────────────────────────────────────────
const card = {
  background: 'var(--card-gradient)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid var(--border-gold)',
  borderRadius: '20px',
  boxShadow: 'var(--card-shadow)',
};

// ──────────────────────────────────────────────────────────────
// FAQ data
// ──────────────────────────────────────────────────────────────
const FAQ_DATA: FAQ[] = [
  // Pedidos
  {
    id: 'p1', category: 'Pedidos',
    question: 'Como acompanho meu pedido?',
    answer: 'Acesse "Meus Pedidos" no menu da sua conta. Lá você encontrará o status em tempo real, desde a confirmação até a entrega na sua porta.',
  },
  {
    id: 'p2', category: 'Pedidos',
    question: 'Posso cancelar ou alterar um pedido?',
    answer: 'Pedidos podem ser cancelados em até 5 minutos após a confirmação, diretamente na tela de detalhes do pedido. Após esse período, entre em contato com nosso suporte.',
  },
  {
    id: 'p3', category: 'Pedidos',
    question: 'Qual é o prazo mínimo e máximo de entrega?',
    answer: 'O prazo varia conforme o endereço. Em geral, entregamos em 30 a 90 minutos para a região central. Regiões mais distantes podem levar até 3 horas. O prazo exato é exibido antes de você confirmar o pedido.',
  },
  // Pagamento
  {
    id: 'pg1', category: 'Pagamento',
    question: 'Quais formas de pagamento são aceitas?',
    answer: 'Aceitamos cartões de crédito e débito (Visa, Mastercard, Elo, American Express), Pix, dinheiro na entrega e vale-alimentação (VR, Alelo, Ticket). Pagamentos por cartão são processados com segurança na entrega.',
  },
  {
    id: 'pg2', category: 'Pagamento',
    question: 'O pagamento por Pix é seguro?',
    answer: 'Sim. Geramos uma chave Pix exclusiva para cada pedido. O pagamento é confirmado automaticamente em até 60 segundos. Nunca compartilhe comprovantes com terceiros.',
  },
  {
    id: 'pg3', category: 'Pagamento',
    question: 'Recebi um produto errado, como solicito reembolso?',
    answer: 'Entre em contato pelo chat ou WhatsApp em até 24 horas com a foto do produto recebido. Processamos o reembolso em até 3 dias úteis para Pix e até 15 dias para cartão.',
  },
  // Entrega
  {
    id: 'e1', category: 'Entrega',
    question: 'Como funciona a entrega grátis?',
    answer: 'A entrega é gratuita para compras acima de R$ 120,00 na área central de cobertura. O valor mínimo pode variar por região. O valor da entrega (quando aplicável) é sempre exibido antes de confirmar o pedido.',
  },
  {
    id: 'e2', category: 'Entrega',
    question: 'O entregador pode subir até minha porta?',
    answer: 'Sim, nossos entregadores realizam a entrega diretamente no seu apartamento ou casa. Em edifícios com restrição de acesso, a entrega é realizada na portaria.',
  },
  // Produtos
  {
    id: 'pr1', category: 'Produtos',
    question: 'Os produtos são os mesmos da loja física?',
    answer: 'Sim! Nosso estoque online é sincronizado com a loja física. Em casos raros de divergência, o entregador poderá oferecer uma substituição similar, que você pode aceitar ou recusar.',
  },
  {
    id: 'pr2', category: 'Produtos',
    question: 'Como reporto um produto vencido ou com defeito?',
    answer: 'Fotografe o produto antes de abrir. Acesse "Meus Pedidos", selecione o pedido e clique em "Reportar problema". Nossa equipe analisa em até 2 horas e providencia a substituição ou reembolso.',
  },
  // Conta
  {
    id: 'c1', category: 'Conta',
    question: 'Como altero meus dados cadastrais?',
    answer: 'Acesse "Minha Conta" no menu de perfil. Clique no ícone de edição para alterar nome e telefone. O e-mail só pode ser alterado via suporte por questões de segurança.',
  },
  {
    id: 'c2', category: 'Conta',
    question: 'Esqueci minha senha, o que faço?',
    answer: 'Na tela de login, clique em "Esqueceu a senha?". Enviaremos um link de redefinição para o e-mail cadastrado. O link expira em 1 hora.',
  },
];

// ──────────────────────────────────────────────────────────────
// Categories
// ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'Todos', icon: <HelpCircle size={14} />, color: '#D4AF37' },
  { key: 'Pedidos', icon: <ShoppingBag size={14} />, color: '#10B981' },
  { key: 'Pagamento', icon: <CreditCard size={14} />, color: '#6366F1' },
  { key: 'Entrega', icon: <Truck size={14} />, color: '#F59E0B' },
  { key: 'Produtos', icon: <Star size={14} />, color: '#EC4899' },
  { key: 'Conta', icon: <Shield size={14} />, color: '#06B6D4' },
];

// ──────────────────────────────────────────────────────────────
// Contact channels
// ──────────────────────────────────────────────────────────────
const CONTACTS: {
  type: ContactType;
  title: string;
  subtitle: string;
  available: boolean;
  waitTime?: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  action: () => void;
}[] = [
  {
    type: 'whatsapp', title: 'WhatsApp', subtitle: 'Resposta em minutos',
    available: true, waitTime: '~5 min',
    icon: <MessageCircle size={18} />, color: '#25D366', bg: 'rgba(37,211,102,0.1)',
    action: () => window.open('https://wa.me/5500000000000?text=Olá! Preciso de ajuda com meu pedido.', '_blank'),
  },
  {
    type: 'chat', title: 'Chat ao vivo', subtitle: 'Seg–Sex 8h às 22h',
    available: true, waitTime: '~2 min',
    icon: <Bot size={18} />, color: '#6366F1', bg: 'rgba(99,102,241,0.1)',
    action: () => {},
  },
  {
    type: 'email', title: 'E-mail', subtitle: 'Resposta em até 24h',
    available: true,
    icon: <Mail size={18} />, color: '#D4AF37', bg: 'rgba(212,175,55,0.1)',
    action: () => window.open('mailto:suporte@mercadonossojeito.com.br', '_blank'),
  },
  {
    type: 'phone', title: 'Telefone', subtitle: 'Seg–Sex 8h às 18h',
    available: false,
    icon: <Phone size={18} />, color: '#10B981', bg: 'rgba(16,185,129,0.1)',
    action: () => window.open('tel:+5500000000000', '_blank'),
  },
];

// ──────────────────────────────────────────────────────────────
// FAQ Accordion
// ──────────────────────────────────────────────────────────────
const FAQItem: React.FC<{ faq: FAQ }> = ({ faq }) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      borderBottom: '1px solid var(--border-primary)',
      transition: 'all 0.2s ease',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="help-faq-btn"
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '14px 0', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '12px', fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, color: open ? '#D4AF37' : 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>
          {faq.question}
        </span>
        <div style={{
          width: 24, height: 24, borderRadius: '8px', flexShrink: 0,
          background: open ? 'rgba(212,175,55,0.12)' : 'var(--input-bg)',
          border: `1px solid ${open ? 'rgba(212,175,55,0.3)' : 'var(--border-primary)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: open ? '#D4AF37' : 'var(--text-muted)',
          transition: 'all 0.25s ease',
        }}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>
      {open && (
        <div style={{
          paddingBottom: '14px',
          animation: 'helpFadeDown 0.2s ease',
        }}>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {faq.answer}
          </p>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Contact Card
// ──────────────────────────────────────────────────────────────
const ContactCard: React.FC<typeof CONTACTS[0]> = ({ title, subtitle, available, waitTime, icon, color, bg, action }) => (
  <button
    onClick={action}
    disabled={!available}
    className="help-contact-btn"
    style={{
      background: 'var(--card-gradient)', backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      border: available ? `1px solid ${color}30` : '1px solid var(--border-primary)',
      borderRadius: '16px', padding: '14px',
      cursor: available ? 'pointer' : 'default',
      display: 'flex', alignItems: 'center', gap: '12px',
      width: '100%', textAlign: 'left', fontFamily: 'inherit',
      opacity: available ? 1 : 0.5,
      boxShadow: 'var(--card-shadow)', transition: 'all 0.2s ease',
    }}
  >
    {/* Icon */}
    <div style={{
      width: 44, height: 44, borderRadius: '13px', flexShrink: 0,
      background: available ? bg : 'var(--input-bg)',
      border: `1px solid ${available ? color + '25' : 'var(--border-primary)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: available ? color : 'var(--text-muted)',
    }}>
      {icon}
    </div>

    {/* Info */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 800, color: available ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {title}
        </span>
        {available && (
          <span style={{
            fontSize: '8.5px', fontWeight: 800,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
            color: '#10B981', borderRadius: '99px', padding: '2px 6px',
          }}>Online</span>
        )}
        {!available && (
          <span style={{
            fontSize: '8.5px', fontWeight: 800,
            background: 'var(--input-bg)', border: '1px solid var(--border-primary)',
            color: 'var(--text-muted)', borderRadius: '99px', padding: '2px 6px',
          }}>Offline</span>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{subtitle}</div>
      {waitTime && available && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
          <Clock size={9} color="#D4AF37" />
          <span style={{ fontSize: '9.5px', color: '#D4AF37', fontWeight: 700 }}>Espera {waitTime}</span>
        </div>
      )}
    </div>

    {/* Arrow */}
    <ChevronRight size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
  </button>
);

// ──────────────────────────────────────────────────────────────
// Feedback form
// ──────────────────────────────────────────────────────────────
const FeedbackForm: React.FC = () => {
  const { success } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handle = async () => {
    if (rating === 0) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    setSending(false);
    setSent(true);
    success('Obrigado!', 'Seu feedback foi enviado com sucesso.');
  };

  if (sent) {
    return (
      <div style={{ ...card, padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Check size={22} color="#10B981" />
        </div>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Feedback enviado!</div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Sua avaliação nos ajuda a melhorar.</div>
      </div>
    );
  }

  return (
    <div style={{ ...card, padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Star size={14} color="#D4AF37" />
        <span style={{ fontSize: '12px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Avaliar o suporte
        </span>
      </div>

      {/* Stars */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(i)}
            className="help-star-btn"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
              fontSize: '28px', transition: 'transform 0.15s ease',
              transform: (hover >= i || rating >= i) ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            <Star
              size={30}
              fill={(hover >= i || rating >= i) ? '#D4AF37' : 'transparent'}
              color={(hover >= i || rating >= i) ? '#D4AF37' : 'var(--border-primary)'}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      {rating > 0 && (
        <div style={{ marginBottom: '12px', animation: 'helpFadeDown 0.2s ease' }}>
          <div style={{ fontSize: '10.5px', textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            {['', 'Muito ruim 😞', 'Ruim 😕', 'Regular 😐', 'Bom 🙂', 'Excelente! 🎉'][rating]}
          </div>
          <textarea
            placeholder="Conte-nos mais (opcional)..."
            value={msg}
            onChange={e => setMsg(e.target.value)}
            rows={3}
            className="help-textarea"
            style={{
              width: '100%', background: 'var(--input-bg)',
              border: '1px solid var(--input-border)', borderRadius: '11px',
              padding: '10px 12px', color: 'var(--text-primary)', fontSize: '12.5px',
              outline: 'none', fontFamily: 'inherit', resize: 'none',
              boxSizing: 'border-box', lineHeight: 1.5,
            }}
          />
        </div>
      )}

      <button
        onClick={handle}
        disabled={rating === 0 || sending}
        className="help-send-btn"
        style={{
          width: '100%', height: '44px',
          background: rating > 0 ? 'linear-gradient(135deg, #D4AF37, #FFDF73)' : 'var(--input-bg)',
          border: rating > 0 ? 'none' : '1px solid var(--border-primary)',
          borderRadius: '12px', cursor: rating > 0 ? 'pointer' : 'default',
          color: rating > 0 ? '#000' : 'var(--text-muted)',
          fontWeight: 800, fontSize: '13px', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          transition: 'all 0.2s ease',
          opacity: sending ? 0.7 : 1,
        }}
      >
        {sending
          ? <><span className="help-spinner" /> Enviando...</>
          : <><Send size={14} /> Enviar avaliação</>
        }
      </button>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────
export const Support: React.FC = () => {
  const navigate = useNavigate();
  const [faqCategory, setFaqCategory] = useState('Todos');
  const [faqSearch, setFaqSearch] = useState('');

  const filteredFAQ = FAQ_DATA.filter(f => {
    const matchCat = faqCategory === 'Todos' || f.category === faqCategory;
    const matchQ = !faqSearch.trim() || f.question.toLowerCase().includes(faqSearch.toLowerCase()) || f.answer.toLowerCase().includes(faqSearch.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Manrope','Outfit',sans-serif" }}>
      <AuthBackground />
      <AuthStyles />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: '110px' }}>

        {/* ── Topbar ─────────────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--bg-secondary)', backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px',
          }}>
            <button onClick={() => navigate(-1)} className="help-back-btn" style={{
              background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)',
              borderRadius: '50%', width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-primary)',
            }}>
              <ArrowLeft size={18} />
            </button>
            <MercadoLogo size="sm" />
            <div style={{ width: 38 }} />
          </div>
        </div>

        {/* ── Hero ───────────────────────────────────────────── */}
        <div style={{ padding: '18px 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '10px',
              background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HelpCircle size={16} color="#D4AF37" />
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
              Ajuda e Suporte
            </h1>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 0 42px', fontWeight: 600 }}>
            Como podemos ajudá-lo hoje?
          </p>
        </div>

        <div style={{ padding: '0 16px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* ── Quick stats ──────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { icon: <Clock size={16} />, color: '#10B981', bg: 'rgba(16,185,129,0.1)', label: 'Tempo médio', value: '5 min' },
              { icon: <Zap size={16} />,   color: '#D4AF37', bg: 'rgba(212,175,55,0.1)', label: 'Resoluções', value: '98%' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '11px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>{s.value}</div>
                  <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Contact channels ─────────────────────────────── */}
          <div style={{ ...card, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <MessageCircle size={14} color="#D4AF37" />
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Falar com suporte
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {CONTACTS.map(c => <ContactCard key={c.type} {...c} />)}
            </div>
          </div>

          {/* ── FAQ ──────────────────────────────────────────── */}
          <div style={{ ...card, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <HelpCircle size={14} color="#D4AF37" />
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Perguntas frequentes
              </span>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <HelpCircle size={12} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#D4AF37', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Buscar nas dúvidas..."
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                className="help-input"
                style={{
                  width: '100%', height: '38px',
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: '10px', padding: '0 32px',
                  color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              {faqSearch && (
                <button onClick={() => setFaqSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 2 }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Category chips */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px', scrollbarWidth: 'none' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setFaqCategory(cat.key)}
                  className="help-cat-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                    background: faqCategory === cat.key ? `rgba(212,175,55,0.15)` : 'var(--input-bg)',
                    border: `1px solid ${faqCategory === cat.key ? 'rgba(212,175,55,0.45)' : 'var(--border-primary)'}`,
                    borderRadius: '99px', padding: '5px 11px',
                    fontSize: '10.5px', fontWeight: 700,
                    color: faqCategory === cat.key ? '#D4AF37' : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ color: faqCategory === cat.key ? cat.color : 'var(--text-muted)' }}>{cat.icon}</span>
                  {cat.key}
                </button>
              ))}
            </div>

            {/* FAQ items */}
            {filteredFAQ.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                Nenhuma dúvida encontrada. Tente o suporte ao vivo.
              </div>
            ) : (
              filteredFAQ.map(f => <FAQItem key={f.id} faq={f} />)
            )}
          </div>

          {/* ── Feedback ─────────────────────────────────────── */}
          <FeedbackForm />

          {/* ── Quick links ──────────────────────────────────── */}
          <div style={{ ...card, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <FileText size={14} color="#D4AF37" />
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Links úteis
              </span>
            </div>
            {[
              { label: 'Política de Privacidade', href: '#' },
              { label: 'Termos de Uso', href: '#' },
              { label: 'Política de Troca e Devolução', href: '#' },
              { label: 'Área de Cobertura', href: '#' },
            ].map((l, i, arr) => (
              <a
                key={l.label}
                href={l.href}
                className="help-link"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 0', textDecoration: 'none',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border-primary)' : 'none',
                }}
              >
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{l.label}</span>
                <ExternalLink size={13} color="var(--text-muted)" />
              </a>
            ))}
          </div>

          {/* Version */}
          <div style={{ textAlign: 'center', padding: '4px 0 8px', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600 }}>
            Mercado Nosso Jeito v2.0 · Suporte disponível 7 dias por semana
          </div>
        </div>
      </div>

      <SupportStyles />
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────
const SupportStyles: React.FC = () => (
  <style>{`
    @keyframes helpFadeDown { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
    @keyframes helpSpin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
    .help-spinner {
      display: inline-block; width: 14px; height: 14px;
      border: 2px solid rgba(0,0,0,0.15); border-top-color: currentColor;
      border-radius: 50%; animation: helpSpin 0.7s linear infinite;
    }
    .help-input:focus {
      border-color: rgba(212,175,55,0.4) !important;
      box-shadow: 0 0 0 3px rgba(212,175,55,0.07) !important;
      background: var(--input-bg) !important;
    }
    .help-input::placeholder { color: var(--text-muted); }
    .help-textarea:focus {
      border-color: rgba(212,175,55,0.4) !important;
      box-shadow: 0 0 0 3px rgba(212,175,55,0.07) !important;
      background: var(--input-bg) !important;
    }
    .help-textarea::placeholder { color: var(--text-muted); }
    .help-faq-btn:hover { opacity: 0.85; }
    .help-contact-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--card-shadow) !important; }
    .help-send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(212,175,55,0.4) !important; }
    .help-back-btn:hover { background: var(--back-btn-bg) !important; opacity: 0.9; }
    .help-link:hover span { color: #D4AF37 !important; }
    .help-star-btn:hover { transform: scale(1.1); }
    .help-cat-btn:hover { opacity: 0.85; }
  `}</style>
);
