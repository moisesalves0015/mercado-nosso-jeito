/**
 * Frontend RBAC permission catalogue — mirrors functions/src/admin/permissions.ts.
 * Authorization is always enforced on the server (Firestore Rules + Cloud Functions),
 * while this module drives UI visibility, route guards, and the role matrix editor.
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
  'suporte',
  'clube',
  'relatorios',
  'configuracoes',
  'auditoria',
] as const;

export type ModuleId = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleId, string> = {
  dashboard: 'Visão Geral',
  clientes: 'Clientes',
  crm: 'CRM & Relacionamento',
  usuarios: 'Equipe & Acessos',
  produtos: 'Catálogo de Produtos',
  estoque: 'Estoque & Inventário',
  pedidos: 'Pedidos & Operação',
  financeiro: 'Financeiro & Conciliação',
  marketing: 'Marketing & Campanhas',
  suporte: 'Suporte & Chamados',
  clube: 'Fidelidade, Clube & Roleta',
  relatorios: 'Relatórios & Analytics',
  configuracoes: 'Configurações da Loja',
  auditoria: 'Auditoria & Segurança',
};

export const ACTIONS = [
  'view',
  'create',
  'edit',
  'publish',
  'archive',
  'restore',
  'delete',
  'approve',
  'export',
  'admin',
] as const;

export type ActionId = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<ActionId, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  publish: 'Publicar / Pausar',
  archive: 'Arquivar / Suspender',
  restore: 'Restaurar',
  delete: 'Excluir',
  approve: 'Aprovar / Conciliar',
  export: 'Exportar',
  admin: 'Governança Total',
};

export type Permission = `${ModuleId}:${ActionId}`;
export type PermissionOrWildcard = Permission | '*';

export const ALL_PERMISSIONS: readonly Permission[] = MODULES.flatMap((m) =>
  ACTIONS.map((a) => `${m}:${a}` as Permission),
);

export type SystemRoleId =
  | 'superadmin'
  | 'admin'
  | 'operacoes'
  | 'financeiro'
  | 'marketing'
  | 'suporte'
  | 'catalogo'
  | 'analista';

export interface RoleDefinition {
  id: string;
  label: string;
  description: string;
  permissions: PermissionOrWildcard[];
  system: boolean;
  active: boolean;
}

const allOf = (m: ModuleId, acts: readonly ActionId[] = ACTIONS): Permission[] =>
  acts.map((a) => `${m}:${a}` as Permission);

const CRITICAL_GOVERNANCE: ReadonlySet<Permission> = new Set<Permission>([
  'usuarios:admin',
  'usuarios:delete',
  'configuracoes:admin',
  'configuracoes:delete',
  'auditoria:export',
  'auditoria:delete',
  'auditoria:admin',
]);

export const DEFAULT_ROLES: readonly RoleDefinition[] = [
  {
    id: 'superadmin',
    label: 'Superadmin',
    description:
      'Governança total do sistema, gestão de administradores, papéis, configurações críticas e auditoria.',
    permissions: ['*'],
    system: true,
    active: true,
  },
  {
    id: 'admin',
    label: 'Administrador',
    description:
      'Gestão operacional completa da loja, exceto governança de superadmins e exclusão de trilha de auditoria.',
    permissions: ALL_PERMISSIONS.filter((p) => !CRITICAL_GOVERNANCE.has(p)),
    system: true,
    active: true,
  },
  {
    id: 'operacoes',
    label: 'Operações',
    description: 'Separação, conferência, expedição de pedidos e ajuste operacional de estoque.',
    permissions: [
      'dashboard:view',
      ...allOf('pedidos', ['view', 'edit', 'approve']),
      ...allOf('estoque', ['view', 'edit']),
      'produtos:view',
      'clientes:view',
      ...allOf('suporte', ['view', 'edit']),
    ],
    system: true,
    active: true,
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Conciliação de pagamentos, relatórios financeiros e exportações contábeis.',
    permissions: [
      'dashboard:view',
      ...allOf('financeiro', ['view', 'create', 'edit', 'approve', 'export']),
      'pedidos:view',
      'pedidos:approve',
      ...allOf('relatorios', ['view', 'export']),
      'clientes:view',
      'auditoria:view',
    ],
    system: true,
    active: true,
  },
  {
    id: 'marketing',
    label: 'Marketing & CRM',
    description: 'Campanhas, cupons, banners, roleta, clube de fidelidade e relacionamento.',
    permissions: [
      'dashboard:view',
      ...allOf('marketing', ['view', 'create', 'edit', 'publish', 'archive', 'restore', 'export']),
      ...allOf('crm', ['view', 'create', 'edit', 'export']),
      ...allOf('clube', ['view', 'create', 'edit', 'approve']),
      'clientes:view',
      'produtos:view',
      'relatorios:view',
    ],
    system: true,
    active: true,
  },
  {
    id: 'suporte',
    label: 'Suporte ao Cliente',
    description: 'Atendimento de chamados, consulta de pedidos e histórico do cliente.',
    permissions: [
      'dashboard:view',
      ...allOf('suporte', ['view', 'create', 'edit', 'approve', 'archive']),
      ...allOf('crm', ['view', 'create', 'edit']),
      'clientes:view',
      'clientes:edit',
      'pedidos:view',
      'clube:view',
    ],
    system: true,
    active: true,
  },
  {
    id: 'catalogo',
    label: 'Catálogo & Estoque',
    description: 'Cadastro de produtos, preços, imagens, categorias e controle de estoque.',
    permissions: [
      'dashboard:view',
      ...allOf('produtos', ['view', 'create', 'edit', 'archive', 'export']),
      ...allOf('estoque', ['view', 'create', 'edit', 'archive', 'export']),
      'relatorios:view',
    ],
    system: true,
    active: true,
  },
  {
    id: 'analista',
    label: 'Analista (Somente Leitura)',
    description: 'Acesso somente leitura a painéis e relatórios para análise de desempenho.',
    permissions: ['dashboard:view', 'relatorios:view'],
    system: true,
    active: true,
  },
];

export const DEFAULT_ROLES_BY_ID: Readonly<Record<string, RoleDefinition>> = Object.fromEntries(
  DEFAULT_ROLES.map((r) => [r.id, r]),
);

export function permissionsAllow(
  granted: readonly string[] | undefined | null,
  required: Permission | string,
): boolean {
  if (!granted || granted.length === 0) return false;
  if (granted.includes('*')) return true;
  if (granted.includes(required)) return true;
  const [mod] = required.split(':');
  if (mod && granted.includes(`${mod}:admin`)) return true;
  return false;
}

export function permissionsAllowAny(
  granted: readonly string[] | undefined | null,
  requiredList: readonly string[],
): boolean {
  if (!requiredList || requiredList.length === 0) return true;
  return requiredList.some((req) => permissionsAllow(granted, req));
}

export function getRoleLabel(roleId: string | null | undefined): string {
  if (!roleId) return 'Sem papel';
  return DEFAULT_ROLES_BY_ID[roleId]?.label ?? roleId;
}

export interface FrontendStaffAccess {
  uid: string;
  isStaff: boolean;
  roleId: string | null;
  permissions: PermissionOrWildcard[];
  isSuperadmin: boolean;
  legacy: boolean;
  status: 'active' | 'suspended' | 'archived' | 'none' | 'banned';
}

export const EMPTY_STAFF_ACCESS: FrontendStaffAccess = {
  uid: '',
  isStaff: false,
  roleId: null,
  permissions: [],
  isSuperadmin: false,
  legacy: false,
  status: 'none',
};

/**
 * Pure deterministic access resolver mirroring functions/src/admin/rbac.ts#resolveAccess.
 * Honors role_assignments/{uid} first (blocking suspended/archived staff even with stale claims)
 * and falls back to legacy admin role/claim when no assignment document exists.
 */
