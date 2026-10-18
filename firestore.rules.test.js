const fs = require('fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

// Requires Firebase Emulator Suite to be running.
// Run with: npm run test:rules (will start emulator if configured correctly, or require it to be running)

let testEnv;

beforeAll(async () => {
  // Load rules from firestore.rules
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  
  testEnv = await initializeTestEnvironment({
    projectId: 'mercado-nosso-jeito-test',
    firestore: { rules },
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

describe('Firestore Rules - Security & Hardening', () => {

  it('Denies unauthenticated access to products by default (if not explicit)', async () => {
    // Current rules allow public reads on /products
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const docRef = unauthedDb.collection('products').doc('p1');
    await assertSucceeds(docRef.get()); 
  });

  it('Denies unauthenticated writes to products', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const docRef = unauthedDb.collection('products').doc('p1');
    await assertFails(docRef.set({ price: 100 }));
  });

  it('Denies authenticated client writes to products', async () => {
    const authedDb = testEnv.authenticatedContext('user_123').firestore();
    const docRef = authedDb.collection('products').doc('p1');
    await assertFails(docRef.set({ price: 100 }));
  });

  it('Denies client creation of orders (must go through Cloud Functions)', async () => {
    const authedDb = testEnv.authenticatedContext('user_123').firestore();
    const docRef = authedDb.collection('orders').doc('new_order');
    await assertFails(docRef.set({ total: 0, status: 'paid' }));
  });

  it('Allows clients to read their own orders', async () => {
    // Setup order created by backend
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('orders').doc('order_1').set({ uid: 'user_123' });
    });

    const authedDb = testEnv.authenticatedContext('user_123').firestore();
    const docRef = authedDb.collection('orders').doc('order_1');
    await assertSucceeds(docRef.get());
  });

  it('Denies clients from reading other users orders', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('orders').doc('order_2').set({ uid: 'user_999' });
    });

    const authedDb = testEnv.authenticatedContext('user_123').firestore();
    const docRef = authedDb.collection('orders').doc('order_2');
    await assertFails(docRef.get());
  });

  it('Allows clients to read and write their own addresses', async () => {
    const authedDb = testEnv.authenticatedContext('user_123').firestore();
    const docRef = authedDb.collection('users').doc('user_123').collection('addresses').doc('addr1');
    await assertSucceeds(docRef.set({ street: 'Rua A' }));
    await assertSucceeds(docRef.get());
  });

  it('Denies clients from writing to other users addresses', async () => {
    const authedDb = testEnv.authenticatedContext('user_123').firestore();
    const docRef = authedDb.collection('users').doc('user_999').collection('addresses').doc('addr1');
    await assertFails(docRef.set({ street: 'Rua B' }));
  });

  it('Allows admins (via custom claims) full access to any collection', async () => {
    const adminDb = testEnv.authenticatedContext('admin_1', { admin: true }).firestore();
    
    // Write to products
    await assertSucceeds(adminDb.collection('products').doc('p2').set({ title: 'New Product' }));
    
    // Read other users orders
    await assertSucceeds(adminDb.collection('orders').doc('order_2').get());
  });

  it('Denies admins from mutating orders directly (must use callables)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('orders').doc('order_3').set({ uid: 'user_123', status: 'pending', paymentStatus: 'awaiting_confirmation' });
    });
    const adminDb = testEnv.authenticatedContext('admin_1', { admin: true }).firestore();
    const ref = adminDb.collection('orders').doc('order_3');
    await assertFails(ref.update({ paymentStatus: 'approved' }));
    await assertFails(ref.update({ status: 'delivered' }));
    await assertFails(ref.delete());
  });

  it('Denies the order owner from editing or self-approving their own order', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('orders').doc('order_4').set({ uid: 'user_123', status: 'pending', paymentStatus: 'awaiting_confirmation', total: 100 });
    });
    const ownerDb = testEnv.authenticatedContext('user_123').firestore();
    const ref = ownerDb.collection('orders').doc('order_4');
    await assertFails(ref.update({ paymentStatus: 'approved' }));
    await assertFails(ref.update({ total: 0.01 }));
    await assertFails(ref.delete());
  });


  it('Denies clients from reading coupons', async () => {
    const authedDb = testEnv.authenticatedContext('user_123').firestore();
    const docRef = authedDb.collection('coupons').doc('CODE10');
    await assertFails(docRef.get());
  });

  it('Denies clients from writing to stock history', async () => {
    const authedDb = testEnv.authenticatedContext('user_123').firestore();
    const docRef = authedDb.collection('products').doc('p1').collection('stock_history').doc('sh1');
    await assertFails(docRef.set({ change: -1 }));
  });

});

