# Mercado Nosso Jeito

Aplicativo 100% digital para um supermercado com foco em entregas em condomínios.

## Funcionalidades
- **Checkout seguro**: Integração com Firebase Cloud Functions para pedidos, onde o backend verifica estoque, recalcula preços autoritativos e gera a chave de idempotência.
- **Painel Administrativo**: Protegido por Firebase Custom Claims (`admin: true`), o que substitui a checagem manual de `role` na tabela de usuários. 
- **Clube de Fidelidade (Roleta)**: Distribuicão de diamantes e moedas garantida via Cloud Functions atômicas.
- **Performance / Code-Splitting**: Uso de `React.lazy()` para isolar páginas pesadas (Admin, Clube) via chunks configurados no Vite.

## Requisitos de Ambiente

- **Node.js** v20+
- **Firebase CLI** (`npm install -g firebase-tools`)
- Variáveis de ambiente configuradas no `.env` (ex: `VITE_PAYMENT_MODE=demo`).

## Como rodar localmente

1. Clone o repositório e instale as dependências:
   ```bash
   npm install
   npm --prefix functions install
   ```

2. Inicie o servidor frontend:
   ```bash
   npm run dev
   ```

3. Configure o Firebase Local Emulator Suite (opcional mas recomendado para testar Cloud Functions):
   ```bash
   firebase emulators:start
   ```

## Acesso Administrativo

Para criar o primeiro usuário admin, crie uma conta comum pelo app e depois rode o script seguro no servidor/local:

```bash
# Certifique-se de exportar suas credenciais do Admin SDK:
export GOOGLE_APPLICATION_CREDENTIALS="/caminho/para/sua/chave-de-servico.json"

# Defina a claim de admin no seu usuário
node scripts/set-admin.js <UID_DO_USUARIO>
```

> **Aviso:** O script antigo `create-admin.cjs` foi depreciado pois incluía chaves estáticas inseguras no código. 

## Segurança (Firestore Rules)

As regras de segurança ( `firestore.rules` ) agora bloqueiam criações de clientes nas coleções de `/orders` e `/products`. Tudo deve passar pelo backend em `functions/src/index.ts`.

Para executar a suite de testes locais das regras:
```bash
npm run test:rules
```
*(Certifique-se de que o Firebase Local Emulator Suite está configurado corretamente no seu projeto, pois o Jest usará a suite `@firebase/rules-unit-testing`.)*

## Deploy 

O Frontend utiliza o Vercel / Firebase Hosting e o Backend as Firebase Cloud Functions (Node 20).

```bash
# Frontend
npm run build
firebase deploy --only hosting

# Backend (Functions e Regras)
npm --prefix functions run build
firebase deploy --only functions,firestore:rules
```