export function resolveFrontendStaffAccess(input: {
  uid: string;
  userRole?: string | null;
  tokenClaims?: Record<string, unknown> | null;
  assignmentDoc?: { roleId?: string; status?: string } | null;
  customRoleDoc?: { permissions?: string[]; active?: boolean } | null;
}): FrontendStaffAccess {
  const { uid, userRole, tokenClaims, assignmentDoc, customRoleDoc } = input;

  if (tokenClaims?.['banned'] === true || userRole === 'banned') {
    return {
      uid,
      isStaff: false,
      roleId: null,
      permissions: [],
      isSuperadmin: false,
      legacy: false,
      status: 'banned',
    };
  }

  if (assignmentDoc) {
    const rawStatus = assignmentDoc.status;
    const status: 'active' | 'suspended' | 'archived' =
      rawStatus === 'active' || rawStatus === 'suspended' || rawStatus === 'archived'
        ? rawStatus
        : 'suspended';
    const roleId = typeof assignmentDoc.roleId === 'string' ? assignmentDoc.roleId : null;

    if (status !== 'active' || !roleId) {
      return {
        uid,
        isStaff: false,
        roleId: null,
        permissions: [],
        isSuperadmin: false,
        legacy: false,
        status,
      };
    }

    let perms: PermissionOrWildcard[];
    if (roleId === 'superadmin') {
      perms = ['*'];
    } else if (customRoleDoc) {
      if (customRoleDoc.active === false) {
        perms = [];
      } else {
        perms = Array.isArray(customRoleDoc.permissions)
          ? (customRoleDoc.permissions as PermissionOrWildcard[])
          : [];
      }
    } else {
      const def = DEFAULT_ROLES_BY_ID[roleId];
      perms = def && def.active ? [...def.permissions] : [];
    }

    const isSuperadmin = roleId === 'superadmin' || perms.includes('*');
    return {
      uid,
      isStaff: perms.length > 0,
      roleId,
      permissions: isSuperadmin ? ['*'] : perms,
      isSuperadmin,
      legacy: false,
      status: 'active',
    };
  }

  const legacyAdmin = tokenClaims?.['admin'] === true || userRole === 'admin';
  if (legacyAdmin) {
    return {
      uid,
      isStaff: true,
      roleId: 'admin',
      permissions: [...DEFAULT_ROLES_BY_ID.admin.permissions],
      isSuperadmin: false,
      legacy: true,
      status: 'active',
    };
  }

  return {
    uid,
    isStaff: false,
    roleId: null,
    permissions: [],
    isSuperadmin: false,
    legacy: false,
    status: 'none',
  };
}

