import type {
  AgentRuleConfig,
  InboxMessageType,
  InboxPriority,
  InboxStatus,
  SystemAgentDefinition,
  SystemAgentId,
} from './types';

export const SYSTEM_AGENTS: readonly SystemAgentDefinition[] = [
  {
    id: 'ana_estoque',
    name: 'Ana Estoque',
    roleTitle: 'Secretária de Estoque',
    sector: 'Estoque e Inventário',
    iconName: 'Boxes',
    description:
      'Monitora estoque mínimo, risco de ruptura, giro acelerado, itens parados e divergências de movimentação.',
    accentColor: '#d97706',
    badgeBg: 'rgba(217, 119, 6, 0.12)',
    defaultActive: true,
    allowedDataSources: ['products', 'orders', 'stock_history'],
    insightTypes: ['alert', 'insight', 'task_suggestion'],
    allowedPriorities: ['informative', 'attention', 'important', 'critical'],
    minIntervalMinutes: 120,
    defaultThreshold: 5,
    suggestedActions: [
      'Criar tarefa de reposição',
      'Ajustar estoque mínimo',
      'Revisar disponibilidade de produto ativo sem estoque',
    ],
    forbiddenDirectActions: [
      'Alterar saldo de estoque diretamente',
      'Desativar produtos sem aprovação humana',
      'Alterar preços',
    ],
  },
  {
    id: 'bia_vendas',
    name: 'Bia Vendas',
    roleTitle: 'Analista de Vendas',
    sector: 'Vendas e Desempenho Comercial',
    iconName: 'TrendingUp',
    description:
      'Analisa produtos mais vendidos, quedas de venda, ticket médio, horários de pico, combos e desempenho por condomínio.',
    accentColor: '#0284c7',
    badgeBg: 'rgba(2, 132, 199, 0.12)',
    defaultActive: true,
    allowedDataSources: ['orders', 'products'],
    insightTypes: ['insight', 'task_suggestion', 'alert'],
    allowedPriorities: ['informative', 'attention', 'important'],
    minIntervalMinutes: 240,
    suggestedActions: [
      'Criar vitrine temática',
      'Montar combo promocional',
      'Investigar queda de vendas',
    ],
    forbiddenDirectActions: [
      'Alterar preços ou descontos',
      'Publicar campanhas sem aprovação humana',
    ],
  },
  {
    id: 'clara_entregas',
    name: 'Clara Entregas',
    roleTitle: 'Coordenadora de Entregas',
    sector: 'Logística e Entrega',
    iconName: 'Truck',
    description:
      'Acompanha prazo prometido vs. real, pedidos atrasados ou parados em rota, gargalos por condomínio e cancelamentos por demora.',
    accentColor: '#0d9488',
    badgeBg: 'rgba(13, 148, 136, 0.12)',
    defaultActive: true,
    allowedDataSources: ['orders', 'settings/admin', 'settings/shipping'],
    insightTypes: ['alert', 'insight', 'task_suggestion', 'incident'],
    allowedPriorities: ['informative', 'attention', 'important', 'critical'],
    minIntervalMinutes: 60,
    suggestedActions: [
      'Investigar atraso de entrega',
      'Revisar prazo prometido temporariamente',
      'Reforçar operação em horário crítico',
    ],
    forbiddenDirectActions: [
      'Alterar prazo prometido automaticamente',
      'Alterar taxa de entrega',
      'Cancelar pedidos',
    ],
  },
  {
    id: 'pedro_pedidos',
    name: 'Pedro Pedidos',
    roleTitle: 'Assistente de Pedidos',
    sector: 'Ciclo Completo de Pedidos',
    iconName: 'ShoppingBag',
    description:
      'Detecta pedidos pendentes há muito tempo, pagos sem confirmação, em separação travada, endereços inconsistentes e falhas de fluxo.',
    accentColor: '#4f46e5',
    badgeBg: 'rgba(79, 70, 229, 0.12)',
    defaultActive: true,
    allowedDataSources: ['orders', 'products'],
    insightTypes: ['alert', 'task_suggestion', 'incident'],
    allowedPriorities: ['attention', 'important', 'critical'],
    minIntervalMinutes: 45,
    suggestedActions: [
      'Confirmar/separar pedido parado',
      'Corrigir inconsistência de endereço com cliente',
      'Abrir tarefa operacional',
    ],
    forbiddenDirectActions: [
      'Cancelar pedido automaticamente',
      'Alterar status de pagamento ou valores',
    ],
  },
  {
    id: 'fabio_financeiro',
    name: 'Fábio Financeiro',
    roleTitle: 'Analista Financeiro',
    sector: 'Financeiro, Pagamentos e Conciliação',
    iconName: 'DollarSign',
    description:
      'Monitora faturamento, ticket médio, formas de pagamento, Pix pendentes/falhos, impacto de frete e produtos com baixa margem.',
    accentColor: '#059669',
    badgeBg: 'rgba(5, 150, 105, 0.12)',
    defaultActive: true,
    allowedDataSources: ['orders', 'products'],
    insightTypes: ['alert', 'insight', 'task_suggestion'],
    allowedPriorities: ['informative', 'attention', 'important', 'critical'],
    minIntervalMinutes: 120,
    suggestedActions: [
      'Conciliar pagamentos pendentes',
      'Revisar margem de item abaixo do mínimo',
      'Investigar divergência de valor',
    ],
    forbiddenDirectActions: [
      'Aprovar reembolso',
      'Alterar valores financeiros',
      'Confirmar pagamento sem aprovação humana',
    ],
  },
  {
    id: 'marina_produtos',
    name: 'Marina Produtos',
    roleTitle: 'Curadora de Produtos',
    sector: 'Catálogo e Qualidade',
    iconName: 'Package',
    description:
      'Audita produtos sem imagem ou inválida, sem preço, categorias incorretas, descrições curtas, duplicidades e itens ativos sem estoque.',
    accentColor: '#9333ea',
    badgeBg: 'rgba(147, 51, 234, 0.12)',
    defaultActive: true,
    allowedDataSources: ['products', 'categories'],
    insightTypes: ['insight', 'task_suggestion', 'alert'],
    allowedPriorities: ['informative', 'attention', 'important'],
    minIntervalMinutes: 360,
    suggestedActions: [
      'Atualizar imagem do produto',
      'Corrigir categoria ou descrição',
      'Revisar preço ou desativar item inconsistente',
    ],
    forbiddenDirectActions: [
      'Alterar preço ou margem',
      'Arquivar ou excluir produto sem aprovação humana',
    ],
  },
  {
    id: 'lucas_crm',
    name: 'Lucas CRM',
    roleTitle: 'Analista de Clientes',
    sector: 'Clientes e Relacionamento',
    iconName: 'Users',
    description:
      'Identifica novos clientes, recorrência, inatividade, crescimento por condomínio e oportunidades de reativação com minimização de PII.',
    accentColor: '#2563eb',
    badgeBg: 'rgba(37, 99, 235, 0.12)',
    defaultActive: true,
    allowedDataSources: ['users', 'orders'],
    insightTypes: ['insight', 'task_suggestion'],
    allowedPriorities: ['informative', 'attention', 'important'],
    minIntervalMinutes: 360,
    suggestedActions: [
      'Criar campanha de reativação',
      'Contatar grupo afetado por incidente',
    ],
    forbiddenDirectActions: [
      'Expor CPF, telefone ou dados sensíveis',
      'Enviar comunicação externa automática',
    ],
  },
  {
    id: 'sofia_marketing',
    name: 'Sofia Marketing',
    roleTitle: 'Assistente de Marketing',
    sector: 'Marketing, Vitrines e Campanhas',
    iconName: 'Megaphone',
    description:
      'Sugere destaques na Home, vitrines temáticas, campanhas sazonais e cruzamento de estoque disponível com desempenho comercial.',
    accentColor: '#db2777',
    badgeBg: 'rgba(219, 39, 119, 0.12)',
    defaultActive: true,
    allowedDataSources: ['products', 'orders', 'home-config'],
    insightTypes: ['insight', 'task_suggestion'],
    allowedPriorities: ['informative', 'attention', 'important'],
    minIntervalMinutes: 360,
    suggestedActions: [
      'Destacar produto na Home',
      'Criar banner ou vitrine temática',
      'Planejar campanha de categoria pouco acessada',
    ],
    forbiddenDirectActions: [
      'Publicar campanha ou alterar banners automaticamente',
      'Enviar notificações externas',
    ],
  },
  {
    id: 'rafael_compras',
    name: 'Rafael Compras',
    roleTitle: 'Assistente de Compras',
    sector: 'Compras, Fornecedores e Reposição',
    iconName: 'ClipboardList',
    description:
      'Cruza estoque, velocidade de venda, histórico de pedidos e cotações para sugerir listas de compra e negociações com fornecedores.',
    accentColor: '#b45309',
    badgeBg: 'rgba(180, 83, 9, 0.12)',
    defaultActive: true,
    allowedDataSources: ['products', 'orders', 'purchase_lists', 'suppliers', 'supplier_quotes'],
    insightTypes: ['task_suggestion', 'insight', 'alert'],
    allowedPriorities: ['informative', 'attention', 'important', 'critical'],
    minIntervalMinutes: 240,
    defaultThreshold: 5,
    suggestedActions: [
      'Revisar e aprovar lista de compra sugerida',
      'Negociar volume com fornecedor',
      'Ajustar estoque mínimo de reposição',
    ],
    forbiddenDirectActions: [
      'Aprovar lista de compra ou empenhar pagamento',
      'Alterar saldo de estoque',
    ],
  },
  {
    id: 'julia_qualidade',
    name: 'Júlia Qualidade',
    roleTitle: 'Supervisora de Qualidade',
    sector: 'Qualidade, Experiência e Incidentes',
    iconName: 'Award',
    description:
      'Agrupa reclamações, chamados de suporte, avaliações negativas e recorrência de problemas em produtos ou entregas.',
    accentColor: '#e11d48',
    badgeBg: 'rgba(225, 29, 72, 0.12)',
    defaultActive: true,
    allowedDataSources: ['support_tickets', 'orders', 'products'],
    insightTypes: ['alert', 'incident', 'task_suggestion'],
    allowedPriorities: ['attention', 'important', 'critical'],
    minIntervalMinutes: 120,
    suggestedActions: [
      'Investigar chamado recorrente',
      'Corrigir causa raiz operacional',
      'Contatar cliente afetado via Suporte',
    ],
    forbiddenDirectActions: [
      'Encerrar chamado ou reembolsar sem revisão humana',
    ],
  },
  {
    id: 'eduardo_sistema',
    name: 'Eduardo Sistema',
    roleTitle: 'Monitor Técnico',
    sector: 'Tecnologia, Disponibilidade e Segurança',
    iconName: 'Cpu',
    description:
      'Monitora falhas técnicas, erros de sincronização, listeners, uploads, Service Worker e tentativas negadas de permissão sem expor segredos.',
    accentColor: '#334155',
    badgeBg: 'rgba(51, 65, 85, 0.12)',
    defaultActive: true,
    allowedDataSources: ['audit_logs', 'support_tickets'],
    insightTypes: ['alert', 'incident', 'task_suggestion'],
    allowedPriorities: ['informative', 'attention', 'important', 'critical'],
    minIntervalMinutes: 60,
    suggestedActions: [
      'Investigar erro técnico recorrente',
      'Revisar permissões negadas suspeitas',
      'Validar saúde de listener/upload',
    ],
    forbiddenDirectActions: [
      'Alterar permissões ou papéis',
      'Expor tokens, credenciais, CPF ou segredos',
    ],
  },
] as const;

