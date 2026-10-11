# Runbook de Operação, Release e Rollback — MVP

Este documento define o plano operacional para o **lançamento piloto**, procedimentos de **rollback**, papéis de plantão e o checklist final para abertura ao público.

---

## 1. Arquitetura de Publicação e Rota Única

| Componente | Provedor / Serviço | Responsabilidade |
| :--- | :--- | :--- |
| **Frontend SPA** | **Vercel** (ou Firebase Hosting) | Entrega estática com cabeçalhos de segurança (`vercel.json`), SPA fallback e cache de assets. |
| **Backend & Callables** | **Firebase Cloud Functions (us-central1)** | Regras de negócio, transações, idempotência e geração de pedidos autoritativos. |
| **Banco de Dados** | **Cloud Firestore** | Dados persistentes protegidos por `firestore.rules` e `firestore.indexes.json`. |
| **Arquivos & Mídia** | **Firebase Storage** (se habilitado) | Imagens de comprovantes e uploads protegidos por `storage.rules`. |

### Gerenciamento de Variáveis e Segredos
- **Frontend (Vercel):** As variáveis `VITE_FIREBASE_*` e `VITE_ENV` devem ser configuradas exclusivamente no painel do Vercel (**Settings > Environment Variables**) para cada ambiente (*Preview/Staging* e *Production*). **Nunca versionar arquivos `.env` com chaves reais.**
- **Backend (Firebase/Google Cloud):** Chaves de API de terceiros, webhooks e credenciais de serviço devem usar o **Google Cloud Secret Manager** ou variáveis de ambiente de Functions (`firebase functions:secrets:set`).

---

## 2. Procedimento de Rollback

### Rollback do Frontend (Vercel)
1. Acesse o painel da Vercel: `Dashboard > Projeto > Deployments`.
2. Localize o deployment anterior estável (último build verde antes do incidente).
3. Clique nos três pontos `...` e selecione **"Instant Rollback"** (ou **"Promote to Production"**).
4. *Tempo estimado de recuperação:* **< 30 segundos** (não requer rebuild).

### Rollback do Backend (Firebase Cloud Functions)
1. No repositório git, faça checkout da tag ou commit estável anterior:
   ```bash
   git checkout <COMMIT_STABLE_HASH>
   ```
2. Realize o build e re-deploy imediato das Functions:
   ```bash
   npm --prefix functions run build
   npx firebase deploy --only functions --project <PROJECT_ID>
   ```
3. Alternativamente, via Google Cloud Console:
   - Acesse **Cloud Functions > Gerenciador de Revisões**.
   - Redirecione 100% do tráfego para a revisão anterior que funcionava.
4. *Tempo estimado de recuperação:* **2 a 3 minutos**.

### Rollback de Regras de Segurança (Firestore Rules)
1. Pelo terminal:
   ```bash
   npx firebase deploy --only firestore:rules --project <PROJECT_ID>
   ```
2. Pelo Firebase Console:
   - Acesse **Firestore Database > Rules > Releases history**.
   - Clique em **"Revert to this rule set"** na versão anterior.
3. *Tempo estimado de recuperação:* **Instantâneo (< 10 segundos)**.

---

## 3. Matriz de Plantão e Suporte (Grupo Piloto)

| Papel | Responsabilidade | Canal / Ação |
| :--- | :--- | :--- |
| **Operador de Caixa / Admin** | Conferir extrato bancário Pix e aprovar/rejeitar pedidos manualmente no painel `/admin`. | WhatsApp Comercial / Dashboard Admin |
| **Engenharia / Suporte Técnico** | Monitorar logs em tempo real (`firebase functions:log`), tratar exceções de rede e coordenar rollback. | Terminal / Google Cloud Logs Viewer |
| **Atendimento ao Cliente** | Suporte direto aos usuários do condomínio piloto em caso de dúvidas no Pix ou status do pedido. | Botão de WhatsApp flutuante no app / Suporte no Perfil |

---

## 4. Métricas e Monitoramento do Grupo Piloto (Primeiro Lote)

Durante a fase de testes com o grupo piloto (1º a 3º dia):
1. **Tempo de Conferência:** Meta `< 5 minutos` entre o envio do Pix pelo cliente e a aprovação pelo administrador.
2. **Taxa de Erros de Preço / Estoque:** Meta `0%`. Todas as transações devem validar saldo de estoque antes do débito.
3. **Falhas de Idempotência:** Monitorar logs para garantir que requisições repetidas de checkout retornem o pedido já criado com HTTP 200 sem debitar o estoque em duplicidade.
4. **Volume de Cancelamentos:** Acompanhar pedidos cancelados e auditar se a devolução de estoque ocorreu exatamente uma vez.

---

## 5. Checklist Final para Abertura ao Público

- [x] Testes unitários das Cloud Functions passando (12/12 invariantes aprovados).
- [x] Regras de segurança do Firestore (`firestore.rules`) publicadas e bloqueando escritas diretas de clientes.
- [x] Índices compostos (`firestore.indexes.json`) implantados e ativos no banco.
- [x] Cloud Functions essenciais publicadas no Firebase us-central1 (`createOrder`, `confirmPayment`, `cancelOrder`, `updateOrderStatus`, etc.).
- [x] Produtos avaliados e validados via script com preço positivo, estoque inteiro e imagem (`scripts/validate-products.ts`).
- [x] Regras de frete por condomínio e valores mínimos configurados em `/settings/shipping`.
- [x] Dados de recebimento Pix manual (chave e instrução) configurados e testados.
- [x] Administrador inicial promovido via Custom Claims (`admin: true`).
- [ ] Variáveis de ambiente configuradas no Vercel (Production) sem chaves versionadas.
- [ ] Smoke test executado pelo operador e cliente no domínio piloto.
- [ ] Canal de atendimento/WhatsApp visível e testado pelos usuários do condomínio.
