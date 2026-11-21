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
    if (!subject.trim() || !body.trim()) {
      onError('Preencha o assunto e a mensagem.');
      return;
    }
    if (!toAll && toUserIds.length === 0) {
      onError('Selecione pelo menos um sócio ou marque Todos os sócios.');
      return;
    }
    setSubmitting(true);
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
      });

      for (const file of pendingFiles) {
        await uploadInboxAttachment(res.messageId, file).promise;
      }

      onCreated(res.messageId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--adm-border)]">
          <div>
            <h3 id="compose-modal-title" className="text-sm font-bold text-[var(--adm-text)]">
              Nova Mensagem Administrativa
            </h3>
            <p className="text-[11px] text-[var(--adm-text-dim)]">
              Caixa compartilhada entre os sócios administradores
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário de nova mensagem"
            className="p-1 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] hover:bg-[var(--adm-surface-elevated)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Privacy Pill */}
        <div className="p-2.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
          <Users size={14} className="shrink-0" />
          <span>
            Todos os sócios administradores têm visibilidade integral de todas as mensagens.
          </span>
        </div>

        {/* Recipients (To) */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[var(--adm-text-muted)]">Destinatários:</span>
            <label className="flex items-center gap-1.5 text-xs text-[var(--adm-text)] cursor-pointer">
              <input
                type="checkbox"
                checked={toAll}
                onChange={(e) => setToAll(e.target.checked)}
                className="rounded"
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
                        ? 'bg-[var(--adm-gold-soft)] border-[var(--adm-gold-border)] text-[var(--adm-gold)] font-medium'
                        : 'bg-[var(--adm-bg)] border-[var(--adm-border)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]'
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
            <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
              Tipo de Mensagem
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as InboxMessageType)}
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
            >
              <option value="message">Mensagem comum</option>
              <option value="note">Nota interna</option>
              <option value="decision">Decisão em pauta</option>
              <option value="incident">Incidente operacional</option>
              <option value="announcement">Comunicado geral</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
              Prioridade
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as InboxPriority)}
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
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
          <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
            Assunto
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Assunto claro e direto..."
            className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)] focus:outline-none focus:border-[var(--adm-gold-border)]"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
            Mensagem
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Descreva a mensagem, contexto, dúvida ou alinhamento..."
            className="w-full p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)] focus:outline-none focus:border-[var(--adm-gold-border)] leading-relaxed"
          />
        </div>

        {/* Assignment & Routing */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
              Responsável (opcional)
            </label>
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
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
            <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
              Aguardar resposta de
            </label>
            <select
              value={requestedResponseFromUserId}
              onChange={(e) => setRequestedResponseFromUserId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
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
            <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
              Prazo limite
            </label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
            />
          </div>
        </div>

        {/* Link Entities */}
        <div className="space-y-1.5 text-xs pt-1 border-t border-[var(--adm-border)]">
          <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)]">
            Vincular entidade do sistema (opcional)
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value as InboxEntityType);
                setEntityId('');
              }}
              className="px-2 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
            >
              <option value="product">Produto</option>
              <option value="order">Pedido</option>
              <option value="customer">Cliente</option>
              <option value="ticket">Ticket</option>
            </select>
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="flex-1 min-w-[180px] px-2 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
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
              className="px-3 py-1.5 rounded-lg border border-[var(--adm-border)] text-[var(--adm-gold)] font-medium hover:bg-[var(--adm-surface-elevated)]"
            >
              Vincular
            </button>
          </div>

          {relatedEntities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {relatedEntities.map((ent) => (
                <span
                  key={`${ent.type}_${ent.id}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[11px] text-[var(--adm-text-muted)]"
                >
                  <span>{ent.label}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setRelatedEntities((prev) =>
                        prev.filter((x) => !(x.type === ent.type && x.id === ent.id)),
                      )
                    }
                    className="hover:text-[var(--adm-text)]"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Attachments */}
        <div className="space-y-1.5 text-xs pt-1 border-t border-[var(--adm-border)]">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-[var(--adm-text-muted)] inline-flex items-center gap-1">
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
                  onError(v.reason || `Arquivo inválido: ${f.name}`);
                } else {
                  valid.push(f);
                }
              }
              setPendingFiles((prev) => [...prev, ...valid]);
            }}
            className="text-xs text-[var(--adm-text-muted)]"
          />

          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {pendingFiles.map((f, i) => (
                <span
                  key={`${f.name}_${i}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[11px]"
                >
                  <FileText size={11} className="text-[var(--adm-text-dim)]" />
                  <span className="truncate max-w-[140px]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="hover:text-[var(--adm-text)]"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Create Task Toggle */}
        <label className="flex items-center gap-2 text-xs text-[var(--adm-text)] cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={createTaskAlong}
            onChange={(e) => setCreateTaskAlong(e.target.checked)}
            className="rounded"
          />
          Criar tarefa operacional vinculada automaticamente
        </label>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--adm-border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium border border-[var(--adm-border)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold bg-[var(--adm-gold)] text-[#09120e] disabled:opacity-50 hover:opacity-95"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar Mensagem
          </button>
        </div>
      </form>
    </div>
  );
};
