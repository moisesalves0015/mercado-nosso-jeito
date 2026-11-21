import React, { useCallback, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Database,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  SYSTEM_AGENTS,
  buildDefaultAgentRule,
} from '../agents';
import type {
  AgentRuleConfig,
  InboxPriority,
  PartnerAdminMember,
  SystemAgentId,
} from '../types';
import {
  saveInboxAgentRule,
  testInboxAgentRule,
} from '../../../services/adminInboxService';

interface InboxAgentRulesViewProps {
  rules: Record<string, AgentRuleConfig>;
  partners: PartnerAdminMember[];
  canAdmin: boolean;
  busyAction: string | null;
  onRunAgent: (agentId?: SystemAgentId) => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const InboxAgentRulesView: React.FC<InboxAgentRulesViewProps> = ({
  rules,
  partners,
  canAdmin,
  busyAction,
  onRunAgent,
  onShowToast,
}) => {
  const [drafts, setDrafts] = useState<Record<string, AgentRuleConfig>>({});
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [dryRunResults, setDryRunResults] = useState<
    Record<string, Array<{ subject: string; priority: InboxPriority; observedFact: string }>>
  >({});
  const [testingAgentId, setTestingAgentId] = useState<string | null>(null);

  const getRule = useCallback(
    (agentId: SystemAgentId): AgentRuleConfig =>
      drafts[agentId] ?? rules[agentId] ?? buildDefaultAgentRule(agentId),
    [drafts, rules],
  );

  const patchDraft = (agentId: SystemAgentId, patch: Partial<AgentRuleConfig>) => {
    setDrafts((prev) => ({
      ...prev,
      [agentId]: { ...getRule(agentId), ...patch },
    }));
  };

  const handleSave = async (agentId: SystemAgentId) => {
    const r = getRule(agentId);
    try {
      await saveInboxAgentRule({
        agentId,
        active: r.active,
        stockThreshold: r.stockThreshold,
        analysisWindowHours: r.analysisWindowHours,
        minIntervalMinutes: r.minIntervalMinutes,
        defaultPriority: r.defaultPriority,
        toAll: r.toAll,
        defaultRecipientIds: r.defaultRecipientIds,
        suggestedAssigneeUid: r.suggestedAssigneeUid,
        autoCreateTaskOnCritical: r.autoCreateTaskOnCritical,
        isCriticalAgent: r.isCriticalAgent,
        mutedKeys: r.mutedKeys,
      });
      onShowToast(`Regras de ${agentId} salvas com sucesso.`, 'ok');
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Erro ao salvar regra.', 'err');
    }
  };

  const handleReset = async (agentId: SystemAgentId) => {
    try {
      await saveInboxAgentRule({ agentId, reset: true });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
      onShowToast(`Regras de ${agentId} restauradas aos padrões.`, 'ok');
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Erro ao restaurar regra.', 'err');
    }
  };

  const handleTest = async (agentId: SystemAgentId) => {
    setTestingAgentId(agentId);
    try {
      const res = await testInboxAgentRule(agentId);
      setDryRunResults((prev) => ({ ...prev, [agentId]: res.proposals }));
      onShowToast(`Simulação dry-run: ${res.proposals.length} comunicado(s) gerado(s).`, 'ok');
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Erro ao testar regra.', 'err');
    } finally {
      setTestingAgentId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Apple-style Subheader */}
      <div className="p-4 rounded-xl bg-[var(--adm-surface)] border border-[var(--adm-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-teal-500/15 text-teal-300">
              <Bot size={16} />
            </span>
            <h2 className="text-sm font-bold text-[var(--adm-text)]">
              Central de Funcionários Sistêmicos (11 Agentes)
            </h2>
          </div>
          <p className="text-[11px] text-[var(--adm-text-dim)] mt-0.5">
            Agentes operacionais automatizados com governança transparente: apenas propõem ações baseadas em dados reais e nunca alteram dados sensíveis sem aprovação humana.
          </p>
        </div>

        {canAdmin && (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => onRunAgent()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border border-[var(--adm-gold-border)] hover:bg-[var(--adm-gold-soft)]/80 disabled:opacity-50 shrink-0"
          >
            {busyAction === 'run_all' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Zap size={13} />
            )}
            Executar Todos Agora
          </button>
        )}
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {SYSTEM_AGENTS.map((agent) => {
          const rule = getRule(agent.id);
          const isExpanded = expandedAgentId === agent.id;
          const proposals = dryRunResults[agent.id];
          const isRunningThis = busyAction === `run_${agent.id}`;
          const isTestingThis = testingAgentId === agent.id;

          return (
            <div
              key={agent.id}
              className={`rounded-xl border transition-all duration-150 ${
                rule.active
                  ? 'bg-[var(--adm-surface)] border-[var(--adm-border)] hover:border-[var(--adm-border-strong)]'
                  : 'bg-[var(--adm-bg)] border-[var(--adm-border)]/60 opacity-80'
              }`}
            >
              {/* Agent Card Header */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ backgroundColor: agent.badgeBg, color: agent.accentColor }}
                    >
                      <Bot size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-[var(--adm-text)] truncate">
                          {agent.name}
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--adm-bg)] text-[var(--adm-text-dim)] border border-[var(--adm-border)] shrink-0">
                          {agent.sector}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--adm-text-dim)] truncate">
                        {agent.roleTitle}
                      </p>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      disabled={!canAdmin}
                      checked={rule.active}
                      onChange={(e) => patchDraft(agent.id, { active: e.target.checked })}
                      className="rounded"
                    />
                    <span className={rule.active ? 'text-emerald-300' : 'text-[var(--adm-text-dim)]'}>
                      {rule.active ? 'Ativo' : 'Pausado'}
                    </span>
                  </label>
                </div>

