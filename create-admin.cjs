/**
 * @deprecated
 * ─────────────────────────────────────────────────────────────────────────────
 * ATENÇÃO: Este script foi DEPRECIADO e NUNCA DEVE SER EXECUTADO.
 *
 * Problemas de segurança desta versão:
 *   1. A API key do Firebase estava hardcoded no código-fonte — qualquer pessoa
 *      com acesso ao repositório podia extraí-la.
 *   2. A senha do usuário era passada como argumento de linha de comando,
 *      ficando exposta no histórico do shell e nos logs do sistema.
 *   3. O processo autenticava como o próprio usuário-alvo (não como Admin)
 *      para escrever role: 'admin' — dependia de regras Firestore permissivas.
 *
 * Use o substituto seguro:
 *   node scripts/set-admin.js promote <uid>
 *
 * Veja scripts/set-admin.js para instruções completas.
 * ─────────────────────────────────────────────────────────────────────────────
 */
console.error(`
❌ create-admin.cjs foi DEPRECIADO por razões de segurança.

   Use o substituto seguro:

     node scripts/set-admin.js promote <uid>

   Para descobrir o UID de um usuário:
     - Acesse console.firebase.google.com → Authentication → Users
     - Copie o UID do usuário desejado

   Para executar o script:
     export GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/service-account.json
     node scripts/set-admin.js promote <uid>
`);
process.exit(1);
