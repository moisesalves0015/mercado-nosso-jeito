# Auditoria de integração CRM administrativo ↔ loja

**Data:** 18 de outubro de 2026
**Repositório auditado:** `moisesalves0015/mercado-nosso-jeito`
**Escopo desta execução:** auditoria estática do repositório, correções compatíveis, testes locais e documentação. Nenhuma publicação, migração, seed ou gravação em Firebase real foi executada.

## Resumo executivo

O projeto usa React, TypeScript e Vite no cliente, Firebase Authentication/Firestore para identidade e persistência, e Cloud Functions para operações comerciais sensíveis, como criação de pedidos e baixa de estoque. O CRM e a loja compartilham a coleção `products`; o app mantém um espelho em `localStorage` alimentado por um listener Firestore global. Pedidos são calculados no servidor a partir dos produtos, estoque e configurações de frete persistidos.

Foram corrigidos problemas concretos no cálculo e na exibição de preços, identidade de produtos, estatísticas do CRM, mutações locais silenciosas, concorrência de ajustes de estoque e leitura de claims opcionais nas regras. Também foram removidos no detalhe do produto conteúdos/d descontos fictícios sem suporte no pedido real. Isso torna o caminho auditado mais consistente, mas **não comprova a implantação nem o funcionamento em produção**: a integração ponta a ponta com um usuário e dados reais ainda requer validação controlada em staging.

## Arquitetura e fonte de dados encontrada

- **Cliente/CRM:** React + TypeScript + Vite; páginas públicas e administrativas compartilham componentes e hooks.
- **Identidade/autorização:** Firebase Auth no cliente; roles/assignments e permissões granulares resolvidos no servidor por callables; `ProtectedRoute` protege rotas de administração. As regras Firestore fazem uma camada adicional de autorização.
- **Banco oficial:** Cloud Firestore. Entidades observadas incluem `products`, `orders`, `users`, `settings/shipping`, `settings/admin`, `coupons`, `role_assignments`, `roles`, `audit_logs` e documentos de configuração em `home-config/data/...`.
- **Sincronização do catálogo:** `App.tsx` assina `products` em tempo real e atualiza `localStorage`/dispara `app-products-updated`; páginas públicas leem esse espelho. O listener do CRM lê diretamente Firestore.
- **Pedidos:** `createOrder` valida produto, preço, disponibilidade, estoque e frete no servidor; cliente não é fonte confiável de preço. A transação do pedido também baixa estoque.
- **Imagens:** o editor comprime imagem no navegador e persiste o resultado no documento do produto; não foi comprovado um fluxo de Storage dedicado para esse formulário.

## Matriz de integração

| Módulo/entidade | Origem e operação administrativa | Consumidores da loja/servidor | Estado verificado |
|---|---|---|---|
| Produtos, preço e publicação | `products`; leitura em tempo real no CRM; criação/edição no detalhe do produto | Home, busca, categorias, detalhe, cartões, carrinho e `createOrder` | **Parcial.** O catálogo usa Firestore como fonte, IDs agora seguem o ID do documento e o cache global espelha também coleção vazia. A cobertura de fallbacks não persistidos em todas as páginas ainda não foi eliminada. Fluxo real não foi testado em staging. |
| Promoções | `products.promoActive`, `promoDiscount`, `promoPrice`, `promoExpiry`; editor calcula e salva preço promocional | Cartões, página de ofertas, busca e `createOrder` | **Parcial, melhorado.** Exibição e pedido consideram preço persistido e validade. Algumas listas tratam a categoria “Promoções” como critério editorial, mesmo sem desconto vigente. Não houve validação visual real. |
| Estoque | Campo `products.stock`; ajuste e histórico `stockHistory` no CRM | Cartões/detalhe verificam disponibilidade; `createOrder` valida e decrementa dentro da transação | **Parcial.** Ajustes manuais agora são transacionais no cliente e a gravação geral do produto não sobrescreve estoque/histórico existente. Ainda é escrita direta do cliente, não uma callable auditada pelo servidor; pendência alta. |
| Categorias | Campo texto `products.category` | Home, filtros e busca | **Parcial.** Categorias acompanham o produto, mas não foi encontrado cadastro administrativo de categorias como entidade separada; listas de categorias da busca são fixas. |
| Vitrines, banners e ofertas da Home | Documentos em `home-config/data/vitrines`, `mega-ofertas`, `period-config` e banners, gerenciados em Marketing | Home por IDs de produto/configuração e hooks públicos | **Parcial.** Há listeners e vínculos por IDs. Validação de todas as combinações e de cada controle administrativo não foi executada em UI/staging. |
| Frete e áreas atendidas | `settings/shipping` (com fallback legado `configs/shipping`); configuração no CRM | `useShippingConfig`, carrinho/checkout e `createOrder` | **Alinhamento estático confirmado.** A callable exige configuração válida e os testes exercitam o comportamento. Persistência real não foi verificada. |
| Pix/dados da loja | `settings/admin`; CRM salva configuração e `useAdminConfig` a lê | Checkout consome `pixKey`/`pixName`; `supportPhone` e `storeHours` também são gravados | **Parcial.** Pix tem consumidor encontrado. Não foi encontrado consumidor claro para todos os campos de contato/horário; confirmar necessidade antes de declarar integrados. |
| Cupons | Coleção `coupons`; seed seguro documentado e validação no servidor | `createOrder` valida código, uso, mínimo e desconto | **Parcial.** Os testes da callable cobrem regras; não foi comprovado o ciclo completo de administração/uso na produção. |
| Pedidos e pagamentos | `createOrder` cria pedido; callables atualizam status/pagamento | CRM acompanha pedidos e usa status para métricas | **Parcial.** O fluxo servidor tem testes unitários; a experiência real com provedor/pagamento externo não foi validada nesta execução. |
| Equipe, roles e auditoria | Callables RBAC e coleções `role_assignments`, `roles`, `audit_logs` | `useAuth`, `ProtectedRoute`, módulos administrativos | **Proteções verificadas por regras/testes locais.** Ajustes de produto/estoque via escrita Firestore direta não recebem o mesmo trilho de auditoria das callables administrativas. |
| Atendimento/roleta/clubes | Rotas e módulos existentes no CRM/app | Funções e coleções próprias | **Inventariados, não auditados funcionalmente em detalhe nesta execução.** Não afirmar integração ponta a ponta. |

