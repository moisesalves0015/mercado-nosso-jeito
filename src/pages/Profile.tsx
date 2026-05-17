import { User, MapPin, CreditCard, Ticket, HelpCircle, LogOut, ChevronRight } from 'lucide-react';

export const Profile = () => {
  const menuItems = [
    { icon: <MapPin size={20} />, label: "Meus Endereços" },
    { icon: <CreditCard size={20} />, label: "Formas de Pagamento" },
    { icon: <Ticket size={20} />, label: "Cupons e Descontos" },
    { icon: <HelpCircle size={20} />, label: "Ajuda e Suporte" },
  ];

  return (
    <main className="app profile-page">
      <div className="topbar" style={{ justifyContent: 'center' }}>
        <h2 style={{ color: '#E7BC79', fontSize: '18px' }}>Perfil</h2>
      </div>

      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        
        {/* User Info */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '32px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={32} color="#E7BC79" />
          </div>
          <div>
            <h3 style={{ fontSize: '20px', color: '#fff', marginBottom: '4px' }}>João Silva</h3>
            <p style={{ fontSize: '14px', color: '#D4C2A7' }}>joao.silva@email.com</p>
          </div>
        </div>

        {/* Menu Items */}
        <div className="glass-panel" style={{ padding: '8px 20px' }}>
          {menuItems.map((item, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '16px 0',
              borderBottom: index < menuItems.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
              cursor: 'pointer'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#fff' }}>
                <span style={{ color: '#E7BC79' }}>{item.icon}</span>
                <span style={{ fontSize: '16px' }}>{item.label}</span>
              </div>
              <ChevronRight size={20} color="rgba(255,255,255,0.4)" />
            </div>
          ))}
        </div>

        {/* Logout */}
        <div className="glass-panel" style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', justifyContent: 'center', cursor: 'pointer' }}>
          <LogOut size={20} />
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Sair da conta</span>
        </div>

      </div>
    </main>
  );
};
