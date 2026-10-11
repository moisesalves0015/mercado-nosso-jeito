import admin from 'firebase-admin';
import { defaultProducts } from '../src/data/defaultProducts';
import { validateProducts } from './validate-products';

// Initialize Firebase Admin
if (!admin.apps.length) {
  // If GOOGLE_APPLICATION_CREDENTIALS or application default is set, use it;
  // otherwise, default to the projectId
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'nosso-mercado-4b877';
  admin.initializeApp({
    projectId,
  });
}

const db = admin.firestore();

export const INITIAL_SHIPPING_CONFIG = {
  freeShippingThreshold: 60.00,
  baseShippingFee: 5.00,
  condos: {
    'Condomínio Vitória': 0.00,
    'Residencial Flores': 5.90,
    'Spazio Di Fiori': 4.50,
    'Parque das Árvores': 5.00,
    'Portal dos Pássaros': 0.00,
  },
  condosList: [
    { name: 'Condomínio Vitória', fee: 0.00 },
    { name: 'Residencial Flores', fee: 5.90 },
    { name: 'Spazio Di Fiori', fee: 4.50 },
    { name: 'Parque das Árvores', fee: 5.00 },
    { name: 'Portal dos Pássaros', fee: 0.00 },
  ],
  updatedAt: new Date().toISOString(),
};

export const INITIAL_COUPONS = [
  {
    code: 'BEMVINDO10',
    type: 'percentage',
    value: 0.10, // 10%
    active: true,
    minOrderValue: 30.00,
    maxUses: 500,
    usesCount: 0,
    description: '10% de desconto para novos clientes em pedidos acima de R$ 30,00',
    createdAt: new Date().toISOString(),
  },
  {
    code: 'FRETEGRATIS',
    type: 'fixed',
    value: 5.00, // Abate taxa de entrega base
    active: true,
    minOrderValue: 40.00,
    maxUses: 1000,
    usesCount: 0,
    description: 'R$ 5,00 de desconto no frete para pedidos a partir de R$ 40,00',
    createdAt: new Date().toISOString(),
  },
  {
    code: 'NOSSOJEITO5',
    type: 'fixed',
    value: 5.00, // R$ 5 fixo
    active: true,
    minOrderValue: 25.00,
    maxUses: 200,
    usesCount: 0,
    description: 'R$ 5,00 de desconto promocional',
    createdAt: new Date().toISOString(),
  },
];

async function seedData() {
  console.log('--- INICIANDO SEED IDEMPOTENTE DO FIREBASE ---');

  // 1. Validar produtos antes de gravar
  const validation = validateProducts(defaultProducts);
  if (!validation.valid) {
    console.error('❌ Validação de produtos falhou! Abortando importação.');
    console.table(validation.errors);
    process.exit(1);
  }
  console.log(`✅ Validação aprovada: ${validation.total} produtos íntegros.`);

  // 2. Importar produtos de forma idempotente em batches
  console.log(`📦 Importando ${defaultProducts.length} produtos para a coleção /products...`);
  const productsCol = db.collection('products');
  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  for (const prod of defaultProducts) {
    const docRef = productsCol.doc(prod.id);
    const dataToSave: Record<string, unknown> = {
      title: prod.title,
      price: prod.price,
      stock: prod.stock,
      active: prod.active,
      image: prod.image,
      category: prod.category,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (prod.description) dataToSave.description = prod.description;
    if (prod.costPrice !== undefined) dataToSave.costPrice = prod.costPrice;
    if (prod.badge) dataToSave.badge = prod.badge;
    if (prod.badgeStyle) dataToSave.badgeStyle = prod.badgeStyle;
    if (prod.diamondReward !== undefined) dataToSave.diamondReward = prod.diamondReward;
    if (prod.minStock !== undefined) dataToSave.minStock = prod.minStock;
    if (prod.tags) dataToSave.tags = prod.tags;
    if (prod.promoActive !== undefined) dataToSave.promoActive = prod.promoActive;
    if (prod.promoPrice !== undefined) dataToSave.promoPrice = prod.promoPrice;
    if (prod.availableInRoulette !== undefined) dataToSave.availableInRoulette = prod.availableInRoulette;

    batch.set(docRef, dataToSave, { merge: true });
    count++;

    if (count % 400 === 0) {
      await batch.commit();
      batchCount++;
      console.log(`  -> Batch ${batchCount} commitado (${count}/${defaultProducts.length})`);
      batch = db.batch();
    }
  }

  if (count % 400 !== 0) {
    await batch.commit();
    batchCount++;
    console.log(`  -> Batch final ${batchCount} commitado (${count}/${defaultProducts.length})`);
  }
  console.log(`✅ ${count} produtos gravados/atualizados com sucesso.`);

  // 3. Popular /settings/shipping e /configs/shipping
  console.log('🚚 Gravando configurações de frete em /settings/shipping e /configs/shipping...');
  await Promise.all([
    db.collection('settings').doc('shipping').set(INITIAL_SHIPPING_CONFIG, { merge: true }),
    db.collection('configs').doc('shipping').set(INITIAL_SHIPPING_CONFIG, { merge: true }),
  ]);
  console.log('✅ Configurações de frete e condomínios salvas com sucesso.');

  // 4. Popular cupons iniciais
  console.log('🎟️ Gravando cupons iniciais em /coupons...');
  for (const coupon of INITIAL_COUPONS) {
    await db.collection('coupons').doc(coupon.code).set(coupon, { merge: true });
  }
  console.log(`✅ ${INITIAL_COUPONS.length} cupons cadastrados.`);

  console.log('\n🎉 SEED DE DADOS FINALIZADO COM SUCESSO!');
}

seedData().catch((err) => {
  console.error('❌ Erro durante a execução do seed:', err);
  process.exit(1);
});
