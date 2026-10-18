import admin from 'firebase-admin';
import { defaultProducts } from '../src/data/defaultProducts';
import { validateProducts } from './validate-products';

/**
 * Seed / importação inicial do catálogo e configuração.
 *
 * SEGURO POR PADRÃO:
 *  - Sem --apply roda em DRY-RUN: valida e mostra o que faria, sem gravar nada.
 *  - --project <id> é OBRIGATÓRIO (sem projeto padrão silencioso).
 *  - Produtos existentes NUNCA têm o estoque sobrescrito (use --reset-stock apenas em
 *    ambiente sem vendas, e informe --i-know-this-resets-stock).
 *  - Frete e cupons só são criados se ainda não existirem; contadores (usesCount)
 *    e configuração real nunca são alterados.
 *
 * Uso:
 *   npm run seed -- --project nosso-mercado-4b877            # dry-run
 *   npm run seed -- --project nosso-mercado-4b877 --apply    # grava
 */

export const INITIAL_SHIPPING_CONFIG = {
  freeShippingThreshold: 60.0,
  baseShippingFee: 5.0,
  condos: {
    'Condomínio Vitória': 0.0,
    'Residencial Flores': 5.9,
    'Spazio Di Fiori': 4.5,
    'Parque das Árvores': 5.0,
    'Portal dos Pássaros': 0.0,
  },
  condosList: [
    { name: 'Condomínio Vitória', fee: 0.0 },
    { name: 'Residencial Flores', fee: 5.9 },
    { name: 'Spazio Di Fiori', fee: 4.5 },
    { name: 'Parque das Árvores', fee: 5.0 },
    { name: 'Portal dos Pássaros', fee: 0.0 },
  ],
};

export const INITIAL_COUPONS = [
  {
    code: 'BEMVINDO10',
    type: 'percentage',
    value: 0.1,
    active: true,
    minOrderValue: 30.0,
    maxUses: 500,
    description: '10% de desconto para novos clientes em pedidos acima de R$ 30,00',
  },
  {
    code: 'FRETEGRATIS',
    type: 'fixed',
    value: 5.0,
    active: true,
    minOrderValue: 40.0,
    maxUses: 1000,
    description: 'R$ 5,00 de desconto no frete para pedidos a partir de R$ 40,00',
  },
  {
    code: 'NOSSOJEITO5',
    type: 'fixed',
    value: 5.0,
    active: true,
    minOrderValue: 25.0,
    maxUses: 200,
    description: 'R$ 5,00 de desconto promocional',
  },
];

interface Options {
  projectId: string;
  apply: boolean;
  resetStock: boolean;
  updateExisting: boolean;
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const projectId = get('--project');
  if (!projectId || projectId.startsWith('--')) {
    console.error('❌ Informe o projeto de destino: --project <firebase-project-id>');
    process.exit(1);
  }
  const resetStock = argv.includes('--reset-stock');
  const updateExisting = argv.includes('--update-existing');
  if (resetStock && !updateExisting) {
    console.error('❌ --reset-stock requer a flag --update-existing para alterar produtos já cadastrados no Firestore.');
    process.exit(1);
  }
  if (resetStock && !argv.includes('--i-know-this-resets-stock')) {
    console.error('❌ --reset-stock sobrescreve o estoque de produtos existentes.');
    console.error('   Confirme com --i-know-this-resets-stock (apenas em ambiente SEM vendas).');
    process.exit(1);
  }
  return { projectId, apply: argv.includes('--apply'), resetStock, updateExisting };
}

