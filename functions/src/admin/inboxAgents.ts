import * as admin from 'firebase-admin';

export type SystemAgentId =
  | 'ana_estoque'
  | 'bia_vendas'
  | 'clara_entregas'
  | 'pedro_pedidos'
  | 'fabio_financeiro'
  | 'marina_produtos'
  | 'lucas_crm'
  | 'sofia_marketing'
  | 'rafael_compras'
  | 'julia_qualidade'
  | 'eduardo_sistema';

export type InboxPriority = 'informative' | 'attention' | 'important' | 'critical';
export type InboxMessageType =
  | 'message'
  | 'note'
  | 'alert'
  | 'insight'
  | 'task_suggestion'
  | 'decision'
  | 'incident'
  | 'announcement';

export interface BackendAgentRuleConfig {
  id: SystemAgentId;
  active: boolean;
  stockThreshold: number;
  analysisWindowHours: number;
  minIntervalMinutes: number;
  defaultPriority: InboxPriority;
  toAll: boolean;
  defaultRecipientIds: string[];
  suggestedAssigneeUid?: string;
  autoCreateTaskOnCritical: boolean;
  isCriticalAgent: boolean;
  mutedKeys: string[];
  lastExecutedAt?: admin.firestore.Timestamp | null;
}

export interface AgentMetadata {
  id: SystemAgentId;
  name: string;
  roleTitle: string;
  sector: string;
  defaultThreshold: number;
  minIntervalMinutes: number;
  isCriticalAgent: boolean;
}

export const BACKEND_AGENTS: Record<SystemAgentId, AgentMetadata> = {
  ana_estoque: {
    id: 'ana_estoque',
    name: 'Ana Estoque',
    roleTitle: 'Secretária de Estoque',
    sector: 'Estoque e Inventário',
    defaultThreshold: 5,
    minIntervalMinutes: 120,
    isCriticalAgent: true,
  },
  bia_vendas: {
    id: 'bia_vendas',
    name: 'Bia Vendas',
    roleTitle: 'Analista de Vendas',
    sector: 'Vendas e Desempenho Comercial',
    defaultThreshold: 5,
    minIntervalMinutes: 240,
    isCriticalAgent: false,
  },
  clara_entregas: {
    id: 'clara_entregas',
    name: 'Clara Entregas',
    roleTitle: 'Coordenadora de Entregas',
    sector: 'Logística e Entrega',
    defaultThreshold: 45,
    minIntervalMinutes: 60,
    isCriticalAgent: true,
  },
  pedro_pedidos: {
    id: 'pedro_pedidos',
    name: 'Pedro Pedidos',
    roleTitle: 'Assistente de Pedidos',
    sector: 'Ciclo Completo de Pedidos',
    defaultThreshold: 30,
    minIntervalMinutes: 45,
    isCriticalAgent: true,
  },
  fabio_financeiro: {
    id: 'fabio_financeiro',
    name: 'Fábio Financeiro',
    roleTitle: 'Analista Financeiro',
    sector: 'Financeiro, Pagamentos e Conciliação',
    defaultThreshold: 2,
    minIntervalMinutes: 120,
    isCriticalAgent: true,
  },
  marina_produtos: {
    id: 'marina_produtos',
    name: 'Marina Produtos',
    roleTitle: 'Curadora de Produtos',
    sector: 'Catálogo e Qualidade',
    defaultThreshold: 1,
    minIntervalMinutes: 360,
    isCriticalAgent: false,
  },
  lucas_crm: {
    id: 'lucas_crm',
    name: 'Lucas CRM',
    roleTitle: 'Analista de Clientes',
    sector: 'Clientes e Relacionamento',
    defaultThreshold: 14,
    minIntervalMinutes: 360,
    isCriticalAgent: false,
  },
  sofia_marketing: {
    id: 'sofia_marketing',
    name: 'Sofia Marketing',
    roleTitle: 'Assistente de Marketing',
    sector: 'Marketing, Vitrines e Campanhas',
    defaultThreshold: 5,
    minIntervalMinutes: 360,
    isCriticalAgent: false,
  },
  rafael_compras: {
    id: 'rafael_compras',
    name: 'Rafael Compras',
    roleTitle: 'Assistente de Compras',
    sector: 'Compras, Fornecedores e Reposição',
    defaultThreshold: 5,
    minIntervalMinutes: 240,
    isCriticalAgent: true,
  },
  julia_qualidade: {
    id: 'julia_qualidade',
    name: 'Júlia Qualidade',
    roleTitle: 'Supervisora de Qualidade',
    sector: 'Qualidade, Experiência e Incidentes',
    defaultThreshold: 1,
    minIntervalMinutes: 120,
    isCriticalAgent: true,
  },
  eduardo_sistema: {
    id: 'eduardo_sistema',
    name: 'Eduardo Sistema',
    roleTitle: 'Monitor Técnico',
    sector: 'Tecnologia, Disponibilidade e Segurança',
    defaultThreshold: 3,
    minIntervalMinutes: 60,
    isCriticalAgent: true,
  },
};