## Problemas identificados e correções aplicadas

1. **Claims ausentes quebravam autorização legítima.** As regras acessavam diretamente `request.auth.token.banned`, `token.admin` e campos de perfil que podem não existir. O Firestore Emulator acusava “Property banned is undefined” e falhava em leituras/escritas legítimas. As regras agora usam acesso com valor padrão (`Map.get`); os 25 testes de regras passaram.
2. **Identidade do produto se perdia no cartão.** `ProductCard` usava um slug do título para carrinho/rota em vez do ID Firestore; o pedido envia esse valor como `productId` e o backend busca `products/{productId}`. O cartão agora utiliza o ID persistido, mantém compatibilidade de detalhe por slug legado e as sugestões passam o ID real.
3. **Preço visual não correspondia ao pedido.** O cartão simulava aleatoriamente redução de preço de 2–3% e “Só no Clube”, embora o carrinho/servidor não cobrassem esse valor. O detalhe também oferecia descontos de assinatura/cupom de 10%/20% que não eram enviados como modalidade suportada pelo servidor. Essas alegações foram removidas; a compra única usa preço de catálogo e a tela não inventa fallback de produto, avaliações, vendas recentes, origem ou conservação.
4. **Promoções não fechavam o ciclo.** O editor calculava `promoPrice` para preview, mas não persistia o campo consumido por `createOrder`; a callable ignorava `promoExpiry`. O editor agora valida desconto e validade e salva o preço calculado. A função do servidor só aplica promoção com preço menor que o regular e validade futura; a loja calcula o mesmo preço efetivo. Foram incluídos testes para promoção expirada e futura.
5. **Vitrines públicas podiam refletir catálogo fictício ou local.** A Home tinha cartões com nomes/preços fixos e correções de imagem apenas no cache do navegador. A Home agora usa produtos persistidos para os fallbacks e para as vitrines por período. A página de promoções e busca deixaram de injetar produtos default no cache; busca filtra promoção pela validade. O listener global também substitui o cache quando Firestore retorna coleção vazia e força o ID do documento como canônico.
6. **Abertura do CRM podia alterar produto sem intervenção.** A sincronização de imagens no módulo Marketing modificava produtos ao abrir a tela. Essa mutação foi removida; Marketing, CRM e app passaram a privilegiar o ID do documento.
7. **Métricas do dashboard eram demonstrativas.** Séries de venda e categorias usavam números fixos. Foram substituídas por funções puras que derivam semana/meses de pedidos efetivamente pagos e não cancelados e contagem de produtos ativos por categoria. O teste confirma que a contagem de catálogo não é rotulada como participação percentual em vendas.
8. **Formulário de produto aceitava valores parcialmente numéricos e inválidos.** A edição agora valida preço, custo, diamantes, estoque, estoque mínimo, desconto e expiração antes de persistir, mantendo tratamento de falha.
9. **Ajuste manual de estoque podia sobrescrever uma alteração concorrente.** A tela lia estoque de estado possivelmente desatualizado e gravava valor absoluto/histórico. O ajuste agora usa transação Firestore contra o valor atual, registra somente o delta efetivamente aplicado e edição geral não regrava estoque/histórico existente.

## Arquivos alterados

- `firestore.rules`
- `functions/src/index.ts`, `functions/src/index.test.ts`
- `src/App.tsx`
- `src/components/AdminMarketing.tsx`, `src/components/ProductCard.tsx`
- `src/pages/Admin.tsx`, `AdminProductDetail.tsx`, `Home.tsx`, `ProductDetail.tsx`, `Promotions.tsx`, `Search.tsx`
- `src/utils/adminAnalytics.ts`, novo `src/utils/productPricing.ts`
- novo `tests/adminAnalytics.test.ts`
- `package.json` (script `test:admin-analytics`)