async function seedData(opts: Options) {
  const mode = opts.apply ? 'APPLY (GRAVANDO)' : 'DRY-RUN (nada será gravado)';
  console.log(`--- SEED FIREBASE | projeto: ${opts.projectId} | modo: ${mode} ---`);
  if (!opts.updateExisting) {
    console.log('ℹ️  Modo seguro: produtos existentes NÃO serão modificados (use --update-existing para forçar atualização).');
  }

  const validation = validateProducts(defaultProducts);
  if (!validation.valid) {
    console.error('❌ Validação de produtos falhou! Abortando importação.');
    console.table(validation.errors);
    process.exit(1);
  }
  console.log(`✅ Validação aprovada: ${validation.total} produtos íntegros.`);

  admin.initializeApp({ projectId: opts.projectId });
  const db = admin.firestore();

  // 1. Produtos
  const productsCol = db.collection('products');
  const existingSnaps = await db.getAll(...defaultProducts.map((p) => productsCol.doc(p.id)));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let stockKept = 0;

  let batch = db.batch();
  let pending = 0;
  for (let i = 0; i < defaultProducts.length; i++) {
    const prod = defaultProducts[i];
    const exists = existingSnaps[i].exists;

    if (exists && !opts.updateExisting) {
      skipped++;
      continue;
    }

    const data: Record<string, unknown> = {
      title: prod.title,
      price: prod.price,
      active: prod.active,
      image: prod.image,
      category: prod.category,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!exists || opts.resetStock) {
      data.stock = prod.stock;
    } else {
      stockKept++;
    }
    if (prod.description) data.description = prod.description;
    if (prod.costPrice !== undefined) data.costPrice = prod.costPrice;
    if (prod.badge) data.badge = prod.badge;
    if (prod.badgeStyle) data.badgeStyle = prod.badgeStyle;
    if (prod.diamondReward !== undefined) data.diamondReward = prod.diamondReward;
    if (prod.minStock !== undefined) data.minStock = prod.minStock;
    if (prod.tags) data.tags = prod.tags;
    if (prod.promoActive !== undefined) data.promoActive = prod.promoActive;
    if (prod.promoPrice !== undefined) data.promoPrice = prod.promoPrice;
    if (prod.availableInRoulette !== undefined) data.availableInRoulette = prod.availableInRoulette;

    if (exists) updated++;
    else created++;

    if (opts.apply) {
      batch.set(productsCol.doc(prod.id), data, { merge: true });
      if (++pending === 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
  }
  if (opts.apply && pending > 0) await batch.commit();
  console.log(
    `📦 Produtos: ${created} a criar, ${updated} a atualizar, ${skipped} mantidos intactos (não modificados), estoque preservado em ${stockKept}.`,
  );

  // 2. Frete — só cria se não existir (nunca sobrescreve configuração real)
  for (const path of [['settings', 'shipping'], ['configs', 'shipping']] as const) {
    const ref = db.collection(path[0]).doc(path[1]);
    const snap = await ref.get();
    if (snap.exists) {
      console.log(`🚚 /${path.join('/')} já existe — mantido sem alterações.`);
    } else {
      console.log(`🚚 /${path.join('/')} ${opts.apply ? 'criado' : 'seria criado'}.`);
      if (opts.apply) {
        await ref.set({ ...INITIAL_SHIPPING_CONFIG, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
  }

  // 3. Cupons — só cria os ausentes; usesCount nunca é tocado em existentes
  for (const { code, ...rest } of INITIAL_COUPONS) {
    const ref = db.collection('coupons').doc(code);
    const snap = await ref.get();
    if (snap.exists) {
      console.log(`🎟️  ${code} já existe — mantido (usesCount preservado: ${String(snap.data()?.usesCount ?? 0)}).`);
    } else {
      console.log(`🎟️  ${code} ${opts.apply ? 'criado' : 'seria criado'}.`);
      if (opts.apply) {
        await ref.set({ code, ...rest, usesCount: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
  }

  console.log(opts.apply ? '\n🎉 SEED FINALIZADO.' : '\nℹ️  Dry-run concluído. Reexecute com --apply para gravar.');
}

seedData(parseArgs(process.argv.slice(2))).catch((err) => {
  console.error('❌ Erro durante a execução do seed:', err);
  process.exit(1);
});
