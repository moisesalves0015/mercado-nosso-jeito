import { CheckCircle2, Truck } from 'lucide-react';

export const Orders = () => {
  return (
    <main className="app orders-page">
      <div className="topbar" style={{ justifyContent: 'center' }}>
        <h2 style={{ color: '#E7BC79', fontSize: '18px' }}>Meus Pedidos</h2>
      </div>

      <div style={{ padding: '16px', paddingBottom: '100px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: '#D4C2A7' }}>Pedido #4928</span>
            <span style={{ fontSize: '12px', color: '#F4D7A5', fontWeight: 'bold' }}>Hoje, 14:30</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
            <div className="circle-btn" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Truck size={20} color="#E7BC79" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '4px' }}>Saindo para entrega</h3>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Previsão: 15:00 - 15:30</p>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#fff' }}>Total: R$ 84,50</span>
            <button style={{ background: 'transparent', border: 'none', color: '#E7BC79', fontWeight: 'bold' }}>Acompanhar</button>
          </div>
        </div>

        <h3 style={{ marginTop: '16px', color: '#E7BC79', fontSize: '14px' }}>Anteriores</h3>

        <div className="glass-panel" style={{ opacity: 0.85 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: '#D4C2A7' }}>Pedido #4811</span>
            <span style={{ fontSize: '12px', color: '#D4C2A7' }}>12/05/2026</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
            <div className="circle-btn" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <CheckCircle2 size={20} color="#4ade80" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '4px' }}>Entregue</h3>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>8 itens</p>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#fff' }}>Total: R$ 124,90</span>
            <button style={{ background: 'transparent', border: 'none', color: '#E7BC79', fontWeight: 'bold' }}>Repetir</button>
          </div>
        </div>

      </div>
    </main>
  );
};