export interface GeneratedInsightProposal {
  agentId: SystemAgentId;
  type: InboxMessageType;
  priority: InboxPriority;
  subject: string;
  body: string;
  sourceEvent: string;
  sourceEntityId?: string;
  deduplicationKey: string;
  requiresApproval: boolean;
  relatedEntities: Array<{
    type:
      | 'product'
      | 'order'
      | 'customer'
      | 'purchase_list'
      | 'supplier'
      | 'quote'
      | 'report'
      | 'task'
      | 'ticket'
      | 'campaign';
    id: string;
    label: string;
    snapshot?: { name?: string; number?: string; status?: string };
  }>;
  insightDetails: {
    observedFact: string;
    dataUsed: string;
    interpretation: string;
    suggestion: string;
    confidence: 'high' | 'medium' | 'low';
    requiresHumanApproval: boolean;
    analyzedPeriod: string;
    metricsSummary?: Record<string, string | number>;
    ruleVersion: string;
  };
  suggestedTask?: {
    title: string;
    description: string;
    reason: string;
    suggestedAssigneeLabel?: string;
    priority: InboxPriority;
    dueDays?: number;
    checklist: string[];
    estimatedImpact?: string;
    status: 'pending';
  };
}

export function defaultBackendRule(agentId: SystemAgentId): BackendAgentRuleConfig {
  const meta = BACKEND_AGENTS[agentId];
  return {
    id: agentId,
    active: true,
    stockThreshold: meta.defaultThreshold,
    analysisWindowHours: 24,
    minIntervalMinutes: meta.minIntervalMinutes,
    defaultPriority: 'attention',
    toAll: true,
    defaultRecipientIds: [],
    autoCreateTaskOnCritical: false,
    isCriticalAgent: meta.isCriticalAgent,
    mutedKeys: [],
    lastExecutedAt: null,
  };
}

function toMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'object' && typeof (val as { toDate?: unknown }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof val === 'string') {
    const t = Date.parse(val);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/**
 * Redacts PII (CPF, phone, tokens) from any diagnostic snippet generated by agents.
 */
export function redactAgentText(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email protegido]')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF protegido]')
    .replace(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\b\d{4,5}-?\d{4}\b/g, '[telefone protegido]')
    .replace(/\b(?:https?|javascript|vbscript):\/\/[^\s]+|\b(?:javascript|vbscript):[^\s]+/gi, '[url removida]')
    .replace(/\b(?:Bearer\s+[A-Za-z0-9._-]+|AIza[0-9A-Za-z_-]{20,}|sk_[A-Za-z0-9_]{16,})\b/g, '[credencial protegida]');
}

/**
 * Checks whether a deduplicationKey is within the cooldown window or muted.
 */
export function shouldDeduplicate(
  existingDoc: { updatedAt?: unknown; createdAt?: unknown } | null,
  minIntervalMinutes: number,
  mutedKeys: readonly string[],
  deduplicationKey: string,
  nowMs = Date.now(),
): { skip: boolean; updateExisting: boolean } {
  if (mutedKeys.includes(deduplicationKey)) {
    return { skip: true, updateExisting: false };
  }
  if (!existingDoc) {
    return { skip: false, updateExisting: false };
  }
  const lastMs = Math.max(toMs(existingDoc.updatedAt), toMs(existingDoc.createdAt));
  if (lastMs > 0 && nowMs - lastMs < minIntervalMinutes * 60_000) {
    return { skip: true, updateExisting: true };
  }
  return { skip: false, updateExisting: true };
}

/**
 * Runs a single systemic agent against real Firestore collections.
 * Never invents metrics: returns `[]` if there is insufficient data or nothing actionable.
 */
