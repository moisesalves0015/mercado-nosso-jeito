import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Gem, Plus, Trash2 } from 'lucide-react';

export const AdminClube: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'missoes' | 'recompensas' | 'config'>('missoes');

  // Mocks/State for Admin Collections
  const [missions, setMissions] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'daily_missions'), snap => {
      setMissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(collection(db, 'diamond_rewards'), snap => {
      setRewards(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleAddMission = async () => {
    const title = prompt('Título da missão:');
    const reward = parseInt(prompt('Recompensa (diamantes):') || '0');
    if (!title || reward <= 0) return;

    const id = Date.now().toString();
    await setDoc(doc(db, 'daily_missions', id), {
      title, reward, type: 'custom', is_active: true, created_at: new Date().toISOString()
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a' }}>
        <Gem color="#D4AF37" /> Administração do Clube de Diamantes
      </h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
        Gerencie missões, recompensas e configurações do programa de fidelidade.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => setActiveTab('missoes')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: activeTab === 'missoes' ? '#4f46e5' : '#e2e8f0', color: activeTab === 'missoes' ? '#fff' : '#0f172a', fontWeight: 'bold', cursor: 'pointer' }}>Missões Diárias</button>
        <button onClick={() => setActiveTab('recompensas')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: activeTab === 'recompensas' ? '#4f46e5' : '#e2e8f0', color: activeTab === 'recompensas' ? '#fff' : '#0f172a', fontWeight: 'bold', cursor: 'pointer' }}>Troca de Diamantes</button>
        <button onClick={() => setActiveTab('config')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: activeTab === 'config' ? '#4f46e5' : '#e2e8f0', color: activeTab === 'config' ? '#fff' : '#0f172a', fontWeight: 'bold', cursor: 'pointer' }}>Configurações Gerais</button>
      </div>

      {activeTab === 'missoes' && (
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3>Missões Cadastradas</h3>
            <button onClick={handleAddMission} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}><Plus size={16} /> Nova Missão</button>
          </div>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: 12 }}>ID</th>
                <th>Título</th>
                <th>Recompensa</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {missions.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Nenhuma missão encontrada. Crie a primeira!</td></tr>
              )}
              {missions.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 12, fontSize: 12, color: '#94a3b8' }}>{m.id}</td>
                  <td style={{ fontWeight: 'bold', color: '#0f172a' }}>{m.title}</td>
                  <td style={{ color: '#D4AF37', fontWeight: 'bold' }}>💎 {m.reward}</td>
                  <td>{m.is_active ? <span style={{ color: '#10b981', background: '#d1fae5', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold' }}>Ativo</span> : <span style={{ color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold' }}>Inativo</span>}</td>
                  <td style={{ display: 'flex', gap: 8, padding: 12 }}>
                    <button onClick={async () => { if(window.confirm('Excluir?')) await deleteDoc(doc(db, 'daily_missions', m.id)) }} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: 6, borderRadius: 6, cursor: 'pointer' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'recompensas' && (
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3>Produtos e Cupons para Troca</h3>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}><Plus size={16} /> Novo Item</button>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>Aqui você cadastrará itens para a tabela `diamond_rewards`. Eles aparecerão no Modal de Troca no frontend.</p>
          {rewards.length > 0 && (
            <ul style={{ paddingLeft: 20, color: '#334155', fontSize: 13 }}>
              {rewards.map(r => (
                <li key={r.id} style={{ marginBottom: 6 }}>
                  <strong>{r.title}</strong> - {r.cost} 💎
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <h3>Regras de Negócio e Travas</h3>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Configurações atreladas à coleção `club_settings` no banco.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b' }}>Check-in Dia 7 (Diamantes)</label>
              <input type="number" defaultValue={50} style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }} />
            </div>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b' }}>Limite de Giros Premium por Dia</label>
              <input type="number" defaultValue={10} style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }} />
            </div>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b' }}>Recompensa de Indicação Aprovada</label>
              <input type="number" defaultValue={80} style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }} />
            </div>
          </div>
          <button style={{ marginTop: 20, background: '#4f46e5', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Salvar Configurações</button>
        </div>
      )}
    </div>
  );
};
