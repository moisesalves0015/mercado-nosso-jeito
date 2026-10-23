import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface SocialProofMessage {
  emoji: string;
  text: string;
}

/**
 * Mensagens EDITORIAIS (texto institucional fixo, sem números).
 * Enquanto não existirem métricas reais de pedidos/moradores/entregas no backend, o banner não
 * pode afirmar quantidades. Quando houver agregação real, passe `messages` por prop.
 */
const EDITORIAL_MESSAGES: SocialProofMessage[] = [
  { emoji: '🏢', text: 'Compre pelo app e receba direto no seu condomínio.' },
  { emoji: '💎', text: 'No Clube, suas compras rendem diamantes.' },
  { emoji: '🔥', text: 'Confira as mega ofertas selecionadas pela nossa equipe.' },
  { emoji: '☕', text: 'Veja os mais pedidos de cada horário do dia.' },
];

const ROTATE_MS = 8000;
const FADE_MS = 400;

export function SocialProofBanner({ messages = EDITORIAL_MESSAGES }: { messages?: SocialProofMessage[] }) {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (messages.length <= 1 || reducedMotion) return;
    let swap: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      setVisible(false);
      swap = setTimeout(() => {
        setIndex(prev => (prev + 1) % messages.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => {
      clearInterval(interval);
      if (swap) clearTimeout(swap);
    };
  }, [messages.length, reducedMotion]);

  if (messages.length === 0) return null;
  const current = messages[index % messages.length];

  return (
    <div
      role="note"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        margin: '0 0 8px',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: '10px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
        transition: reducedMotion ? 'none' : 'opacity 0.4s ease',
        opacity: visible ? 1 : 0,
      }}
    >
      {/* Ponto decorativo (sem animação se o usuário prefere menos movimento) */}
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#4ade80',
          boxShadow: '0 0 6px rgba(74,222,128,0.8)',
          flexShrink: 0,
          animation: reducedMotion ? 'none' : 'spLivePulse 2s ease-in-out infinite',
        }}
      />
      <span aria-hidden="true" style={{ fontSize: '13px', lineHeight: 1 }}>{current.emoji}</span>
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>
        {current.text}
      </span>
    </div>
  );
}
