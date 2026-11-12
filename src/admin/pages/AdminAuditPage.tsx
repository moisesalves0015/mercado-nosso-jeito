import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ScrollText,
  ShieldAlert,
} from 'lucide-react';
import { functions } from '../../firebase';
import { MODULE_LABELS, MODULES } from '../permissions';
import { useAdminData } from '../AdminDataContext';
import {
  EmptyState,
  formatDateTime,
  PageHeader,
  RoleBadge,
} from '../components/AdminUi';

interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorRole?: string | null;
  action: string;
  module: string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  result: 'success' | 'denied' | 'error';
  createdAtMillis: number;
}

export const AdminAuditPage: React.FC = () => {
  const { showToast } = useAdminData();
  const [searchParams, setSearchParams] = useSearchParams();

  const moduleFilter = searchParams.get('module') || '';
  const resultFilter = searchParams.get('result') || '';
  const entityIdFilter = searchParams.get('entityId') || '';

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAudit = useCallback(
    async (cursor?: number | null) => {
      setLoading(true);
      try {
        const fn = httpsCallable<
          Record<string, unknown>,
          { entries: AuditLogEntry[]; nextCursor: number | null }
        >(functions, 'adminListAudit');
        const res = await fn({
          limit: 40,
          module: moduleFilter || undefined,
          result: resultFilter || undefined,
          entityId: entityIdFilter || undefined,
          startAfterMillis: cursor ?? undefined,
        });
        if (cursor) {
          setEntries((prev) => [...prev, ...(res.data.entries || [])]);
        } else {
          setEntries(res.data.entries || []);
        }
        setNextCursor(res.data.nextCursor ?? null);
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao carregar trilha de auditoria.', 'err');
      } finally {
        setLoading(false);
      }
    },
    [moduleFilter, resultFilter, entityIdFilter, showToast],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAudit(null);
  }, [loadAudit]);

  const updateParam = (k: string, v: string) => {
    const next = new URLSearchParams(searchParams);
    if (!v) next.delete(k);
    else next.set(k, v);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trilha de Auditoria Imutável"
        subtitle="Registro de todas as operações críticas, atribuições de papéis, ajustes de estoque e tentativas de acesso negadas."
        badge={`${entries.length} eventos`}
        actions={
          <button
            type="button"
            onClick={() => loadAudit(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar Trilha
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-lg text-xs">
        <div>
          <label className="block font-bold uppercase text-slate-400 mb-1">Módulo</label>
          <select
            value={moduleFilter}
            onChange={(e) => updateParam('module', e.target.value)}
            aria-label="Filtrar auditoria por módulo"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white font-bold"
          >
            <option value="">Todos os Módulos</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {MODULE_LABELS[m]} ({m})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold uppercase text-slate-400 mb-1">Resultado</label>
          <select
            value={resultFilter}
            onChange={(e) => updateParam('result', e.target.value)}
            aria-label="Filtrar auditoria por resultado"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white font-bold"
          >
            <option value="">Todos os Resultados</option>
            <option value="success">Sucesso (Autorizado)</option>
            <option value="denied">Negado (Bloqueio RBAC)</option>
            <option value="error">Erro de Execução</option>
          </select>
        </div>

        <div>
          <label className="block font-bold uppercase text-slate-400 mb-1">
            ID da Entidade / Alvo
          </label>
          <input
            type="search"
            value={entityIdFilter}
            onChange={(e) => updateParam('entityId', e.target.value)}
            placeholder="UID, ID de pedido ou produto..."
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-400"
          />
        </div>
      </div>

      {/* Audit Entries List */}
      {entries.length === 0 && !loading ? (
        <EmptyState
          icon={<ScrollText size={24} />}
          title="Nenhum evento de auditoria encontrado"
          description="Não há registros correspondentes aos filtros aplicados."
        />
      ) : (
        <div className="space-y-2.5">
          {entries.map((entry) => {
            const isDenied = entry.result === 'denied';
            const isExpanded = expandedId === entry.id;

            return (
              <div
                key={entry.id}
                className={`bg-slate-900/90 border rounded-2xl p-4 transition-all shadow-md ${
                  isDenied ? 'border-rose-500/40' : 'border-slate-800/90'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          isDenied
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {isDenied ? <ShieldAlert size={11} /> : <CheckCircle2 size={11} />}
                        {isDenied ? 'NEGADO' : 'SUCESSO'}
                      </span>
                      <span className="font-mono text-xs font-extrabold text-amber-400">
                        {entry.action}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                        {entry.module}
                      </span>
                      <RoleBadge roleId={entry.actorRole} />
                    </div>

                    <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
                      <span>
                        Ator: <strong className="font-mono text-white">{entry.actorUid}</strong>
                      </span>
                      <span>
                        • Alvo ({entry.entityType}):{' '}
                        <strong className="font-mono text-white">{entry.entityId}</strong>
                      </span>
                      <span className="text-slate-400">
                        • {formatDateTime(entry.createdAtMillis)}
                      </span>
                    </div>

                    {entry.reason && (
                      <div className="text-xs text-slate-300 italic mt-1">
                        Justificativa: "{entry.reason}"
                      </div>
                    )}
                  </div>

                  {(entry.before || entry.after) && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 inline-flex items-center gap-1 self-start sm:self-center shrink-0"
                    >
                      <span>Inspecionar Diff</span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Estado Anterior (Before)
                      </div>
                      <pre className="text-[11px] text-slate-300">
                        {JSON.stringify(entry.before ?? null, null, 2)}
                      </pre>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
                      <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1">
                        Estado Posterior (After)
                      </div>
                      <pre className="text-[11px] text-emerald-200">
                        {JSON.stringify(entry.after ?? null, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {nextCursor && (
            <div className="pt-2 text-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => loadAudit(nextCursor)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-extrabold text-white border border-slate-700"
              >
                {loading ? 'Carregando...' : 'Carregar Mais Eventos'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
