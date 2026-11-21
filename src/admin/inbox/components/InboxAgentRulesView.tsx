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
      <div className="p-4 rounded-xl bg-white border border-[#e3e7ec] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#eef5ff] text-[#2563eb]">
              <Bot size={16} />
            </span>
            <h2 className="text-sm font-bold text-[#17202a]">
              Central de Funcionários Sistêmicos (11 Agentes)
            </h2>
          </div>
          <p className="text-[11px] text-[#5b6573] mt-0.5">
            Agentes operacionais automatizados com governança transparente: apenas propõem ações baseadas em dados reais e nunca alteram dados sensíveis sem aprovação humana.
          </p>
        </div>

        {canAdmin && (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => onRunAgent()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white text-[#17202a] border border-[#e3e7ec] hover:bg-[#f1f4f7] disabled:opacity-50 shrink-0 transition-colors"
          >
            {busyAction === 'run_all' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Zap size={13} className="text-[#167a52]" />
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
              className={`rounded-xl border transition-all duration-150 overflow-hidden ${
                rule.active
                  ? 'bg-white border-[#e3e7ec] hover:border-[#cfd6df] shadow-2xs'
                  : 'bg-[#fbfcfd] border-[#e3e7ec] opacity-80'
              }`}
            >
              {/* Agent Card Header */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold border border-[#e3e7ec]"
                      style={{ backgroundColor: agent.badgeBg, color: agent.accentColor }}
                    >
                      <Bot size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-[#17202a] truncate">
                          {agent.name}
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f6f7f9] text-[#5b6573] border border-[#e3e7ec] shrink-0 font-medium">
                          {agent.sector}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5b6573] truncate">
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
                      className="rounded accent-[#167a52]"
                    />
                    <span className={rule.active ? 'text-[#167a52] font-semibold' : 'text-[#838e9b]'}>
                      {rule.active ? 'Ativo' : 'Pausado'}
                    </span>
                  </label>
                </div>

                <p className="text-[11px] text-[#5b6573] line-clamp-2 leading-relaxed">
                  {agent.description}
                </p>

                {/* Sources pill row */}
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-[#838e9b] pt-1">
                  <span className="inline-flex items-center gap-1 mr-1">
                    <Database size={10} /> Fontes:
                  </span>
                  {agent.allowedDataSources.map((ds) => (
                    <span
                      key={ds}
                      className="px-1.5 py-0.5 rounded bg-[#f6f7f9] border border-[#e3e7ec] text-[#5b6573]"
                    >
                      {ds}
                    </span>
                  ))}
                </div>
              </div>

              {/* Expansion Accordion Toggle */}
              <div className="px-4 py-2 border-t border-[#e3e7ec] bg-[#fbfcfd] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                  aria-expanded={isExpanded}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#5b6573] hover:text-[#17202a] transition-colors"
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-[#e3e7ec] bg-white text-[#167a52] hover:bg-[#e8f4ee] hover:border-[#b9ddc8] disabled:opacity-50 transition-colors"
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
                <div className="p-4 border-t border-[#e3e7ec] space-y-3.5 bg-[#f6f7f9] text-xs">
                  {/* Parameter Fields */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#5b6573] mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e7ec] text-[#17202a] font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#5b6573] mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e7ec] text-[#17202a] font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#5b6573] mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e7ec] text-[#17202a] text-[11px]"
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
                      <label className="block text-[10px] font-semibold text-[#5b6573] mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e7ec] text-[#17202a] text-[11px]"
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
                        <label className="block text-[10px] font-semibold text-[#5b6573] mb-1">
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
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e7ec] text-[#17202a] font-mono text-[11px]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Auto Task checkbox */}
                  <label className="flex items-center gap-2 text-xs text-[#5b6573] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canAdmin}
                      checked={rule.autoCreateTaskOnCritical}
                      onChange={(e) =>
                        patchDraft(agent.id, { autoCreateTaskOnCritical: e.target.checked })
                      }
                      className="rounded accent-[#167a52]"
                    />
                    <span>Gerar proposta de tarefa operacional automaticamente quando o comunicado for crítico</span>
                  </label>

                  {/* Muted keys */}
                  {rule.mutedKeys.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-[#5b6573]">
                        Alertas Semelhantes Silenciados:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {rule.mutedKeys.map((k) => (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#e3e7ec] text-[10px] text-[#5b6573]"
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
                                className="hover:text-[#c2414b]"
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
                  <div className="p-2.5 rounded-lg bg-white border border-[#e3e7ec] text-[10px] space-y-1 text-[#5b6573]">
                    <p className="flex items-center gap-1 font-semibold text-[#17202a]">
                      <Shield size={11} className="text-[#167a52]" /> Governança & Salvaguardas:
                    </p>
                    <p>• Sugere: {agent.suggestedActions.join('; ')}</p>
                    <p className="text-[#b7791f]">• Restrições: {agent.forbiddenDirectActions.join('; ')}</p>
                  </div>

                  {/* Dry Run Test Proposal results */}
                  {proposals && (
                    <div className="p-3 rounded-lg bg-[#eef5ff] border border-[#bfdbfe] space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between text-[#1d4ed8] font-bold">
                        <span className="flex items-center gap-1">
                          <Sparkles size={12} /> Resultado Simulação Dry-Run:
                        </span>
                        <span>{proposals.length} item(ns)</span>
                      </div>
                      {proposals.length === 0 ? (
                        <p className="text-[#5b6573]">
                          Nenhuma divergência ou oportunidade pendente nos dados reais do momento.
                        </p>
                      ) : (
                        proposals.map((p, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded bg-white border border-[#dbeafe] text-[#5b6573]"
                          >
                            <span className="font-semibold text-[#17202a]">
                              [{p.priority.toUpperCase()}] {p.subject}
                            </span>
                            <p className="text-[10px] text-[#838e9b] mt-0.5">
                              {p.observedFact}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  {canAdmin && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e3e7ec]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSave(agent.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#167a52] hover:bg-[#106441] text-white"
                        >
                          <Save size={12} /> Salvar Regra
                        </button>
                        <button
                          type="button"
                          disabled={isTestingThis}
                          onClick={() => handleTest(agent.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e3e7ec] bg-white text-[#17202a] hover:bg-[#f1f4f7]"
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
                        className="inline-flex items-center gap-1 text-[11px] text-[#838e9b] hover:text-[#17202a]"
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
