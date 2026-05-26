const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'Admin.tsx');
let code = fs.readFileSync(file, 'utf8');

// 1. Imports
code = code.replace(
  /import \{ collection, getDocs, doc, updateDoc, query, orderBy, setDoc, getDoc \} from 'firebase\/firestore';/,
  "import { collection, getDocs, doc, updateDoc, query, orderBy, setDoc, getDoc, onSnapshot, deleteDoc } from 'firebase/firestore';"
);

// 2. Remove Wizard State (from `const [isProductModalOpen...` to `const [finSimUnits...`)
code = code.replace(
  /const \[isProductModalOpen[\s\S]*?\/\/ Financial simulator/,
  `// Financial simulator`
);

// 3. Replace useEffect for localStorage
code = code.replace(
  /\/\/ ─── Load from localStorage ──────────────[\s\S]*?const fetchClients = async/m,
  `// ─── Load from Firestore ───────────────────────────────────────────────
  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'products'), async (snap) => {
      if (snap.empty) {
        const stored = localStorage.getItem('app-products');
        if (stored) {
          const arr = JSON.parse(stored);
          for (const p of arr) {
            try { await setDoc(doc(db, 'products', p.id), p); } catch(e){}
          }
        }
      }
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubO = onSnapshot(collection(db, 'orders'), async (snap) => {
      if (snap.empty) {
        const stored = localStorage.getItem('app-orders');
        if (stored) {
          const arr = JSON.parse(stored);
          for (const o of arr) {
            try { await setDoc(doc(db, 'orders', o.id), o); } catch(e){}
          }
        }
      }
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });

    return () => { unsubP(); unsubO(); };
  }, []);

  const fetchClients = async`
);

// 4. Remove localStorage helpers and wizard helpers
code = code.replace(
  /\/\/ ─── Persist ─────────────[\s\S]*?\/\/ ─── Computed ──────────────/m,
  `const handleLogout = async () => { try { await logout(); navigate('/login'); } catch (e) { console.error(e); } };

  const handleDeleteProduct = async (id: string) => { 
    if (window.confirm('Excluir produto?')) {
      await deleteDoc(doc(db, 'products', id));
    }
  };
  
  const toggleProductActive = async (id: string, active: boolean) => {
    await updateDoc(doc(db, 'products', id), { active: !active });
  };
  
  const updateOrderStatus = async (id: string, status: Order['status']) => {
    await updateDoc(doc(db, 'orders', id), { status });
    if (selectedOrder?.id === id) setSelectedOrder({ ...selectedOrder, status });
  };

  const promoteToAdmin = async (client: FirestoreClient) => {
    if (!window.confirm(\`Promover \${client.name} a administrador?\`)) return;
    try { await updateDoc(doc(db, 'users', client.id), { role: 'admin' }); setClients(prev => prev.map(c => c.id === client.id ? { ...c, role: 'admin' } : c)); }
    catch { alert('Erro ao promover usuário.'); }
  };
  const banClient = async (client: FirestoreClient) => {
    if (!window.confirm(\`Banir \${client.name}?\`)) return;
    try { await updateDoc(doc(db, 'users', client.id), { role: 'banned' }); setClients(prev => prev.map(c => c.id === client.id ? { ...c, role: 'banned' } : c)); }
    catch { alert('Erro ao banir.'); }
  };
  const handleAwardDiamonds = async () => {
    if (!selectedClient) return;
    const amount = parseInt(awardAmount);
    if (isNaN(amount) || amount <= 0) { alert('Quantidade inválida.'); return; }
    try {
      const newTotal = (selectedClient.diamonds || 0) + amount;
      await updateDoc(doc(db, 'users', selectedClient.id), { diamonds: newTotal });
      setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, diamonds: newTotal } : c));
      setIsAwardModalOpen(false); alert(\`✅ \${amount} 💎 creditados para \${selectedClient.name}!\`);
    } catch { alert('Erro ao conceder diamantes.'); }
  };

  // Roulette
  const handleSaveRoulette = async () => {
    if (rouletteItems.length < 2) { alert('A roleta precisa de no mínimo 2 itens.'); return; }
    setSavingRoulette(true);
    try { await setDoc(doc(db, 'configs', 'roulette'), { items: rouletteItems, updatedAt: new Date().toISOString() }); alert('Roleta salva! 🎉'); }
    catch (e: any) { alert('Erro: ' + e.message); }
    finally { setSavingRoulette(false); }
  };
  const handleAddRouletteItem = () => {
    const text = newRouletteText.trim(); if (!text) return;
    const prob = parseFloat(newRouletteProbability) || 0;
    const colors = ['#D4AF37', '#1E150F', '#E25C1D', '#5B21B6', '#059669'];
    setRouletteItems([...rouletteItems, { text, color: colors[rouletteItems.length % colors.length], probability: prob }]);
    setNewRouletteText(''); setNewRouletteProbability('10');
  };
  const handleRemoveRouletteItem = (i: number) => setRouletteItems(rouletteItems.filter((_, idx) => idx !== i));
  const moveRouletteItem = (i: number, dir: 'up' | 'down') => {
    const next = dir === 'up' ? i - 1 : i + 1;
    if (next < 0 || next >= rouletteItems.length) return;
    const upd = [...rouletteItems]; [upd[i], upd[next]] = [upd[next], upd[i]]; setRouletteItems(upd);
  };

  // ─── Computed ──────────────`
);

// 5. Remove Wizard Calcs
code = code.replace(
  /\/\/ Wizard live calcs[\s\S]*?\/\/ ─── Styles ────────/m,
  `// ─── Styles ────────`
);

// 6. Update Navigate commands
code = code.replace(/onClick=\{openAddModal\}/g, "onClick={() => navigate('/admin/produto/novo')}");
code = code.replace(/onClick=\{\(\) => openEditModal\(p\)\}/g, "onClick={() => navigate('/admin/produto/' + p.id)}");
code = code.replace(/toggleProductActive\(p\.id\)/g, "toggleProductActive(p.id, p.active !== false)");

// 7. Remove the Product Wizard JSX block
code = code.replace(
  /\{\/\* ═══ MODAL: PRODUCT WIZARD ════[\s\S]*?\}\(\)\)}/,
  `{/* PRODUCT WIZARD DELETED - Using dedicated page /admin/produto/:id */}`
);

fs.writeFileSync(file, code);
console.log('Admin.tsx updated!');
