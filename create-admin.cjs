/**
 * Script para criar documento admin no Firestore via REST API
 * Uso: node create-admin.cjs <email> <senha>
 * Exemplo: node create-admin.cjs meu@email.com minhasenha123
 */
const https = require('https');

const API_KEY = 'AIzaSyDymI1qb9b2NOpZElTWsV-SzXB_54fLtjw';
const PROJECT_ID = 'nosso-mercado-4b877';

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('❌ Uso: node create-admin.cjs <email> <senha>');
  console.log('   Exemplo: node create-admin.cjs meu@email.com minhasenha123');
  process.exit(1);
}

function postJSON(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        const parsed = JSON.parse(responseData);
        if (res.statusCode >= 400) reject(parsed);
        else resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function patchJSON(url, data, idToken) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${idToken}`,
      },
    };
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        const parsed = JSON.parse(responseData);
        if (res.statusCode >= 400) reject(parsed);
        else resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log(`\n🔐 Fazendo login como: ${email}`);

  // Step 1: Sign in to get ID token
  let authData;
  try {
    authData = await postJSON(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      { email, password, returnSecureToken: true }
    );
  } catch (err) {
    console.error('❌ Erro no login:', err.error?.message || err);
    process.exit(1);
  }

  const { idToken, localId: uid } = authData;
  console.log(`✅ Login OK! UID: ${uid}`);

  // Step 2: Write user doc to Firestore with role: admin
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  const docBody = {
    fields: {
      name:      { stringValue: email.split('@')[0] },
      email:     { stringValue: email },
      role:      { stringValue: 'admin' },
      createdAt: { timestampValue: new Date().toISOString() },
    }
  };

  console.log('\n📝 Criando documento no Firestore com role: admin...');
  try {
    const result = await patchJSON(firestoreUrl, docBody, idToken);
    console.log('✅ Documento criado com sucesso!');
    console.log('   Caminho:', result.name);
    console.log('\n🎉 Pronto! Volte ao aplicativo, faça login, e você terá acesso ao painel Admin.');
  } catch (err) {
    console.error('❌ Erro ao criar documento no Firestore:');
    console.error(JSON.stringify(err, null, 2));
    console.log('\n💡 Dica: Verifique se as Regras do Firestore estão publicadas com:');
    console.log('   allow read, write: if request.auth != null;');
  }
}

main();
