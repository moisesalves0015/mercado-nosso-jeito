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

> Legenda: `[x]` = verificado (código/testes/deploy comprovados). `[ ]` = pendente ou não verificado. Staging ≠ produção.

- [x] Build frontend e Functions, lint (0 erros) e testes comportamentais das Functions passando.
- [x] `npm ci` validado com npm 10 (mesmo da CI Node 20).
- [x] Pagamento simulado removido do bundle; servidor rejeita `credit_card`.
- [x] `/orders` imutável pelo cliente, inclusive admin (somente callables).
- [x] Firestore rules, índices e 24 Functions publicados no Firebase (`nosso-mercado-4b877`) com as últimas mudanças (RBAC/CRM, auditoria, idempotência por conteúdo, frete falha fechado).
- [ ] Storage habilitado no console e `storage.rules` implantadas (deploy anterior falhou), ou upload desativado.
- [ ] Projeto Firebase de **produção** criado e configurado (`nosso-mercado-prod`); staging e produção ainda usam alias diferente apenas no `.firebaserc`.
- [ ] Catálogo importado com `npm run seed` (dry-run revisado) e estoque real conferido.
- [ ] `/settings/shipping` populado com condomínios e taxas reais.
- [ ] Chave Pix e nome do recebedor configurados em `settings/admin` (checkout desabilita Pix sem chave).
- [ ] Admin inicial com Custom Claim (`scripts/set-admin.js`) e token verificado no painel.
- [ ] Política de expiração de Pix pendente definida e implementada (hoje o contador de 10 min é apenas visual).
- [ ] Variáveis `VITE_*` configuradas na Vercel (Production) sem chaves versionadas.
- [ ] Smoke test cliente + admin no staging (pedido Pix de ponta a ponta, cancelamento e estoque).
- [ ] Canal de atendimento visível e responsável de plantão definido.
- [ ] Procedimento presencial de verificação de idade para produtos restritos validado.

---

## 6. Arquitetura do Painel Administrativo, CRM e Governança RBAC

### 6.1 Mapa de Rotas Administrativas (`/admin/*`)

| Rota | Módulo | Permissão Necessária (Qualquer) | Descrição |
| :--- | :--- | :--- | :--- |
| `/admin/dashboard` | Visão Geral | `dashboard:view` | KPIs em tempo real, fila operacional de pedidos, alertas de estoque e chamados abertos. |
| `/admin/orders` | Pedidos | `pedidos:view`, `pedidos:edit`, `pedidos:approve` | Lista de pedidos com filtros persistidos na URL (`?status=`, `?payment=`, `?q=`). |
| `/admin/orders/:orderId` | Detalhe do Pedido | `pedidos:view`, `pedidos:edit`, `pedidos:approve` | Ficha completa do pedido, conciliação Pix, transição de status, cancelamento auditado e timeline. |
| `/admin/customers` | Clientes | `clientes:view`, `crm:view` | Base de moradores com segmentos (`all`, `vip`, `inactive`, `banned`) e lançamento de diamantes. |
| `/admin/customers/:customerId` | Ficha 360° do Morador | `clientes:view`, `crm:view` | Perfil com minimização de CPF (LGPD), endereços, Clube VIP, histórico de pedidos e chamados. |
| `/admin/support` | Suporte & Chamados | `suporte:view`, `suporte:edit`, `crm:view` | Fila de atendimento ao morador (`support_tickets`) com filtros de prioridade e abertura de ticket. |
| `/admin/support/:ticketId` | Tratativa de Chamado | `suporte:view`, `suporte:edit`, `crm:view` | Conversa, notas internas da equipe, atribuição de operador e resolução auditada. |
| `/admin/products` | Catálogo de Produtos | `produtos:view`, `produtos:edit` | Gestão de catálogo, preços, margens, categorias, visibilidade e arquivamento reversível. |
| `/admin/products/new` / `/admin/products/:id` | Ficha do Produto | `produtos:view`, `produtos:edit`, `produtos:create` | Cadastro e edição detalhada de produto, simulador de margem e histórico de estoque. |
| `/admin/inventory` | Estoque & Inventário | `estoque:view`, `estoque:edit`, `produtos:view` | Alertas de ruptura/estoque mínimo e ajuste transacional via `adminAdjustStock`. |
| `/admin/finance` | Financeiro & Pix | `financeiro:view`, `financeiro:approve` | Fila dedicada de conciliação Pix, alertas de margem comprimida e simulador de lucro líquido. |
| `/admin/marketing` | Marketing & Cupons | `marketing:view`, `marketing:edit` | Gestão de banners, vitrines e cupons promocionais. |
| `/admin/loyalty` | Fidelidade & Roleta | `clube:view`, `clube:edit`, `marketing:edit` | Clube VIP (missões e recompensas) e configuração da Roleta Diária. |
| `/admin/reports` | Relatórios & BI | `relatorios:view`, `dashboard:view` | Evolução de receita (6 meses), desempenho semanal e SLA operacional. |
| `/admin/users` / `/admin/users/:uid` | Equipe & Acessos | `usuarios:view`, `usuarios:admin` | Gestão de membros da equipe, atribuição de papéis e suspensão/arquivamento reversível. |
| `/admin/roles` | Papéis & Permissões | `usuarios:view`, `usuarios:admin` | Matriz interativa de permissões (`MODULES × ACTIONS`) e sincronização aditiva do catálogo base. |
| `/admin/audit` | Trilha de Auditoria | `auditoria:view`, `auditoria:admin` | Explorador imutável de `audit_logs` com filtros, paginação por cursor e inspetor de diff (`before`/`after`). |
| `/admin/settings` | Configurações | `configuracoes:view`, `configuracoes:edit` | Dados de recebimento Pix, WhatsApp de plantão e taxas de entrega por condomínio. |

### 6.2 Papéis RBAC Padrão (`role_assignments/{uid}`)

- **`superadmin`**: Acesso irrestrito (`*`), incluindo governança de administradores e papéis. Protegido contra auto-remoção e remoção do último superadmin ativo.
- **`admin`**: Gestão operacional completa da loja, exceto governança crítica (`usuarios:admin`, `auditoria:export`, `configuracoes:admin`).
- **`operacoes`**: Separação, expedição e cancelamento de pedidos (`pedidos:*`), ajuste de estoque (`estoque:edit`) e suporte operacional.
- **`financeiro`**: Conciliação de pagamentos Pix (`financeiro:approve`, `pedidos:approve`), relatórios e leitura de auditoria.
- **`marketing`**: Campanhas, cupons, Clube VIP, Roleta e CRM.
- **`suporte`**: Atendimento de chamados (`suporte:*`), CRM e consulta de pedidos/clientes.
- **`catalogo`**: Cadastro de produtos (`produtos:*`) e gestão de inventário (`estoque:*`).
- **`analista`**: Acesso estritamente leitura a `dashboard:view` e `relatorios:view`.

