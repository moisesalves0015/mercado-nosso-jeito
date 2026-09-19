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
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
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