                <p className="text-[11px] text-[var(--adm-text-muted)] line-clamp-2 leading-relaxed">
                  {agent.description}
                </p>

                {/* Sources pill row */}
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-[var(--adm-text-dim)] pt-1">
                  <span className="inline-flex items-center gap-1 mr-1">
                    <Database size={10} /> Fontes:
                  </span>
                  {agent.allowedDataSources.map((ds) => (
                    <span
                      key={ds}
                      className="px-1.5 py-0.2 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)]"
                    >
                      {ds}
                    </span>
                  ))}
                </div>
              </div>

              {/* Expansion Accordion Toggle */}
              <div className="px-4 py-2 border-t border-[var(--adm-border)]/60 bg-[var(--adm-surface-elevated)]/30 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                  aria-expanded={isExpanded}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--adm-text-muted)] hover:text-[var(--adm-gold)] transition-colors"
                >
                  <span>{isExpanded ? 'Ocultar configurações' : 'Configurações e regras'}</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {canAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busyAction !== null || !rule.active}
                      onClick={() => onRunAgent(agent.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-[var(--adm-border)] text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
                    >
                      {isRunningThis ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Play size={11} />
                      )}
                      Executar
                    </button>
                  </div>
                )}
              </div>

              {/* Collapsible Settings Body */}
              {isExpanded && (
                <div className="p-4 border-t border-[var(--adm-border)] space-y-3.5 bg-[var(--adm-bg)]/40 text-xs">
                  {/* Parameter Fields */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--adm-text-dim)] mb-1">
                        Janela de Análise (h)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={720}
                        disabled={!canAdmin}
                        value={rule.analysisWindowHours}
                        onChange={(e) =>
                          patchDraft(agent.id, {
                            analysisWindowHours: Number(e.target.value) || 24,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-[var(--adm-text)] font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--adm-text-dim)] mb-1">
                        Intervalo Mín. (min)
                      </label>
                      <input
                        type="number"
                        min={15}
                        max={10080}
                        disabled={!canAdmin}
                        value={rule.minIntervalMinutes}
                        onChange={(e) =>
                          patchDraft(agent.id, {
                            minIntervalMinutes: Number(e.target.value) || 180,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-[var(--adm-text)] font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--adm-text-dim)] mb-1">
                        Prioridade Padrão
                      </label>
                      <select
                        disabled={!canAdmin}
                        value={rule.defaultPriority}
                        onChange={(e) =>
                          patchDraft(agent.id, {
                            defaultPriority: e.target.value as InboxPriority,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-[var(--adm-text)] text-[11px]"
                      >
                        <option value="informative">Informativa</option>
                        <option value="attention">Atenção</option>
                        <option value="important">Importante</option>
                        <option value="critical">Crítica</option>
                      </select>
                    </div>
                  </div>

                  {/* Assignee & Threshold */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--adm-text-dim)] mb-1">
                        Responsável Sugerido
                      </label>
                      <select
                        disabled={!canAdmin}
                        value={rule.suggestedAssigneeUid ?? ''}
                        onChange={(e) =>
                          patchDraft(agent.id, {
                            suggestedAssigneeUid: e.target.value || undefined,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-[var(--adm-text)] text-[11px]"
                      >
                        <option value="">Automático / Todos os Sócios</option>
                        {partners.map((p) => (
                          <option key={p.uid} value={p.uid}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(agent.id === 'ana_estoque' || agent.id === 'rafael_compras') && (
                      <div>
                        <label className="block text-[10px] font-semibold text-[var(--adm-text-dim)] mb-1">
                          Limiar de Estoque Crítico
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          disabled={!canAdmin}
                          value={rule.stockThreshold ?? 5}
                          onChange={(e) =>
                            patchDraft(agent.id, {
                              stockThreshold: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-[var(--adm-text)] font-mono text-[11px]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Auto Task checkbox */}
                  <label className="flex items-center gap-2 text-xs text-[var(--adm-text-muted)] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canAdmin}
                      checked={rule.autoCreateTaskOnCritical}
                      onChange={(e) =>
                        patchDraft(agent.id, { autoCreateTaskOnCritical: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>Gerar proposta de tarefa operacional automaticamente quando o comunicado for crítico</span>
                  </label>

                  {/* Muted keys */}
                  {rule.mutedKeys.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-[var(--adm-text-dim)]">
                        Alertas Semelhantes Silenciados:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {rule.mutedKeys.map((k) => (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--adm-surface)] border border-[var(--adm-border)] text-[10px] text-[var(--adm-text-dim)]"
                          >
                            <span>{k}</span>
                            {canAdmin && (
                              <button
                                type="button"
                                onClick={() =>
                                  patchDraft(agent.id, {
                                    mutedKeys: rule.mutedKeys.filter((x) => x !== k),
                                  })
                                }
                                className="hover:text-rose-300"
                                title="Reativar este alerta"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Safeguards Summary */}
                  <div className="p-2.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-[10px] space-y-1 text-[var(--adm-text-dim)]">
                    <p className="flex items-center gap-1 font-semibold text-[var(--adm-text-muted)]">
                      <Shield size={11} className="text-emerald-400" /> Governança & Salvaguardas:
                    </p>
                    <p>• Sugere: {agent.suggestedActions.join('; ')}</p>
                    <p className="text-amber-300/80">• Restrições: {agent.forbiddenDirectActions.join('; ')}</p>
                  </div>

                  {/* Dry Run Test Proposal results */}
                  {proposals && (
                    <div className="p-3 rounded-lg bg-teal-500/[0.05] border border-teal-500/25 space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between text-teal-300 font-bold">
                        <span className="flex items-center gap-1">
                          <Sparkles size={12} /> Resultado Simulação Dry-Run:
                        </span>
                        <span>{proposals.length} item(ns)</span>
                      </div>
                      {proposals.length === 0 ? (
                        <p className="text-[var(--adm-text-dim)]">
                          Nenhuma divergência ou oportunidade pendente nos dados reais do momento.
                        </p>
                      ) : (
                        proposals.map((p, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded bg-[var(--adm-surface)] border border-[var(--adm-border)] text-[var(--adm-text-muted)]"
                          >
                            <span className="font-semibold text-[var(--adm-text)]">
                              [{p.priority.toUpperCase()}] {p.subject}
                            </span>
                            <p className="text-[10px] text-[var(--adm-text-dim)] mt-0.5">
                              {p.observedFact}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  {canAdmin && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--adm-border)]/60">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSave(agent.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--adm-gold)] text-[#09120e] hover:opacity-95"
                        >
                          <Save size={12} /> Salvar Regra
                        </button>
                        <button
                          type="button"
                          disabled={isTestingThis}
                          onClick={() => handleTest(agent.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--adm-border)] text-[var(--adm-text)] hover:bg-[var(--adm-surface)]"
                        >
                          {isTestingThis ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Sparkles size={12} />
                          )}
                          Testar Dry-Run
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleReset(agent.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-[var(--adm-text-dim)] hover:text-[var(--adm-text)]"
                      >
                        <RotateCcw size={11} /> Restaurar Padrão
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
