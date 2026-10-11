import { useState } from 'react';

export function AgeVerificationModal() {
  const [isOpen, setIsOpen] = useState(() => {
    return !localStorage.getItem('age_verified');
  });

  const handleConfirm = () => {
    localStorage.setItem('age_verified', 'true');
    setIsOpen(false);
  };

  const handleDecline = () => {
    window.location.href = 'https://www.google.com';
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface, #1a1a1a)', padding: '30px', borderRadius: '16px',
        textAlign: 'center', maxWidth: '400px', width: '100%',
        border: '1px solid var(--border-gold, #D4AF37)',
        fontFamily: "'Manrope','Outfit',sans-serif",
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        <h2 style={{ color: 'var(--text-primary, #fff)', marginBottom: '15px', fontSize: '22px' }}>
          Você tem mais de 18 anos?
        </h2>
        <p style={{ color: 'var(--text-secondary, #aaa)', marginBottom: '20px', fontSize: '15px', lineHeight: '1.5' }}>
          Devido à venda de bebidas alcoólicas e tabacaria, precisamos confirmar sua idade.
          <br /><br />
          <strong style={{ color: 'var(--text-primary, #fff)' }}>
            O produto só poderá ser entregue a um maior de idade com documento com foto.
          </strong>
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={handleConfirm}
            style={{
              padding: '15px', borderRadius: '8px', border: 'none',
              background: 'var(--accent, #D4AF37)', color: '#000',
              fontWeight: 'bold', fontSize: '16px', cursor: 'pointer'
            }}
          >
            Sim, tenho mais de 18 anos
          </button>
          <button 
            onClick={handleDecline}
            style={{
              padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color, #333)',
              background: 'transparent', color: 'var(--text-secondary, #aaa)',
              fontWeight: 'bold', fontSize: '16px', cursor: 'pointer'
            }}
          >
            Não tenho
          </button>
        </div>
      </div>
    </div>
  );
}
