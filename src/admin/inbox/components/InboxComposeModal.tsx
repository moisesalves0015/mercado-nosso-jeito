import React, { useMemo, useState } from 'react';
import {
  FileText,
  Loader2,
  Paperclip,
  Send,
  Users,
  X,
} from 'lucide-react';
import { resolveEntityRoute, validateInboxAttachment } from '../normalizers';
import type {
  InboxEntityType,
  InboxEntityReference,
  InboxMessageType,
  InboxPriority,
  PartnerAdminMember,
} from '../types';
import { createInboxMessage, uploadInboxAttachment } from '../../../services/adminInboxService';

interface InboxComposeModalProps {
  partners: PartnerAdminMember[];
  products: Array<{ id: string; title?: string; name?: string }>;
  orders: Array<{ id: string; orderNumber?: string; customerName?: string }>;
  clients: Array<{ id: string; name: string }>;
  tickets: Array<{ id: string; ticketNumber?: string; subject: string }>;
  onClose: () => void;
  onCreated: (messageId: string) => void;
  onError: (msg: string) => void;
}

export const InboxComposeModal: React.FC<InboxComposeModalProps> = ({
  partners,
  products,
  orders,
  clients,
  tickets,
  onClose,
  onCreated,
  onError,
}) => {
  const [type, setType] = useState<InboxMessageType>('message');
  const [toAll, setToAll] = useState(true);
  const [toUserIds, setToUserIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<InboxPriority>('attention');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [requestedResponseFromUserId, setRequestedResponseFromUserId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [createTaskAlong, setCreateTaskAlong] = useState(false);
  const [relatedEntities, setRelatedEntities] = useState<InboxEntityReference[]>([]);
  const [entityType, setEntityType] = useState<InboxEntityType>('product');
  const [entityId, setEntityId] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<string | null>(null);
  const submitLockRef = React.useRef(false);
  const requestIdRef = React.useRef<string | null>(null);

  const entityChoices = useMemo(() => {
    if (entityType === 'product') {
      return products.slice(0, 60).map((p) => ({
        id: p.id,
        label: p.title || p.name || `Produto #${p.id.slice(0, 6)}`,
      }));
    }
    if (entityType === 'order') {
      return orders.slice(0, 60).map((o) => ({
        id: o.id,
        label: `Pedido #${o.orderNumber || o.id.slice(0, 6)} — ${o.customerName || 'Cliente'}`,
      }));
    }
    if (entityType === 'customer') {
      return clients.slice(0, 60).map((c) => ({ id: c.id, label: c.name || c.id }));
    }
    if (entityType === 'ticket') {
      return tickets.slice(0, 60).map((t) => ({
        id: t.id,
        label: `Ticket #${t.ticketNumber || t.id.slice(0, 6)} — ${t.subject}`,
      }));
    }
    return [];
  }, [entityType, products, orders, clients, tickets]);

  const handleAddEntity = () => {
    if (!entityId) return;
    const found = entityChoices.find((e) => e.id === entityId);
    if (!found) return;
    if (relatedEntities.some((e) => e.type === entityType && e.id === found.id)) return;
    setRelatedEntities((prev) => [
      ...prev,
      {
        type: entityType,
        id: found.id,
        label: found.label,
        route: resolveEntityRoute(entityType, found.id),
      },
    ]);
    setEntityId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || submitting) return;
    if (!subject.trim() || !body.trim()) {
      onError('Preencha o assunto e a mensagem.');
      return;
    }
    if (!toAll && toUserIds.length === 0) {
      onError('Selecione pelo menos um sócio ou marque Todos os sócios.');
      return;
    }
    submitLockRef.current = true;
    if (!requestIdRef.current) {
      requestIdRef.current =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    setSubmitting(true);
    setSubmitStage('Enviando mensagem...');
    try {
      const res = await createInboxMessage({
        type,
        toAll,
        toUserIds: toAll ? partners.map((p) => p.uid) : toUserIds,
        subject: subject.trim(),
        body: body.trim(),
        priority,
        assignedToUserId: assignedToUserId || undefined,
        requestedResponseFromUserId: requestedResponseFromUserId || undefined,
        requestReply: Boolean(requestedResponseFromUserId),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        relatedEntities,
        createTaskAlong,
        clientRequestId: requestIdRef.current,
      });

      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        setSubmitStage(`Enviando anexo ${i + 1} de ${pendingFiles.length}...`);
        await uploadInboxAttachment(res.messageId, file, (pct) => {
          setSubmitStage(`Enviando anexo ${i + 1} de ${pendingFiles.length} (${pct}%)...`);
        }).promise;
      }

      onCreated(res.messageId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
      setSubmitStage(null);
    }
  };

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-modal-title"
      className="fixed inset-0 z-50 bg-[#17202a]/40 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#e3e7ec] rounded-none sm:rounded-2xl max-w-2xl w-full h-full sm:h-auto sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#17202a]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e7ec] bg-[#fbfcfd] shrink-0">
          <div>
            <h3 id="compose-modal-title" className="text-sm font-bold text-[#17202a]">
              Nova Mensagem Administrativa
            </h3>
            <p className="text-[11px] text-[#5b6573]">
              Caixa compartilhada entre os sócios administradores
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário de nova mensagem"
            className="p-1.5 rounded-lg text-[#5b6573] hover:text-[#17202a] hover:bg-[#f1f4f7]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Privacy Pill */}
        <div className="p-2.5 rounded-xl bg-[#e8f4ee] border border-[#b9ddc8] text-[11px] text-[#167a52] flex items-center gap-2 font-medium">
          <Users size={14} className="shrink-0" />
          <span>
            Todos os sócios administradores têm visibilidade integral de todas as mensagens.
          </span>
        </div>

        {/* Recipients (To) */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#5b6573]">Destinatários:</span>
            <label className="flex items-center gap-1.5 text-xs text-[#17202a] cursor-pointer">
              <input
                type="checkbox"
                checked={toAll}
                onChange={(e) => setToAll(e.target.checked)}
                className="rounded accent-[#167a52]"
              />
              Enviar para todos os sócios
            </label>
          </div>

          {!toAll && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {partners.map((p) => {
                const checked = toUserIds.includes(p.uid);
                return (
                  <button
                    key={p.uid}
                    type="button"
                    onClick={() =>
                      setToUserIds((prev) =>
                        checked ? prev.filter((id) => id !== p.uid) : [...prev, p.uid],
                      )
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      checked
                        ? 'bg-[#eef5ff] border-[#bfdbfe] text-[#1d4ed8] font-semibold'
                        : 'bg-white border-[#e3e7ec] text-[#5b6573] hover:text-[#17202a]'
                    }`}
                  >
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Type & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
              Tipo de Mensagem
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as InboxMessageType)}
              className="w-full px-2.5 py-2 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-[#17202a]"
            >
              <option value="message">Mensagem comum</option>
              <option value="note">Nota interna</option>
              <option value="decision">Decisão em pauta</option>
              <option value="incident">Incidente operacional</option>
              <option value="announcement">Comunicado geral</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
              Prioridade
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as InboxPriority)}
              className="w-full px-2.5 py-2 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-[#17202a]"
            >
              <option value="informative">Informativa</option>
              <option value="attention">Atenção</option>
              <option value="important">Importante</option>
              <option value="critical">Crítica</option>
            </select>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
            Assunto
          </label>
          <input
            type="text"
            autoFocus
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Assunto claro e direto..."
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#e3e7ec] text-xs text-[#17202a] placeholder:text-[#838e9b]"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
            Mensagem
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Descreva a mensagem, contexto, dúvida ou alinhamento..."
            className="w-full p-3 rounded-lg bg-white border border-[#e3e7ec] text-xs text-[#17202a] placeholder:text-[#838e9b] leading-relaxed"
          />
        </div>

        {/* Assignment & Routing */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
              Responsável (opcional)
            </label>
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-[#17202a]"
            >
              <option value="">Nenhum</option>
              {partners.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
              Aguardar resposta de
            </label>
            <select
              value={requestedResponseFromUserId}
              onChange={(e) => setRequestedResponseFromUserId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-[#17202a]"
            >
              <option value="">Ninguém específico</option>
              {partners.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
              Prazo limite
            </label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-[#17202a]"
            />
          </div>
        </div>

        {/* Link Entities */}
        <div className="space-y-1.5 text-xs pt-2 border-t border-[#e3e7ec]">
          <label className="block text-[11px] font-semibold text-[#5b6573]">
            Vincular entidade do sistema (opcional)
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value as InboxEntityType);
                setEntityId('');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-[#17202a]"
            >
              <option value="product">Produto</option>
              <option value="order">Pedido</option>
              <option value="customer">Cliente</option>
              <option value="ticket">Ticket</option>
            </select>
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-[#17202a]"
            >
              <option value="">Selecione o item...</option>
              {entityChoices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddEntity}
              className="px-3.5 py-1.5 rounded-lg border border-[#e3e7ec] bg-white text-[#17202a] font-medium hover:bg-[#f1f4f7]"
            >
              Vincular
            </button>
          </div>

          {relatedEntities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {relatedEntities.map((ent) => (
                <span
                  key={`${ent.type}_${ent.id}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f6f7f9] border border-[#e3e7ec] text-[11px] text-[#5b6573]"
                >
                  <span>{ent.label}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setRelatedEntities((prev) =>
                        prev.filter((x) => !(x.type === ent.type && x.id === ent.id)),
                      )
                    }
                    className="hover:text-[#17202a]"
                    aria-label={`Remover ${ent.label}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Attachments */}
        <div className="space-y-1.5 text-xs pt-2 border-t border-[#e3e7ec]">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-[#5b6573] inline-flex items-center gap-1">
              <Paperclip size={13} />
              Anexos privados (JPG, PNG, WEBP, PDF, CSV, XLSX, DOCX, TXT — máx. 15 MB)
            </label>
          </div>
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,.csv,.xlsx,.docx,.txt"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              const valid: File[] = [];
              for (const f of files) {
                const v = validateInboxAttachment({
                  fileName: f.name,
                  mimeType: f.type,
                  size: f.size,
                });
                if (!v.valid) {
                  onError(('reason' in v ? v.reason : undefined) || `Arquivo inválido: ${f.name}`);
                } else {
                  valid.push(f);
                }
              }
              setPendingFiles((prev) => [...prev, ...valid]);
            }}
            className="text-xs text-[#5b6573]"
          />

          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {pendingFiles.map((f, i) => (
                <span
                  key={`${f.name}_${i}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f6f7f9] border border-[#e3e7ec] text-[11px] text-[#17202a]"
                >
                  <FileText size={11} className="text-[#838e9b]" />
                  <span className="truncate max-w-[140px]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="hover:text-[#c2414b]"
                    aria-label={`Remover ${f.name}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Create Task Toggle */}
        <label className="flex items-center gap-2 text-xs text-[#17202a] cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={createTaskAlong}
            onChange={(e) => setCreateTaskAlong(e.target.checked)}
            className="rounded accent-[#167a52]"
          />
          Criar tarefa operacional vinculada automaticamente
        </label>
        </div>

        {/* Fixed Footer */}
        <div className="flex justify-end gap-2 px-6 py-3.5 border-t border-[#e3e7ec] bg-[#fbfcfd] shrink-0">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium border border-[#e3e7ec] bg-white text-[#5b6573] hover:text-[#17202a] hover:bg-[#f1f4f7] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#167a52] hover:bg-[#106441] text-white disabled:opacity-60 transition-opacity"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span>{submitStage || 'Enviar Mensagem'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
