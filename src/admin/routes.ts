/**
 * Single source of truth for the administrative route tree, navigation menu,
 * breadcrumbs, legacy URL redirects, and route-level RBAC permission requirements.
 */

export type NavGroupId = 'operacao' | 'crm' | 'catalogo' | 'comercial' | 'governanca';

export interface AdminNavItem {
  id: string;
  label: string;
  shortLabel?: string;
  path: string;
  group: NavGroupId;
  description: string;
  /** Caller must satisfy at least one of these permissions to see/access this section. */
  requiredPermissions: string[];
  iconName:
    | 'LayoutDashboard'
    | 'ShoppingBag'
    | 'Users'
    | 'Headphones'
    | 'Package'
    | 'Boxes'
    | 'DollarSign'
    | 'Megaphone'
    | 'Sparkles'
    | 'BarChart3'
    | 'ShieldCheck'
    | 'KeyRound'
    | 'ScrollText'
    | 'Settings';
}

export const NAV_GROUP_LABELS: Record<NavGroupId, string> = {
  operacao: 'Operação Diária',
  crm: 'CRM & Atendimento',
  catalogo: 'Catálogo & Estoque',
  comercial: 'Comercial & Crescimento',
  governanca: 'Governança & Segurança',
};

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  {
    id: 'dashboard',
    label: 'Visão Geral',
    shortLabel: 'Início',
    path: '/admin/dashboard',
    group: 'operacao',
    description: 'KPIs operacionais, fila de prioridades e pulso do condomínio em tempo real.',
    requiredPermissions: ['dashboard:view'],
    iconName: 'LayoutDashboard',
  },
  {
    id: 'orders',
    label: 'Pedidos',
    path: '/admin/orders',
    group: 'operacao',
    description: 'Gestão completa do fluxo de pedidos, separação, entrega e conciliação Pix.',
    requiredPermissions: ['pedidos:view', 'pedidos:edit', 'pedidos:approve'],
    iconName: 'ShoppingBag',
  },
  {
    id: 'support',
    label: 'Suporte & Chamados',
    shortLabel: 'Suporte',
    path: '/admin/support',
    group: 'crm',
    description: 'Fila de atendimento ao morador, histórico de interações e resolução auditada.',
    requiredPermissions: ['suporte:view', 'suporte:edit', 'crm:view'],
    iconName: 'Headphones',
  },
  {
    id: 'customers',
    label: 'Clientes & CRM 360°',
    shortLabel: 'Clientes',
    path: '/admin/customers',
    group: 'crm',
    description: 'Base de moradores, visão 360°, endereços, pedidos, diamantes e moderação.',
    requiredPermissions: ['clientes:view', 'crm:view'],
    iconName: 'Users',
  },
  {
    id: 'products',
    label: 'Produtos',
    path: '/admin/products',
    group: 'catalogo',
    description: 'Catálogo da loja, preços, margens, categorias, imagens e visibilidade.',
    requiredPermissions: ['produtos:view', 'produtos:edit'],
    iconName: 'Package',
  },
  {
    id: 'inventory',
    label: 'Estoque & Inventário',
    shortLabel: 'Estoque',
    path: '/admin/inventory',
    group: 'catalogo',
    description: 'Controle de saldo físico, alertas de ruptura e ajustes transacionais auditados.',
    requiredPermissions: ['estoque:view', 'estoque:edit', 'produtos:view'],
    iconName: 'Boxes',
  },
  {
    id: 'finance',
    label: 'Financeiro & Pix',
    shortLabel: 'Financeiro',
    path: '/admin/finance',
    group: 'comercial',
    description: 'Conciliação de pagamentos Pix, análise de margem real e simulador de lucro.',
    requiredPermissions: ['financeiro:view', 'financeiro:approve'],
    iconName: 'DollarSign',
  },
  {
    id: 'marketing',
    label: 'Marketing & Cupons',
    shortLabel: 'Marketing',
    path: '/admin/marketing',
    group: 'comercial',
    description: 'Cupons de desconto, banners promocionais e ofertas relâmpago.',
    requiredPermissions: ['marketing:view', 'marketing:edit'],
    iconName: 'Megaphone',
  },
  {
    id: 'loyalty',
    label: 'Fidelidade & Clube',
    shortLabel: 'Fidelidade',
    path: '/admin/loyalty',
    group: 'comercial',
    description: 'Clube VIP de diamantes, missões, recompensas e configuração da Roleta.',
    requiredPermissions: ['clube:view', 'clube:edit', 'marketing:edit'],
    iconName: 'Sparkles',
  },
  {
    id: 'reports',
    label: 'Relatórios & BI',
    shortLabel: 'Relatórios',
    path: '/admin/reports',
    group: 'comercial',
    description: 'Evolução de receita, desempenho semanal, mix de categorias e SLA operacional.',
    requiredPermissions: ['relatorios:view', 'dashboard:view'],
    iconName: 'BarChart3',
  },
  {
    id: 'users',
    label: 'Equipe & Acessos',
    shortLabel: 'Equipe',
    path: '/admin/users',
    group: 'governanca',
    description: 'Gestão de membros da equipe, atribuição de papéis, suspensão e restauração.',
    requiredPermissions: ['usuarios:view', 'usuarios:admin'],
    iconName: 'ShieldCheck',
  },
  {
    id: 'roles',
    label: 'Papéis & Permissões',
    shortLabel: 'Papéis',
    path: '/admin/roles',
    group: 'governanca',
    description: 'Matriz RBAC por módulo e ação, papéis padrão do sistema e papéis customizados.',
    requiredPermissions: ['usuarios:view', 'usuarios:admin'],
    iconName: 'KeyRound',
  },
  {
    id: 'audit',
    label: 'Trilha de Auditoria',
    shortLabel: 'Auditoria',
    path: '/admin/audit',
    group: 'governanca',
    description: 'Registro imutável de ações administrativas, alterações de acesso e tentativas negadas.',
    requiredPermissions: ['auditoria:view', 'auditoria:admin'],
    iconName: 'ScrollText',
  },
  {
    id: 'settings',
    label: 'Configurações',
    path: '/admin/settings',
    group: 'governanca',
    description: 'Dados de recebimento Pix, contato da loja e taxas de entrega por condomínio.',
    requiredPermissions: ['configuracoes:view', 'configuracoes:edit'],
    iconName: 'Settings',
  },
];