export async function evaluateAgentInsights(
  db: admin.firestore.Firestore,
  agentId: SystemAgentId,
  rule: BackendAgentRuleConfig,
  nowMs = Date.now(),
): Promise<GeneratedInsightProposal[]> {
  const proposals: GeneratedInsightProposal[] = [];
  const windowHours = Math.max(1, Math.min(rule.analysisWindowHours || 24, 720));
  const cutoffMs = nowMs - windowHours * 3600_000;
  const periodLabel = `Últimas ${windowHours}h`;

  if (agentId === 'ana_estoque') {
    const prodSnap = await db.collection('products').limit(250).get();
    if (prodSnap.empty) return proposals;

    const zeroStock: Array<{ id: string; title: string }> = [];
    const lowStock: Array<{ id: string; title: string; stock: number; minStock: number }> = [];

    for (const d of prodSnap.docs) {
      const p = d.data() as { active?: boolean; title?: string; stock?: unknown; minStock?: unknown };
      if (p.active === false) continue;
      const title = String(p.title || d.id);
      const stock = Number(p.stock ?? 0);
      const minStock = Number(p.minStock ?? rule.stockThreshold ?? 5);
      if (stock <= 0) zeroStock.push({ id: d.id, title });
      else if (stock <= minStock) lowStock.push({ id: d.id, title, stock, minStock });
    }

    if (zeroStock.length > 0) {
      const sample = zeroStock.slice(0, 5);
      proposals.push({
        agentId,
        type: 'alert',
        priority: zeroStock.length >= 3 ? 'critical' : 'important',
        subject: `Risco de ruptura: ${zeroStock.length} produto(s) ativo(s) sem estoque`,
        body: [
          `Fato observado: foram identificados ${zeroStock.length} produto(s) ativo(s) no catálogo com estoque zerado.`,
          '',
          `Itens em destaque: ${sample.map((s) => s.title).join(', ')}.`,
          '',
          'Sugestão: revisar necessidade de reposição imediata ou pausar temporariamente os itens indisponíveis.',
        ].join('\n'),
        sourceEvent: 'stock_zero_active_products',
        deduplicationKey: `ana_estoque:zero_stock:${new Date(nowMs).toISOString().slice(0, 10)}`,
        requiresApproval: true,
        relatedEntities: sample.map((s) => ({
          type: 'product',
          id: s.id,
          label: s.title,
          snapshot: { name: s.title, status: 'sem_estoque' },
        })),
        insightDetails: {
          observedFact: `${zeroStock.length} produto(s) ativo(s) estão com saldo 0 na coleção products.`,
          dataUsed: `Leitura de ${prodSnap.size} documento(s) em products.`,
          interpretation: 'Produtos ativos com saldo zero geram frustração na compra e risco de ruptura operacional.',
          suggestion: 'Abrir tarefa de reposição para compras ou revisar ativação dos itens.',
          confidence: 'high',
          requiresHumanApproval: true,
          analyzedPeriod: 'Estado atual do catálogo',
          metricsSummary: { 'Ativos sem estoque': zeroStock.length, 'Estoque mínimo base': rule.stockThreshold },
          ruleVersion: '1.0.0',
        },
        suggestedTask: {
          title: `Repor ${zeroStock.length} item(ns) ativo(s) sem estoque`,
          description: `Avaliar reposição urgente ou pausa de catálogo para: ${sample.map((s) => s.title).join(', ')}.`,
          reason: 'Produtos ativos sem saldo impedem vendas imediatas.',
          suggestedAssigneeLabel: 'Responsável por Compras',
          priority: zeroStock.length >= 3 ? 'critical' : 'important',
          dueDays: 1,
          checklist: [
            'Conferir saldo físico na prateleira',
            'Acionar fornecedor ou Assistente de Compras',
            'Pausar item se não houver reposição imediata',
          ],
          estimatedImpact: 'Evita ruptura e perda de vendas no condomínio',
          status: 'pending',
        },
      });
    } else if (lowStock.length > 0) {
      const sample = lowStock.slice(0, 5);
      proposals.push({
        agentId,
        type: 'task_suggestion',
        priority: 'attention',
        subject: `Estoque baixo em ${lowStock.length} produto(s)`,
        body: [
          `Fato observado: ${lowStock.length} produto(s) ativo(s) atingiram ou ficaram abaixo do estoque mínimo (${rule.stockThreshold} un.).`,
          '',
          sample.map((s) => `• ${s.title}: ${s.stock} un. (mín. ${s.minStock})`).join('\n'),
          '',
          'Sugestão: programar reposição preventiva antes que o saldo chegue a zero.',
        ].join('\n'),
        sourceEvent: 'stock_below_min',
        deduplicationKey: `ana_estoque:low_stock:${new Date(nowMs).toISOString().slice(0, 10)}`,
        requiresApproval: true,
        relatedEntities: sample.map((s) => ({
          type: 'product',
          id: s.id,
          label: `${s.title} (${s.stock} un.)`,
          snapshot: { name: s.title, status: `${s.stock} un.` },
        })),
        insightDetails: {
          observedFact: `${lowStock.length} produto(s) estão com saldo <= estoque mínimo configurado.`,
          dataUsed: `Leitura de ${prodSnap.size} documento(s) em products.`,
          interpretation: 'Tendência de esgotamento caso haja pico de pedidos no condomínio.',
          suggestion: 'Revisar lote mínimo e incluir na próxima lista de compras.',
          confidence: 'high',
          requiresHumanApproval: true,
          analyzedPeriod: 'Estado atual do catálogo',
          metricsSummary: { 'Abaixo do mínimo': lowStock.length },
          ruleVersion: '1.0.0',
        },
        suggestedTask: {
          title: `Planejar reposição de ${lowStock.length} item(ns) com estoque baixo`,
          description: sample.map((s) => `${s.title}: ${s.stock} un.`).join('; '),
          reason: 'Saldo abaixo do limite de segurança configurado.',
          suggestedAssigneeLabel: 'Responsável por Compras',
          priority: 'attention',
          dueDays: 2,
          checklist: ['Verificar giro dos últimos 7 dias', 'Gerar cotação/lista de compra'],
          status: 'pending',
        },
      });
    }
    return proposals;
  }

  if (agentId === 'pedro_pedidos') {
    const ordersSnap = await db.collection('orders').orderBy('createdAt', 'desc').limit(120).get();
    if (ordersSnap.empty) return proposals;

    const stalePending: Array<{ id: string; num: string }> = [];
    const awaitingPix: Array<{ id: string; num: string }> = [];
    const ageCutoffMs = nowMs - Math.max(15, rule.stockThreshold || 30) * 60_000;

    for (const d of ordersSnap.docs) {
      const o = d.data() as { status?: string; paymentStatus?: string; createdAt?: unknown; orderNumber?: string };
      const createdMs = toMs(o.createdAt);
      const num = String(o.orderNumber || d.id.slice(0, 8).toUpperCase());
      if (o.status === 'pending' && createdMs > 0 && createdMs < ageCutoffMs) {
        stalePending.push({ id: d.id, num });
      }
      if (o.status !== 'cancelled' && o.paymentStatus === 'awaiting_confirmation' && createdMs > 0 && createdMs < ageCutoffMs) {
        awaitingPix.push({ id: d.id, num });
      }
    }

    if (stalePending.length > 0 || awaitingPix.length > 0) {
      const refs = [...stalePending, ...awaitingPix].slice(0, 6);
      const isCrit = stalePending.length + awaitingPix.length >= 3;
      proposals.push({
        agentId,
        type: 'alert',
        priority: isCrit ? 'critical' : 'important',
        subject: `Pedidos aguardando atenção (${stalePending.length} pendentes / ${awaitingPix.length} Pix sem confirmação)`,
        body: [
          `Fato observado: há ${stalePending.length} pedido(s) pendente(s) e ${awaitingPix.length} pedido(s) aguardando confirmação Pix há mais de ${rule.stockThreshold || 30} minutos.`,
          '',
          `Pedidos: ${refs.map((r) => `#${r.num}`).join(', ')}.`,
          '',
          'Sugestão: priorizar verificação operacional e confirmação de pagamento.',
        ].join('\n'),
        sourceEvent: 'orders_stalled_or_unconfirmed',
        deduplicationKey: `pedro_pedidos:stalled:${new Date(nowMs).toISOString().slice(0, 13)}`,
        requiresApproval: true,
        relatedEntities: refs.map((r) => ({
          type: 'order',
          id: r.id,
          label: `Pedido #${r.num}`,
          snapshot: { number: r.num, status: 'pendente' },
        })),
        insightDetails: {
          observedFact: `${stalePending.length} pedido(s) pendentes e ${awaitingPix.length} aguardando Pix excederam o tempo limite.`,
          dataUsed: `Amostra dos últimos ${ordersSnap.size} pedidos em orders.`,
          interpretation: 'Acúmulo na fila inicial atrasa separação e eleva risco de cancelamento.',
          suggestion: 'Confirmar Pix recebidos e avançar pedidos confirmados para separação.',
          confidence: 'high',
          requiresHumanApproval: true,
          analyzedPeriod: periodLabel,
          metricsSummary: { 'Pendentes atrasados': stalePending.length, 'Pix pendentes': awaitingPix.length },
          ruleVersion: '1.0.0',
        },
        suggestedTask: {
          title: 'Despachar fila de pedidos parados / confirmar Pix',
          description: `Verificar pedidos: ${refs.map((r) => `#${r.num}`).join(', ')}.`,
          reason: 'Tempo em fila acima do limite operacional.',
          suggestedAssigneeLabel: 'Operações',
          priority: isCrit ? 'critical' : 'important',
          dueDays: 0,
          checklist: ['Conferir comprovantes Pix', 'Mover pedidos confirmados para preparação'],
          status: 'pending',
        },
      });
    }
    return proposals;
  }

  if (agentId === 'clara_entregas') {
    const ordersSnap = await db.collection('orders').orderBy('createdAt', 'desc').limit(120).get();
    if (ordersSnap.empty) return proposals;

    const delayedDelivering: Array<{ id: string; num: string; condo: string }> = [];
    const cutoffDeliveryMs = nowMs - Math.max(20, rule.stockThreshold || 45) * 60_000;

    for (const d of ordersSnap.docs) {
      const o = d.data() as {
        status?: string;
        updatedAt?: unknown;
        createdAt?: unknown;
        orderNumber?: string;
        address?: { condominio?: string };
      };
      if (o.status === 'delivering' || o.status === 'preparing') {
        const refMs = toMs(o.updatedAt) || toMs(o.createdAt);
        if (refMs > 0 && refMs < cutoffDeliveryMs) {
          delayedDelivering.push({
            id: d.id,
            num: String(o.orderNumber || d.id.slice(0, 8).toUpperCase()),
            condo: String(o.address?.condominio || 'Condomínio não informado'),
          });
        }
      }
    }

    if (delayedDelivering.length > 0) {
      proposals.push({
        agentId,
        type: 'alert',
        priority: delayedDelivering.length >= 3 ? 'critical' : 'important',
        subject: `Atenção logística: ${delayedDelivering.length} entrega(s) sem atualização recente`,
        body: [
          `Fato observado: ${delayedDelivering.length} pedido(s) em preparação ou em rota estão sem atualização há mais de ${rule.stockThreshold || 45} min.`,
          '',
          delayedDelivering.slice(0, 5).map((x) => `• Pedido #${x.num} — ${x.condo}`).join('\n'),
          '',
          'Sugestão: verificar status junto ao entregador e atualizar o cliente caso necessário.',
        ].join('\n'),
        sourceEvent: 'delivery_delayed',
        deduplicationKey: `clara_entregas:delayed:${new Date(nowMs).toISOString().slice(0, 13)}`,
        requiresApproval: true,
        relatedEntities: delayedDelivering.slice(0, 5).map((x) => ({
          type: 'order',
          id: x.id,
          label: `Pedido #${x.num}`,
          snapshot: { number: x.num, status: 'em_rota' },
        })),
        insightDetails: {
          observedFact: `${delayedDelivering.length} pedido(s) em preparo/entrega ultrapassaram ${rule.stockThreshold || 45} minutos sem atualização.`,
          dataUsed: `Últimos ${ordersSnap.size} pedidos em orders.`,
          interpretation: 'Possível gargalo de entrega ou esquecimento de baixa de status.',
          suggestion: 'Confirmar entregas concluídas e verificar necessidade de ajuste de prazo.',
          confidence: 'high',
          requiresHumanApproval: true,
          analyzedPeriod: periodLabel,
          metricsSummary: { 'Entregas em alerta': delayedDelivering.length },
          ruleVersion: '1.0.0',
        },
        suggestedTask: {
          title: 'Investigar entregas em atraso / sem atualização',
          description: delayedDelivering.slice(0, 5).map((x) => `#${x.num} (${x.condo})`).join(', '),
          reason: 'Prevenir atraso percebido pelo morador.',
          suggestedAssigneeLabel: 'Operações / Logística',
          priority: delayedDelivering.length >= 3 ? 'critical' : 'important',
          dueDays: 0,
          checklist: ['Checar entregador responsável', 'Atualizar status para Entregue se concluído'],
          status: 'pending',
        },
      });
    }
    return proposals;
  }

  if (agentId === 'bia_vendas' || agentId === 'fabio_financeiro') {
    const ordersSnap = await db.collection('orders').orderBy('createdAt', 'desc').limit(150).get();
    if (ordersSnap.empty) return proposals;

    let validCount = 0;
    let totalRevenue = 0;
    let cancelledCount = 0;
    let pendingPixTotal = 0;
    const byPayment: Record<string, number> = {};

    for (const d of ordersSnap.docs) {
      const o = d.data() as {
        status?: string;
        paymentStatus?: string;
        paymentMethod?: string;
        total?: unknown;
        createdAt?: unknown;
      };
      const ms = toMs(o.createdAt);
      if (ms > 0 && ms < cutoffMs) continue;
      const val = Number(o.total ?? 0);
      if (o.status === 'cancelled') {
        cancelledCount++;
      } else {
        validCount++;
        totalRevenue += Number.isFinite(val) ? val : 0;
        const pm = String(o.paymentMethod || 'Outro');
        byPayment[pm] = (byPayment[pm] ?? 0) + 1;
        if (o.paymentStatus === 'awaiting_confirmation' || o.paymentStatus === 'pending') {
          pendingPixTotal += Number.isFinite(val) ? val : 0;
        }
      }
    }

    if (validCount === 0 && cancelledCount === 0) return proposals;
    const avgTicket = validCount > 0 ? totalRevenue / validCount : 0;

    if (agentId === 'bia_vendas') {
      proposals.push({
        agentId,
        type: 'insight',
        priority: 'informative',
        subject: `Resumo comercial (${periodLabel}): ${validCount} pedido(s) e ticket médio de R$ ${avgTicket.toFixed(2)}`,
        body: [
          `Fato observado: nas ${periodLabel.toLowerCase()}, foram contabilizados ${validCount} pedido(s) válidos (R$ ${totalRevenue.toFixed(2)}) e ${cancelledCount} cancelado(s).`,
          `Ticket médio calculado: R$ ${avgTicket.toFixed(2)}.`,
          '',
          'Sugestão: utilizar os itens mais pedidos para montar combos promocionais no período.',
        ].join('\n'),
        sourceEvent: 'sales_period_summary',
        deduplicationKey: `bia_vendas:summary:${new Date(nowMs).toISOString().slice(0, 10)}`,
        requiresApproval: false,
        relatedEntities: [{ type: 'report', id: 'sales_summary', label: 'Relatórios & BI' }],
        insightDetails: {
          observedFact: `${validCount} pedido(s) válidos somando R$ ${totalRevenue.toFixed(2)}.`,
          dataUsed: `Pedidos recentes dentro da janela de ${windowHours}h.`,
          interpretation: validCount < 3 ? 'Volume ainda baixo na janela analisada para inferir tendência forte.' : 'Base suficiente para acompanhamento diário de ticket médio.',
          suggestion: 'Avaliar campanhas de combo para elevar o ticket médio.',
          confidence: validCount >= 5 ? 'high' : 'medium',
          requiresHumanApproval: true,
          analyzedPeriod: periodLabel,
          metricsSummary: {
            Pedidos: validCount,
            Cancelados: cancelledCount,
            Faturamento: `R$ ${totalRevenue.toFixed(2)}`,
            'Ticket Médio': `R$ ${avgTicket.toFixed(2)}`,
          },
          ruleVersion: '1.0.0',
        },
      });
    } else if (pendingPixTotal > 0 || cancelledCount >= (rule.stockThreshold || 2)) {
      proposals.push({
        agentId,
        type: 'alert',
        priority: pendingPixTotal > 200 ? 'important' : 'attention',
        subject: `Conciliação financeira: R$ ${pendingPixTotal.toFixed(2)} aguardando confirmação`,
        body: [
          `Fato observado: existem R$ ${pendingPixTotal.toFixed(2)} em pedidos não cancelados com pagamento pendente/aguardando confirmação (${periodLabel.toLowerCase()}).`,
          `Meios registrados: ${Object.entries(byPayment).map(([k, v]) => `${k}: ${v}`).join(', ') || 'sem dados'}.`,
          '',
          'Lembrete: nenhuma baixa financeira ou reembolso é executado sem aprovação humana autorizada.',
        ].join('\n'),
        sourceEvent: 'finance_pending_conciliation',
        deduplicationKey: `fabio_financeiro:pending:${new Date(nowMs).toISOString().slice(0, 10)}`,
        requiresApproval: true,
        relatedEntities: [{ type: 'report', id: 'finance_conciliation', label: 'Financeiro & Pix' }],
        insightDetails: {
          observedFact: `R$ ${pendingPixTotal.toFixed(2)} em pedidos com status de pagamento pendente.`,
          dataUsed: `Pedidos reais dentro da janela de ${windowHours}h.`,
          interpretation: 'Valores pendentes podem representar Pix aguardando conferência no extrato bancário.',
          suggestion: 'Conferir extrato bancário e confirmar ou cancelar pedidos expirados manualmente.',
          confidence: 'high',
          requiresHumanApproval: true,
          analyzedPeriod: periodLabel,
          metricsSummary: {
            'Pendente conciliação': `R$ ${pendingPixTotal.toFixed(2)}`,
            'Cancelamentos no período': cancelledCount,
          },
          ruleVersion: '1.0.0',
        },
        suggestedTask: {
          title: 'Conciliar pagamentos pendentes no Financeiro',
          description: `Conferir R$ ${pendingPixTotal.toFixed(2)} pendentes no extrato Pix.`,
          reason: 'Garantir conciliação diária de caixa.',
          suggestedAssigneeLabel: 'Financeiro',
          priority: 'attention',
          dueDays: 1,
          checklist: ['Abrir aba Financeiro & Pix', 'Conferir comprovantes no banco', 'Aprovar pagamentos confirmados'],
          status: 'pending',
        },
      });
    }
    return proposals;
  }

  if (agentId === 'marina_produtos') {
    const prodSnap = await db.collection('products').limit(250).get();
    if (prodSnap.empty) return proposals;

    const issues: Array<{ id: string; title: string; problem: string }> = [];
    for (const d of prodSnap.docs) {
      const p = d.data() as { active?: boolean; title?: string; image?: string; price?: unknown; category?: string };
      if (p.active === false) continue;
      const title = String(p.title || d.id);
      const price = Number(p.price ?? 0);
      const img = String(p.image || '').trim();
      if (!img) issues.push({ id: d.id, title, problem: 'sem imagem' });
      else if (!Number.isFinite(price) || price <= 0) issues.push({ id: d.id, title, problem: 'sem preço válido' });
      else if (!String(p.category || '').trim()) issues.push({ id: d.id, title, problem: 'sem categoria' });
    }

    if (issues.length > 0) {
      const sample = issues.slice(0, 6);
      proposals.push({
        agentId,
        type: 'insight',
        priority: 'attention',
        subject: `Curadoria de catálogo: ${issues.length} produto(s) com cadastro incompleto`,
        body: [
          `Fato observado: foram encontrados ${issues.length} produto(s) ativo(s) com pendências de qualidade cadastral.`,
          '',
          sample.map((i) => `• ${i.title}: ${i.problem}`).join('\n'),
          '',
          'Sugestão: revisar e completar os cadastros antes de promover os itens na Home.',
        ].join('\n'),
        sourceEvent: 'catalog_quality_gaps',
        deduplicationKey: `marina_produtos:quality:${new Date(nowMs).toISOString().slice(0, 10)}`,
        requiresApproval: true,
        relatedEntities: sample.map((i) => ({
          type: 'product',
          id: i.id,
          label: `${i.title} (${i.problem})`,
          snapshot: { name: i.title, status: i.problem },
        })),
        insightDetails: {
          observedFact: `${issues.length} produto(s) ativo(s) estão sem imagem, preço válido ou categoria.`,
          dataUsed: `Auditoria sobre ${prodSnap.size} produto(s) em products.`,
          interpretation: 'Cadastros incompletos reduzem conversão e comprometem a apresentação das vitrines.',
          suggestion: 'Corrigir ficha técnica e imagem dos produtos listados.',
          confidence: 'high',
          requiresHumanApproval: true,
          analyzedPeriod: 'Catálogo atual',
          metricsSummary: { 'Itens com pendência': issues.length },
          ruleVersion: '1.0.0',
        },
        suggestedTask: {
          title: `Completar cadastro de ${issues.length} produto(s)`,
          description: sample.map((i) => `${i.title} (${i.problem})`).join('; '),
          reason: 'Manter padrão visual e cadastral da loja.',
          suggestedAssigneeLabel: 'Catálogo',
          priority: 'attention',
          dueDays: 3,
          checklist: ['Inserir imagem otimizada', 'Validar preço e categoria'],
          status: 'pending',
        },
      });
    }
    return proposals;
  }

  if (agentId === 'rafael_compras') {
    const [prodSnap, listsSnap] = await Promise.all([
      db.collection('products').limit(250).get(),
      db.collection('purchase_lists').orderBy('createdAt', 'desc').limit(10).get(),
    ]);
    const needRestock: Array<{ id: string; title: string; stock: number }> = [];
    for (const d of prodSnap.docs) {
      const p = d.data() as { active?: boolean; title?: string; stock?: unknown; minStock?: unknown };
      if (p.active === false) continue;
      const stock = Number(p.stock ?? 0);
      const minStock = Number(p.minStock ?? rule.stockThreshold ?? 5);
      if (stock <= minStock) {
        needRestock.push({ id: d.id, title: String(p.title || d.id), stock });
      }
    }

    if (needRestock.length > 0) {
      const sample = needRestock.slice(0, 6);
      const latestList = listsSnap.docs[0];
      const refs: GeneratedInsightProposal['relatedEntities'] = sample.map((s) => ({
        type: 'product',
        id: s.id,
        label: `${s.title} (${s.stock} un.)`,
        snapshot: { name: s.title, status: `${s.stock} un.` },
      }));
      if (latestList) {
        refs.unshift({
          type: 'purchase_list',
          id: latestList.id,
          label: `Lista de Compra: ${String((latestList.data() as { title?: string }).title || latestList.id.slice(0, 8))}`,
        });
      }

      proposals.push({
        agentId,
        type: 'task_suggestion',
        priority: needRestock.length >= 5 ? 'important' : 'attention',
        subject: `Sugestão de reposição para ${needRestock.length} produto(s)`,
        body: [
          `Fato observado: ${needRestock.length} produto(s) estão no ponto de reposição (saldo <= mínimo).`,
          '',
          sample.map((s) => `• ${s.title}: ${s.stock} un.`).join('\n'),
          '',
          'Sugestão de tarefa: revisar e aprovar uma lista de compra no Assistente de Compras.',
        ].join('\n'),
        sourceEvent: 'purchasing_restock_suggestion',
        deduplicationKey: `rafael_compras:restock:${new Date(nowMs).toISOString().slice(0, 10)}`,
        requiresApproval: true,
        relatedEntities: refs,
        insightDetails: {
          observedFact: `${needRestock.length} produto(s) com saldo baixo ou zerado.`,
          dataUsed: `Leitura de ${prodSnap.size} produto(s) e ${listsSnap.size} lista(s) recente(s).`,
          interpretation: 'Necessidade de cotação e emissão de pedido ao fornecedor.',
          suggestion: 'Consolidar compra no Assistente de Compras respeitando alçada de aprovação.',
          confidence: 'high',
          requiresHumanApproval: true,
          analyzedPeriod: 'Estoque atual',
          metricsSummary: { 'Itens para reposição': needRestock.length },
          ruleVersion: '1.0.0',
        },
        suggestedTask: {
          title: `Revisar e aprovar lista de compra (${needRestock.length} itens)`,
          description: `Avaliar compra para: ${sample.map((s) => s.title).join(', ')}.`,
          reason: 'Evitar falta de produtos recorrentes no mercado.',
          suggestedAssigneeLabel: 'Responsável por Compras',
          priority: needRestock.length >= 5 ? 'important' : 'attention',
          dueDays: 2,
          checklist: [
            'Abrir Assistente de Compras',
            'Validar cotações dos fornecedores',
            'Aprovar lista de compra dentro da alçada',
          ],
          status: 'pending',
        },
      });
    }
    return proposals;
  }

  if (agentId === 'julia_qualidade') {
    const ticketsSnap = await db.collection('support_tickets').orderBy('createdAt', 'desc').limit(50).get();
    if (ticketsSnap.empty) return proposals;

    const openTickets = ticketsSnap.docs.filter((d) => {
      const st = String((d.data() as { status?: string }).status || 'open');
      return st === 'open' || st === 'in_progress';
    });

    if (openTickets.length >= (rule.stockThreshold || 1)) {
      const sample = openTickets.slice(0, 5);
      proposals.push({
        agentId,
        type: 'alert',
        priority: openTickets.length >= 4 ? 'critical' : 'important',
        subject: `Qualidade & Suporte: ${openTickets.length} chamado(s) em aberto aguardando tratativa`,
        body: [
          `Fato observado: existem ${openTickets.length} chamado(s) com status aberto ou em andamento na fila de suporte.`,
          '',
          'Sugestão: revisar os chamados abertos e verificar se há incidência recorrente em entregas ou produtos.',
        ].join('\n'),
        sourceEvent: 'quality_open_tickets',
        deduplicationKey: `julia_qualidade:open_tickets:${new Date(nowMs).toISOString().slice(0, 10)}`,
        requiresApproval: true,
        relatedEntities: sample.map((t) => ({
          type: 'ticket',
          id: t.id,
          label: `Chamado #${t.id.slice(0, 8).toUpperCase()}`,
          snapshot: { number: t.id.slice(0, 8).toUpperCase(), status: 'aberto' },
        })),
        insightDetails: {
          observedFact: `${openTickets.length} chamado(s) em aberto em support_tickets.`,
          dataUsed: `Últimos ${ticketsSnap.size} chamados registrados.`,
          interpretation: 'Tempo de resposta no suporte impacta diretamente a satisfação dos moradores.',
          suggestion: 'Priorizar resposta dos chamados mais antigos e mapear causas recorrentes.',
          confidence: 'high',
          requiresHumanApproval: true,
          analyzedPeriod: 'Fila atual de suporte',
          metricsSummary: { 'Chamados em aberto': openTickets.length },
          ruleVersion: '1.0.0',
        },
        suggestedTask: {
          title: `Tratar ${openTickets.length} chamado(s) de suporte em aberto`,
          description: 'Revisar fila de atendimento e identificar causa raiz de eventuais reclamações.',
          reason: 'Manter SLA de atendimento aos moradores.',
          suggestedAssigneeLabel: 'Suporte / Qualidade',
          priority: openTickets.length >= 4 ? 'critical' : 'attention',
          dueDays: 1,
          checklist: ['Responder chamados prioritários', 'Registrar ações corretivas se houver falha recorrente'],
          status: 'pending',
        },
      });
    }
    return proposals;
  }

  if (agentId === 'lucas_crm') {
    const usersSnap = await db.collection('users').limit(150).get();
    if (usersSnap.empty) return proposals;

    let recentCount = 0;
    const byCondo: Record<string, number> = {};
    for (const d of usersSnap.docs) {
      const u = d.data() as { createdAt?: unknown; condominio?: string; role?: string };
      if (u.role === 'admin' || u.role === 'superadmin') continue;
      if (toMs(u.createdAt) >= cutoffMs) recentCount++;
      const condo = String(u.condominio || '').trim();
      if (condo) byCondo[condo] = (byCondo[condo] ?? 0) + 1;
    }

    const topCondos = Object.entries(byCondo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, cnt]) => `${name}: ${cnt}`);

    if (recentCount > 0 || topCondos.length > 0) {
      proposals.push({
        agentId,
        type: 'insight',
        priority: 'informative',
        subject: `Panorama CRM (${periodLabel}): ${recentCount} novo(s) morador(es) cadastrado(s)`,
        body: redactAgentText(
          [
            `Fato observado: ${recentCount} novo(s) cadastro(s) de morador(es) na janela analisada.`,
            topCondos.length > 0 ? `Principais condomínios ativos na amostra: ${topCondos.join(' | ')}.` : '',
            '',
            'Nota de privacidade: nenhum dado pessoal sensível (CPF/telefone) é exposto nesta comunicação.',
          ]
            .filter(Boolean)
            .join('\n'),
        ),
        sourceEvent: 'crm_community_pulse',
        deduplicationKey: `lucas_crm:pulse:${new Date(nowMs).toISOString().slice(0, 10)}`,
        requiresApproval: false,
        relatedEntities: [{ type: 'report', id: 'crm_overview', label: 'Clientes & CRM 360°' }],
        insightDetails: {
          observedFact: `${recentCount} novo(s) cadastro(s) no período.`,
          dataUsed: `Contagem agregada e anônima de ${usersSnap.size} registros de usuários.`,
          interpretation: 'Acompanhamento de adesão por condomínio para orientar ações de boas-vindas.',
          suggestion: 'Avaliar campanha de boas-vindas ou indicação no condomínio de maior crescimento.',
          confidence: 'medium',
          requiresHumanApproval: true,
          analyzedPeriod: periodLabel,
          metricsSummary: { 'Novos cadastros': recentCount },
          ruleVersion: '1.0.0',
        },
      });
    }
    return proposals;
  }

  if (agentId === 'sofia_marketing') {
    const prodSnap = await db.collection('products').limit(200).get();
    if (prodSnap.empty) return proposals;

    const highStockNoPromo = prodSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as { active?: boolean; title?: string; stock?: unknown; promoActive?: boolean }) }))
      .filter((p) => p.active !== false && Number(p.stock ?? 0) >= 15 && p.promoActive !== true)
      .slice(0, 5);

    if (highStockNoPromo.length >= 2) {
      proposals.push({
        agentId,
        type: 'insight',
        priority: 'informative',
        subject: `Oportunidade de destaque: ${highStockNoPromo.length} item(ns) com alto estoque sem promoção`,
        body: [
          `Fato observado: ${highStockNoPromo.length} produto(s) possuem saldo confortável (>= 15 un.) e não estão em promoção ativa.`,
          '',
          highStockNoPromo.map((p) => `• ${p.title} (${Number(p.stock ?? 0)} un.)`).join('\n'),
          '',
          'Sugestão: avaliar inclusão em vitrine temática ou banner na Home (sujeito à aprovação humana).',
        ].join('\n'),
        sourceEvent: 'marketing_high_stock_opportunity',
        deduplicationKey: `sofia_marketing:opportunity:${new Date(nowMs).toISOString().slice(0, 10)}`,
        requiresApproval: true,
        relatedEntities: highStockNoPromo.map((p) => ({
          type: 'product',
          id: p.id,
          label: String(p.title || p.id),
        })),
        insightDetails: {
          observedFact: `${highStockNoPromo.length} produtos ativos têm estoque >= 15 unidades sem promoção vigente.`,
          dataUsed: `Amostra de ${prodSnap.size} produtos em products.`,
          interpretation: 'Itens com boa cobertura de estoque são candidatos seguros para vitrines e banners sem risco imediato de ruptura.',
          suggestion: 'Selecionar itens para vitrine ou campanha sazonal no módulo de Marketing.',
          confidence: 'medium',
          requiresHumanApproval: true,
          analyzedPeriod: 'Estado atual do catálogo',
          metricsSummary: { 'Candidatos a destaque': highStockNoPromo.length },
          ruleVersion: '1.0.0',
        },
      });
    }
    return proposals;
  }

  if (agentId === 'eduardo_sistema') {
    const auditSnap = await db.collection('audit_logs').orderBy('createdAt', 'desc').limit(80).get();
    if (auditSnap.empty) return proposals;

    const deniedOrError = auditSnap.docs.filter((d) => {
      const a = d.data() as { result?: string; createdAt?: unknown };
      return (a.result === 'denied' || a.result === 'error') && toMs(a.createdAt) >= cutoffMs;
    });

    if (deniedOrError.length >= (rule.stockThreshold || 3)) {
      proposals.push({
        agentId,
        type: 'incident',
        priority: deniedOrError.length >= 8 ? 'critical' : 'important',
        subject: `Monitor Técnico: ${deniedOrError.length} evento(s) negado(s)/com erro na auditoria`,
        body: redactAgentText(
          [
            `Fato observado: nas ${periodLabel.toLowerCase()}, foram registrados ${deniedOrError.length} evento(s) com resultado "denied" ou "error" na trilha de auditoria.`,
            '',
            'Nota de segurança: tokens, credenciais e payloads sensíveis foram omitidos automaticamente.',
            'Sugestão: revisar a Trilha de Auditoria para confirmar se trata de erro operacional ou tentativa indevida.',
          ].join('\n'),
        ),
        sourceEvent: 'system_audit_anomalies',
        deduplicationKey: `eduardo_sistema:audit:${new Date(nowMs).toISOString().slice(0, 13)}`,
        requiresApproval: true,
        relatedEntities: [{ type: 'report', id: 'audit_logs', label: 'Trilha de Auditoria' }],
        insightDetails: {
          observedFact: `${deniedOrError.length} registros denied/error em audit_logs na janela de ${windowHours}h.`,
          dataUsed: `Leitura restrita dos últimos ${auditSnap.size} eventos de audit_logs.`,
          interpretation: 'Pode indicar falha pontual de integração/permissão ou tentativa de ação fora da alçada.',
          suggestion: 'Inspecionar Trilha de Auditoria sem expor dados sensíveis.',
          confidence: 'high',
          requiresHumanApproval: true,
          analyzedPeriod: periodLabel,
          metricsSummary: { 'Eventos denied/error': deniedOrError.length },
          ruleVersion: '1.0.0',
        },
        suggestedTask: {
          title: 'Revisar eventos de erro/negação na Trilha de Auditoria',
          description: `Analisar ${deniedOrError.length} ocorrência(s) recente(s) na auditoria do sistema.`,
          reason: 'Segurança operacional e estabilidade técnica.',
          suggestedAssigneeLabel: 'Superadmin / Tecnologia',
          priority: deniedOrError.length >= 8 ? 'critical' : 'important',
          dueDays: 1,
          checklist: ['Abrir /admin/audit', 'Filtrar por denied e error', 'Validar se há impacto para usuários'],
          status: 'pending',
        },
      });
    }
    return proposals;
  }

  return proposals;
}