export const SYSTEM_AGENTS_BY_ID: Readonly<Record<SystemAgentId, SystemAgentDefinition>> =
  Object.fromEntries(SYSTEM_AGENTS.map((a) => [a.id, a])) as Record<
    SystemAgentId,
    SystemAgentDefinition
  >;

export function buildDefaultAgentRule(agentId: SystemAgentId): AgentRuleConfig {
  const def = SYSTEM_AGENTS_BY_ID[agentId];
  return {
    id: agentId,
    active: def.defaultActive,
    stockThreshold: def.defaultThreshold ?? 5,
    analysisWindowHours: 24,
    minIntervalMinutes: def.minIntervalMinutes,
    defaultPriority: def.allowedPriorities.includes('attention') ? 'attention' : 'informative',
    toAll: true,
    defaultRecipientIds: [],
    autoCreateTaskOnCritical: false,
    isCriticalAgent: def.allowedPriorities.includes('critical'),
    mutedKeys: [],
    lastExecutedAt: null,
  };
}

export const INBOX_PRIORITY_META: Record<
  InboxPriority,
  { label: string; color: string; bg: string; border: string; iconLabel: string }
> = {
  informative: {
    label: 'Informativa',
    color: '#0369a1',
    bg: 'rgba(14, 165, 233, 0.10)',
    border: 'rgba(14, 165, 233, 0.30)',
    iconLabel: 'INFO',
  },
  attention: {
    label: 'Atenção',
    color: '#b45309',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
    iconLabel: 'ATENÇÃO',
  },
  important: {
    label: 'Importante',
    color: '#c2410c',
    bg: 'rgba(234, 88, 12, 0.12)',
    border: 'rgba(234, 88, 12, 0.35)',
    iconLabel: 'IMPORTANTE',
  },
  critical: {
    label: 'Crítica',
    color: '#b91c1c',
    bg: 'rgba(239, 68, 68, 0.14)',
    border: 'rgba(239, 68, 68, 0.45)',
    iconLabel: 'CRÍTICA',
  },
};

export const INBOX_STATUS_LABELS: Record<InboxStatus, string> = {
  new: 'Nova',
  read: 'Lida',
  in_review: 'Em análise',
  awaiting_reply: 'Aguardando resposta',
  in_discussion: 'Em discussão',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  converted_to_task: 'Convertida em tarefa',
  in_progress: 'Em execução',
  resolved: 'Resolvida',
  archived: 'Arquivada',
};

export const INBOX_TYPE_LABELS: Record<InboxMessageType, string> = {
  message: 'Mensagem',
  note: 'Nota interna',
  alert: 'Alerta',
  insight: 'Insight',
  task_suggestion: 'Sugestão de tarefa',
  decision: 'Decisão',
  incident: 'Incidente',
  announcement: 'Comunicado',
};

