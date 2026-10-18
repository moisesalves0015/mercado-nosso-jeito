/**
 * RBAC catalogue — single source of truth for modules, actions and the default roles.
 *
 * NOTE: `src/admin/permissions.ts` (frontend) mirrors the module/action lists for UX only
 * (menu visibility). The backend is authoritative: every mutation is re-validated here.
 */

export const MODULES = [
  'dashboard',
  'clientes',
  'crm',
  'usuarios',
  'produtos',
  'estoque',
  'pedidos',
  'financeiro',
  'marketing',
  'clube',
  'configuracoes',
  'auditoria',
  'suporte',
  'relatorios',
] as const;

export const ACTIONS = [
  'view',
  'create',
  'edit',
  'publish',
  'approve',
  'export',
  'archive',
  'restore',
  'admin',
] as const;

export type ModuleId = (typeof MODULES)[number];
export type ActionId = (typeof ACTIONS)[number];
export type Permission = `${ModuleId}:${ActionId}`;

export const WILDCARD = '*';

export const ALL_PERMISSIONS: Permission[] = MODULES.flatMap((m) =>
  ACTIONS.map((a) => `${m}:${a}` as Permission),
);

const ALL_SET = new Set<string>(ALL_PERMISSIONS);

export interface RoleDefinition {
  id: string;
  label: string;
  description: string;
  permissions: string[];
  /** System roles cannot be deleted/archived; `superadmin` permissions are immutable. */
  system: boolean;
  /** Roles that also receive the legacy `admin` rule-level access (Firestore rules `isAdmin()`). */
  ruleAdmin: boolean;
}

const all = (m: ModuleId, except: ActionId[] = []): Permission[] =>
  ACTIONS.filter((a) => !except.includes(a)).map((a) => `${m}:${a}` as Permission);

const only = (m: ModuleId, actions: ActionId[]): Permission[] =>
  actions.map((a) => `${m}:${a}` as Permission);

/** Critical actions that the plain `admin` role does NOT receive by default. */
const ADMIN_EXCLUDED = new Set<string>([
  'usuarios:admin',
  'configuracoes:admin',
  'auditoria:admin',
  'auditoria:export',
  'financeiro:admin',
  'clube:admin',
]);

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'superadmin',
    label: 'Super Admin',
    description: 'Acesso total à plataforma, incluindo acessos, auditoria e ações de alto risco.',
    permissions: [WILDCARD],
    system: true,
    ruleAdmin: true,
  },
  {
    id: 'admin',
    label: 'Administrador',
    description: 'Administração operacional ampla, sem ações críticas de governança.',
    permissions: ALL_PERMISSIONS.filter((p) => !ADMIN_EXCLUDED.has(p)),
    system: true,
    ruleAdmin: true,
  },
  {
    id: 'operacoes',
    label: 'Operações',
    description: 'Pedidos, estoque, logística e atendimento operacional.',
    permissions: [
      ...only('dashboard', ['view']),
      ...only('pedidos', ['view', 'edit', 'approve']),
      ...only('estoque', ['view', 'create', 'edit']),
      ...only('produtos', ['view']),
      ...only('clientes', ['view']),
      ...only('suporte', ['view', 'create', 'edit']),
      ...only('relatorios', ['view']),
    ],
    system: true,
    ruleAdmin: false,
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Pagamentos, conciliação, receitas, custos, margens e relatórios financeiros.',
    permissions: [
      ...only('dashboard', ['view']),
      ...only('financeiro', ['view', 'edit', 'approve', 'export']),
      ...only('pedidos', ['view']),
      ...only('relatorios', ['view', 'export']),
    ],
    system: true,
    ruleAdmin: false,
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Campanhas, banners, vitrines, cupons, segmentação e comunicação.',
    permissions: [
      ...only('dashboard', ['view']),
      ...all('marketing', ['admin', 'approve']),
      ...only('clientes', ['view']),
      ...only('crm', ['view', 'create', 'edit']),
      ...only('produtos', ['view']),
      ...only('relatorios', ['view']),
    ],
    system: true,
    ruleAdmin: false,
  },
  {
    id: 'suporte',
    label: 'Suporte',
    description: 'Clientes, tickets, notas, pedidos em consulta e atendimento.',
    permissions: [
      ...only('dashboard', ['view']),
      ...only('clientes', ['view']),
      ...only('crm', ['view', 'create', 'edit']),
      ...only('suporte', ['view', 'create', 'edit', 'approve', 'archive', 'restore']),
      ...only('pedidos', ['view']),
    ],
    system: true,
    ruleAdmin: false,
  },
  {
    id: 'catalogo',
    label: 'Catálogo',
    description: 'Produtos, categorias, preços, imagens, estoque e promoções.',
    permissions: [
      ...only('dashboard', ['view']),
      ...all('produtos', ['admin', 'approve']),
      ...only('estoque', ['view', 'create', 'edit']),
      ...only('marketing', ['view']),
    ],
    system: true,
    ruleAdmin: false,
  },
  {
    id: 'analista',
    label: 'Analista',
    description: 'Leitura de dashboards e relatórios, sem qualquer mutação.',
    permissions: [...only('dashboard', ['view']), ...only('relatorios', ['view'])],
    system: true,
    ruleAdmin: false,
  },
];

export const DEFAULT_ROLES_BY_ID: Record<string, RoleDefinition> = Object.fromEntries(
  DEFAULT_ROLES.map((r) => [r.id, r]),
);

export const SUPERADMIN_ROLE_ID = 'superadmin';

/** Roles whose assignment grants legacy rule-level admin (custom claim `admin: true`). */
export const RULE_ADMIN_ROLE_IDS = ['admin', 'superadmin'] as const;

export function isValidPermission(p: unknown): p is string {
  return typeof p === 'string' && (p === WILDCARD || ALL_SET.has(p));
}

/** Returns a sorted, de-duplicated list; throws on unknown permission strings. */
export function normalizePermissions(list: unknown): string[] {
  if (!Array.isArray(list)) throw new Error('permissions deve ser uma lista.');
  const out = new Set<string>();
  for (const p of list) {
    if (!isValidPermission(p)) throw new Error(`Permissão inválida: ${String(p)}`);
    out.add(p);
  }
  return Array.from(out).sort();
}

export function permissionsAllow(granted: readonly string[], required: string): boolean {
  return granted.includes(WILDCARD) || granted.includes(required);
}