/**
 * Legacy PT-BR / old paths mapped to their canonical routes for seamless bookmark & link redirection.
 */
export const LEGACY_ADMIN_REDIRECTS: ReadonlyArray<{ from: string; to: string }> = [
  { from: '/admin/visao-geral', to: '/admin/dashboard' },
  { from: '/admin/pedidos', to: '/admin/orders' },
  { from: '/admin/clientes', to: '/admin/customers' },
  { from: '/admin/crm', to: '/admin/customers' },
  { from: '/admin/suporte', to: '/admin/support' },
  { from: '/admin/chamados', to: '/admin/support' },
  { from: '/admin/produtos', to: '/admin/products' },
  { from: '/admin/estoque', to: '/admin/inventory' },
  { from: '/admin/financeiro', to: '/admin/finance' },
  { from: '/admin/clube', to: '/admin/loyalty' },
  { from: '/admin/fidelidade', to: '/admin/loyalty' },
  { from: '/admin/roleta', to: '/admin/loyalty' },
  { from: '/admin/relatorios', to: '/admin/reports' },
  { from: '/admin/usuarios', to: '/admin/users' },
  { from: '/admin/equipe', to: '/admin/users' },
  { from: '/admin/papeis', to: '/admin/roles' },
  { from: '/admin/permissoes', to: '/admin/roles' },
  { from: '/admin/auditoria', to: '/admin/audit' },
  { from: '/admin/configuracoes', to: '/admin/settings' },
];

export interface BreadcrumbSegment {
  label: string;
  to?: string;
}

/**
 * Computes human-readable breadcrumbs for any `/admin/*` pathname.
 */
export function resolveAdminBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const clean = pathname.replace(/\/+$/, '') || '/admin/dashboard';
  const crumbs: BreadcrumbSegment[] = [{ label: 'Admin', to: '/admin/dashboard' }];

  const navMatch = ADMIN_NAV_ITEMS.find((item) => clean === item.path);
  if (navMatch) {
    crumbs.push({ label: navMatch.label });
    return crumbs;
  }

  if (clean === '/admin/products/new') {
    crumbs.push({ label: 'Produtos', to: '/admin/products' });
    crumbs.push({ label: 'Novo Produto' });
    return crumbs;
  }

  const productMatch = clean.match(/^\/admin\/products\/([^/]+)$/);
  if (productMatch) {
    crumbs.push({ label: 'Produtos', to: '/admin/products' });
    crumbs.push({ label: `Produto #${decodeURIComponent(productMatch[1]).slice(0, 12)}` });
    return crumbs;
  }

  const orderMatch = clean.match(/^\/admin\/orders\/([^/]+)$/);
  if (orderMatch) {
    crumbs.push({ label: 'Pedidos', to: '/admin/orders' });
    crumbs.push({ label: `Pedido #${decodeURIComponent(orderMatch[1]).slice(0, 10).toUpperCase()}` });
    return crumbs;
  }

  const customerMatch = clean.match(/^\/admin\/customers\/([^/]+)$/);
  if (customerMatch) {
    crumbs.push({ label: 'Clientes & CRM 360°', to: '/admin/customers' });
    crumbs.push({ label: `Ficha do Morador (${decodeURIComponent(customerMatch[1]).slice(0, 8)})` });
    return crumbs;
  }

  const ticketMatch = clean.match(/^\/admin\/support\/([^/]+)$/);
  if (ticketMatch) {
    crumbs.push({ label: 'Suporte & Chamados', to: '/admin/support' });
    crumbs.push({ label: `Chamado #${decodeURIComponent(ticketMatch[1]).slice(0, 10).toUpperCase()}` });
    return crumbs;
  }

  if (clean === '/admin/marketing/campaigns') {
    crumbs.push({ label: 'Marketing & Cupons', to: '/admin/marketing' });
    crumbs.push({ label: 'Anúncios Patrocinados' });
    return crumbs;
  }

  if (clean === '/admin/marketing/campaigns/new') {
    crumbs.push({ label: 'Marketing & Cupons', to: '/admin/marketing' });
    crumbs.push({ label: 'Anúncios Patrocinados', to: '/admin/marketing/campaigns' });
    crumbs.push({ label: 'Nova Campanha' });
    return crumbs;
  }

  const campaignMatch = clean.match(/^\/admin\/marketing\/campaigns\/([^/]+)$/);
  if (campaignMatch) {
    crumbs.push({ label: 'Marketing & Cupons', to: '/admin/marketing' });
    crumbs.push({ label: 'Anúncios Patrocinados', to: '/admin/marketing/campaigns' });
    crumbs.push({ label: `Campanha #${decodeURIComponent(campaignMatch[1]).slice(0, 12)}` });
    return crumbs;
  }

  const userMatch = clean.match(/^\/admin\/users\/([^/]+)$/);
  if (userMatch) {
    crumbs.push({ label: 'Equipe & Acessos', to: '/admin/users' });
    crumbs.push({ label: `Membro (${decodeURIComponent(userMatch[1]).slice(0, 8)})` });
    return crumbs;
  }

  crumbs.push({ label: 'Página não encontrada' });
  return crumbs;
}