Não foram removidas rotas administrativas existentes nem executadas migrações ou exclusões no banco. A tela de detalhe continua com layout, quantidade, favoritos, compartilhar, compra única e recomendações; os elementos de assinatura/desconto que não tinham processamento real foram substituídos por uma opção de compra honesta.

## Testes e verificações

| Verificação | Resultado |
|---|---|
| `npm run build` | **Passou.** Vite/TypeScript compilam. O bundle administrativo ainda ultrapassa 1 MB minificado (aviso de tamanho). |
| `npm run test:admin-analytics` | **Passou: 6/6.** Datas, vendas, períodos, categoria e cálculo/validade promocional. |
| `npm --prefix functions run build` | **Passou.** |
| `npm --prefix functions test` | **Passou: 98/98.** Inclui testes de pedido e os novos casos de promoção. |
| `npm run test:rules` | **Passou: 25/25** no Firebase Emulator local. Antes da correção, 10 casos falhavam pela leitura de claim/campo ausente. |
| ESLint focado nos arquivos alterados | **0 erros**, 2 avisos de dependências de `useEffect` já localizados em `Admin.tsx` e `AdminProductDetail.tsx`. |
| ESLint global (`npm run lint`) | **Falha preexistente fora do escopo de correção:** 11 erros em `functions/src/admin/admin.test.ts` (uso de `any`) e `functions/src/admin/rbac.ts` (atribuição inútil), além dos 2 avisos de hooks. |
| `git diff --check` | **Passou.** |

## Pendências e riscos que impedem declarar integração concluída

1. **Não houve prova de produção/staging.** Não foram usadas credenciais de Firebase, contas administrativas, catálogo real, checkout de ponta a ponta nem publicação. Testes de emulador e unitários validam código, não a configuração remota, índices, claims ou dados do usuário. Deploy de regras/functions é uma etapa separada e não foi feito.
2. **Estoque ainda é gravado diretamente pelo cliente autenticado.** A transação reduz perda concorrente, mas não cumpre integralmente o padrão mais forte já usado pelas callables: autorização granular `produtos:*`, validação confiável e `audit_logs`. Recomenda-se migrar ajuste de estoque para callable transacional, preservando histórico e permissões existentes.
3. **Campos privados no documento de produto.** As regras permitem leitura pública de `products`, enquanto documentos podem conter `costPrice` e outros dados internos. Regras Firestore não filtram campos individualmente. Separar dados públicos/privados ou criar projeção pública é uma mudança arquitetural necessária; não foi feita por exigir migração compatível e validação em staging.
4. **Fallbacks ainda existem em outras categorias.** `Bebidas`, `Padaria`, `Tabacaria` e `Eletronicos` ainda contêm lógica local que mescla `defaultProducts`; `Bebidas` ainda corrige algumas imagens apenas no cache. Se Firestore estiver vazio ou se esses IDs não existirem, essas páginas podem apresentar dados que não representam documentos compráveis. A migração/remoção desse comportamento deve ser concluída depois de validar o catálogo real e a estratégia explícita de seed.
5. **Categorias não são uma entidade gerenciada.** Nomes e opções de filtro têm valores fixos; adicionar categoria pode não atualizar toda a navegação sem alterar código.
6. **Auditoria de gravações administrativas é incompleta.** Produtos/configurações e ajustes de estoque usam gravação direta em partes do CRM. A auditoria dos demais módulos, tabelas de permissões por operação e logs de todas as edições não foi concluída.
7. **Qualidade geral de lint e bundle.** Resolver os 11 erros de lint do backend e dividir o chunk administrativo de aproximadamente 1 MB são melhorias recomendadas; não foram misturadas com as correções funcionais desta etapa.
8. **Validação visual/responsiva e acessibilidade.** Não foi realizado teste manual no browser com usuário autenticado, nem matriz de telas/leitor de tela.

## Próximas etapas recomendadas

1. Revisar este diff e executar em projeto Firebase **staging** com um usuário de teste e produtos descartáveis; validar criação/edição, promoção futura/expirada, estoque concorrente, recarga e páginas públicas.
2. Confirmar primeiro a estratégia de seed: o script `npm run seed` documenta dry-run padrão e exige projeto explícito; não executar `--apply` antes de revisar o plano e os dados.
3. Implementar callable de ajuste de estoque com permissão granular e auditoria, depois testar concorrência e histórico no emulador.
4. Planejar projeção pública de catálogo sem dados privados, preservando IDs e histórico de pedidos.
5. Remover/compatibilizar todos os fallbacks de produto e categorias estáticas após confirmar catálogo oficial e links legados.
6. Corrigir lint global e realizar teste browser/autenticado em staging antes de declarar o fluxo CRM–loja concluído ou publicar.
