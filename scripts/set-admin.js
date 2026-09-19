#!/usr/bin/env node
/**
 * set-admin.js — Define Custom Claims admin no Firebase via Admin SDK.
 *
 * Pré-requisitos:
 *   - GOOGLE_APPLICATION_CREDENTIALS aponta para uma service account JSON com
 *     permissões de Firebase Admin (ou o script roda em um ambiente GCP autenticado).
 *   - Node.js >= 16
 *
 * Uso:
 *   Promover:   node scripts/set-admin.js promote <uid>
 *   Revogar:    node scripts/set-admin.js revoke  <uid>
 *
 * Exemplos:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json node scripts/set-admin.js promote abc123uid
 *
 * ATENÇÃO:
 *   - Nunca passe senhas como argumentos de linha de comando.
 *   - Para descobrir o UID de um usuário, use o console do Firebase Authentication.
 *   - Após a promoção, o usuário deve fazer logout e login novamente (ou aguardar
 *     a expiração natural do token, geralmente 1 hora) para o claim entrar em vigor.
 */

import admin from 'firebase-admin';

const [, , action, uid] = process.argv;

const VALID_ACTIONS = ['promote', 'revoke'];

if (!VALID_ACTIONS.includes(action) || !uid || uid.trim().length === 0) {
  console.error(`
❌ Uso incorreto.

  node scripts/set-admin.js promote <uid>   — concede admin
  node scripts/set-admin.js revoke  <uid>   — revoga admin

Exemplos:
  node scripts/set-admin.js promote abc123uid
  node scripts/set-admin.js revoke  abc123uid
`);
  process.exit(1);
}

const makeAdmin = action === 'promote';

// Initialize Admin SDK — reads GOOGLE_APPLICATION_CREDENTIALS from env.
if (!admin.apps.length) {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentials) {
    console.error(`
❌ GOOGLE_APPLICATION_CREDENTIALS não definido.

Exporte a variável antes de executar o script:
  export GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/service-account.json
  node scripts/set-admin.js ${action} ${uid}
`);
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

const auth = admin.auth();
const firestore = admin.firestore();

async function run() {
  // Validate that the user exists
  let userRecord;
  try {
    userRecord = await auth.getUser(uid.trim());
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Usuário não encontrado (uid=${uid}): ${errMsg}`);
    process.exit(1);
  }

  const displayName = userRecord.displayName ?? userRecord.email ?? uid;

  // Set Custom Claim
  await auth.setCustomUserClaims(uid.trim(), { admin: makeAdmin });
  console.log(`✅ Custom Claim definido: admin=${String(makeAdmin)} para "${displayName}" (${uid})`);

  // Sync role field in Firestore for backward compatibility
  try {
    await firestore.collection('users').doc(uid.trim()).update({
      role: makeAdmin ? 'admin' : 'client',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Campo role atualizado no Firestore: "${makeAdmin ? 'admin' : 'client'}"`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️  Não foi possível atualizar o campo role no Firestore: ${errMsg}`);
    console.warn('   O Custom Claim foi definido corretamente. O role no Firestore é opcional.');
  }

  console.log(`
📋 Próximos passos:
   1. O usuário deve fazer logout e login novamente para que o novo claim entre em vigor.
   2. Ou, no app, chame: firebase.auth().currentUser?.getIdToken(true)

${makeAdmin ? '🔐 Acesso admin concedido!' : '🔓 Acesso admin revogado.'}
`);
}

run().catch((err) => {
  console.error('❌ Erro inesperado:', err);
  process.exit(1);
});
