import React, { useState } from 'react';
import { useHomeConfig } from '../hooks/useHomeConfig';
import { Layers, Clock, Zap, Target, Plus, Trash2, Edit2 } from 'lucide-react';

export const AdminMarketing: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'vitrines' | 'periodos' | 'megaOfertas' | 'campanhas'>('vitrines');
  const homeConfig = useHomeConfig();

  const SubTabBtn = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveSubTab(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
        borderRadius: 8, border: 'none', cursor: 'pointer',
        background: activeSubTab === id ? 'rgba(212,175,55,0.1)' : 'transparent',
        color: activeSubTab === id ? '#D4AF37' : 'rgba(255,255,255,0.5)',
        fontWeight: 800, fontSize: 13,
      }}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Sub tabs nav */}
      <div style={{ display: 'flex', gap: 10, background: 'rgba(15,23,42,0.5)', padding: 8, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
        <SubTabBtn id="vitrines" label="Vitrines" icon={Layers} />
        <SubTabBtn id="periodos" label="Períodos" icon={Clock} />
        <SubTabBtn id="megaOfertas" label="Mega Ofertas" icon={Zap} />
        <SubTabBtn id="campanhas" label="Campanhas" icon={Target} />
      </div>

      <div style={{ background: 'rgba(15,23,42,0.5)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
        {activeSubTab === 'vitrines' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Gerenciar Vitrines</h3>
              <button style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <Plus size={16} /> Nova Vitrine
              </button>
            </div>
            {homeConfig.loading ? <p>Carregando...</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {homeConfig.vitrines.length === 0 && <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhuma vitrine configurada no Firestore. (Usando fallback na Home)</p>}
                {homeConfig.vitrines.map(v => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px', color: '#fff' }}>{v.title}</h4>
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Tema: {v.theme} • {v.productIds.length} produtos</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, padding: 6, cursor: 'pointer' }}><Edit2 size={14} /></button>
                      <button style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 6, padding: 6, cursor: 'pointer' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'periodos' && (
          <div>
            <h3 style={{ margin: '0 0 20px', color: '#fff' }}>Produtos por Período</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Configure os produtos exibidos em cada horário do dia.</p>
            {/* Lista dos periodos (morning, lunch, afternoon, night, dawn) */}
          </div>
        )}

        {activeSubTab === 'megaOfertas' && (
          <div>
            <h3 style={{ margin: '0 0 20px', color: '#fff' }}>Mega Ofertas</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Configure as super promoções exibidas no topo.</p>
          </div>
        )}

        {activeSubTab === 'campanhas' && (
          <div>
            <h3 style={{ margin: '0 0 20px', color: '#fff' }}>Campanhas (Em Breve)</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Sistema de campanhas temporárias sendo desenvolvido.</p>
          </div>
        )}
      </div>
    </div>
  );
};
