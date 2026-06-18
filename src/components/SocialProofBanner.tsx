import { useState, useEffect } from 'react';
import { useCommunityPresence } from '../hooks/useCommunityPresence';

export function SocialProofBanner() {
  const { getSocialProof } = useCommunityPresence();
  const [visible, setVisible] = useState(true);
  const [current, setCurrent] = useState(getSocialProof());

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrent(getSocialProof());
        setVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(interval);
  }, [getSocialProof]);

  return (
    <div
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
        transition: 'opacity 0.4s ease',
        opacity: visible ? 1 : 0,
      }}
    >
      {/* Pulsing live dot */}
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#4ade80',
          boxShadow: '0 0 6px rgba(74,222,128,0.8)',
          flexShrink: 0,
          animation: 'spLivePulse 2s ease-in-out infinite',
        }}
      />
      <span style={{ fontSize: '13px', lineHeight: 1 }}>{current.emoji}</span>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.75)',
          lineHeight: 1.3,
        }}
      >
        {current.text}
      </span>
    </div>
  );
}