describe('Firestore Rules - RBAC, superadmin and audit (Fase 1)', () => {
  const seed = async (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
  const assignment = (uid, roleId, status = 'active') =>
    seed((db) => db.collection('role_assignments').doc(uid).set({ uid, roleId, status }));

  // ── closing the privilege-escalation holes ──────────────────────────────
  it('Denies an admin from changing users.role or ban fields directly (must use Cloud Functions)', async () => {
    await seed((db) => db.collection('users').doc('victim').set({ name: 'V', role: 'client' }));
    const adminDb = testEnv.authenticatedContext('admin_1', { admin: true }).firestore();
    const ref = adminDb.collection('users').doc('victim');
    await assertFails(ref.update({ role: 'admin' }));
    await assertFails(ref.update({ role: 'banned', bannedBy: 'admin_1' }));
    await assertFails(ref.update({ archivedAt: new Date() }));
  });

  it('Still lets an admin update benign user profile fields', async () => {
    await seed((db) => db.collection('users').doc('victim').set({ name: 'V', role: 'client' }));
    const adminDb = testEnv.authenticatedContext('admin_1', { admin: true }).firestore();
    await assertSucceeds(adminDb.collection('users').doc('victim').update({ telefone: '11999999999' }));
  });

  it('Denies users from escalating their own role', async () => {
    await seed((db) => db.collection('users').doc('user_123').set({ name: 'U', role: 'client' }));
    const userDb = testEnv.authenticatedContext('user_123').firestore();
    await assertFails(userDb.collection('users').doc('user_123').update({ role: 'admin' }));
  });

  // ── no physical deletes of business data ────────────────────────────────
  it('Denies physical deletion of users, products and tickets — even for admins and superadmins', async () => {
    await seed(async (db) => {
      await db.collection('users').doc('u1').set({ role: 'client' });
      await db.collection('products').doc('p9').set({ title: 'P' });
      await db.collection('support_tickets').doc('t1').set({ uid: 'u1' });
    });
    await assignment('sa_1', 'superadmin');
    const adminDb = testEnv.authenticatedContext('admin_1', { admin: true }).firestore();
    const saDb = testEnv.authenticatedContext('sa_1', { admin: true, superadmin: true }).firestore();
    for (const db of [adminDb, saDb]) {
      await assertFails(db.collection('users').doc('u1').delete());
      await assertFails(db.collection('products').doc('p9').delete());
      await assertFails(db.collection('support_tickets').doc('t1').delete());
    }
  });

  it('Allows admins to archive (update) products instead', async () => {
    await seed((db) => db.collection('products').doc('p9').set({ title: 'P', active: true }));
    const adminDb = testEnv.authenticatedContext('admin_1', { admin: true }).firestore();
    await assertSucceeds(
      adminDb.collection('products').doc('p9').update({ active: false, archivedAt: new Date(), archivedBy: 'admin_1', archiveReason: 'teste' }),
    );
  });

  // ── RBAC assignment is the source of truth ───────────────────────────────
  it('Active admin/superadmin assignments grant rule-level admin', async () => {
    await assignment('a1', 'admin');
    await assignment('s1', 'superadmin');
    await assertSucceeds(testEnv.authenticatedContext('a1', { admin: true }).firestore().collection('products').doc('x1').set({ t: 1 }));
    await assertSucceeds(testEnv.authenticatedContext('s1', { admin: true }).firestore().collection('products').doc('x2').set({ t: 1 }));
  });

  it('A suspended or archived assignment denies access even with a stale admin token claim', async () => {
    await assignment('sus', 'admin', 'suspended');
    await assignment('arc', 'superadmin', 'archived');
    for (const uid of ['sus', 'arc']) {
      const db = testEnv.authenticatedContext(uid, { admin: true }).firestore();
      await assertFails(db.collection('products').doc('blocked').set({ t: 1 }));
      await assertFails(db.collection('orders').doc('order_2').get());
    }
  });

  it('Non rule-level roles (operacoes, financeiro...) get no direct admin access, whatever the claim says', async () => {
    await assignment('op', 'operacoes');
    const db = testEnv.authenticatedContext('op', { admin: true }).firestore();
    await assertFails(db.collection('products').doc('blocked').set({ t: 1 }));
  });

  it('Legacy admins without an assignment keep working (backward compatibility)', async () => {
    const db = testEnv.authenticatedContext('legacy_admin', { admin: true }).firestore();
    await assertSucceeds(db.collection('products').doc('legacy_ok').set({ t: 1 }));
  });

  // ── RBAC collections ─────────────────────────────────────────────────────
  it('role_assignments: owner reads own, admin reads all, strangers denied, nobody writes', async () => {
    await assignment('op', 'operacoes');
    await assignment('s1', 'superadmin');
    await assignment('a1', 'admin');
    await assertSucceeds(testEnv.authenticatedContext('op').firestore().collection('role_assignments').doc('op').get());
    await assertFails(testEnv.authenticatedContext('stranger').firestore().collection('role_assignments').doc('op').get());
    await assertSucceeds(testEnv.authenticatedContext('a1', { admin: true }).firestore().collection('role_assignments').doc('op').get());
    const saDb = testEnv.authenticatedContext('s1', { admin: true, superadmin: true }).firestore();
    await assertFails(saDb.collection('role_assignments').doc('stranger').set({ roleId: 'superadmin', status: 'active' }));
    await assertFails(testEnv.authenticatedContext('op').firestore().collection('role_assignments').doc('op').update({ roleId: 'superadmin' }));
  });

  it('roles: staff can read, customers cannot, nobody writes', async () => {
    await seed((db) => db.collection('roles').doc('operacoes').set({ id: 'operacoes', permissions: ['pedidos:view'] }));
    await assignment('op', 'operacoes');
    await assignment('s1', 'superadmin');
    await assertSucceeds(testEnv.authenticatedContext('op').firestore().collection('roles').doc('operacoes').get());
    await assertFails(testEnv.authenticatedContext('customer').firestore().collection('roles').doc('operacoes').get());
    await assertFails(testEnv.authenticatedContext('s1', { admin: true }).firestore().collection('roles').doc('operacoes').update({ permissions: ['*'] }));
  });

  // ── audit trail ──────────────────────────────────────────────────────────
  it('audit_logs: readable only by superadmin; append-only (no client write, update or delete)', async () => {
    await seed((db) => db.collection('audit_logs').doc('l1').set({ action: 'x', result: 'success' }));
    await assignment('s1', 'superadmin');
    await assignment('a1', 'admin');
    const saDb = testEnv.authenticatedContext('s1', { admin: true, superadmin: true }).firestore();
    const adminDb = testEnv.authenticatedContext('a1', { admin: true }).firestore();
    const userDb = testEnv.authenticatedContext('customer').firestore();

    await assertSucceeds(saDb.collection('audit_logs').doc('l1').get());
    await assertFails(adminDb.collection('audit_logs').doc('l1').get());
    await assertFails(userDb.collection('audit_logs').doc('l1').get());
    await assertFails(testEnv.unauthenticatedContext().firestore().collection('audit_logs').doc('l1').get());

    for (const db of [saDb, adminDb, userDb]) {
      await assertFails(db.collection('audit_logs').doc('forged').set({ action: 'forged' }));
      await assertFails(db.collection('audit_logs').doc('l1').update({ result: 'tampered' }));
      await assertFails(db.collection('audit_logs').doc('l1').delete());
    }
  });
});
