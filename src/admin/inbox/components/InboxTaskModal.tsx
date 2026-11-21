import React, { useState } from 'react';
import { Calendar, CheckSquare, Loader2, X } from 'lucide-react';
import type { AdminInboxMessage, InboxPriority, PartnerAdminMember } from '../types';
import { convertInboxMessageToTask } from '../../../services/adminInboxService';

interface InboxTaskModalProps {
  message: AdminInboxMessage;
  partners: PartnerAdminMember[];
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}

export const InboxTaskModal: React.FC<InboxTaskModalProps> = ({
  message,
  partners,
  onClose,
  onCreated,
  onError,
}) => {
  const [title, setTitle] = useState(
    message.suggestedTask?.title || `[Inbox] ${message.subject}`,
  );
  const [description, setDescription] = useState(
    message.suggestedTask?.description || message.body.slice(0, 600),
  );
  const [priority, setPriority] = useState<InboxPriority>(
    message.suggestedTask?.priority || message.priority,
  );
  const [assignedToUserId, setAssignedToUserId] = useState(
    message.assignedToUserId || message.suggestedTask?.suggestedAssigneeUid || '',
  );
  const [dueAt, setDueAt] = useState('');
  const [checklistText, setChecklistText] = useState(
    (message.suggestedTask?.checklist || []).join('\n'),
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onError('Informe o título da tarefa.');
      return;
    }
    setSubmitting(true);
    try {
      const partner = partners.find((p) => p.uid === assignedToUserId);
      const checklist = checklistText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((label) => ({ label, done: false }));

      await convertInboxMessageToTask({
        messageId: message.id,
        title: title.trim(),
        description: description.trim(),
        priority,
        assignedToUserId: assignedToUserId || undefined,
        assignedToName: partner?.name,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        checklist,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao criar tarefa.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="convert-task-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#e3e7ec] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs text-[#17202a]"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#e3e7ec]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#e8f4ee] text-[#167a52]">
              <CheckSquare size={16} />
            </span>
            <h3 id="convert-task-title" className="text-sm font-bold text-[#17202a]">
              Converter em Tarefa Operacional
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de tarefa"
            className="p-1 rounded-lg text-[#5b6573] hover:text-[#17202a] hover:bg-[#f1f4f7]"
          >
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
            Título da Tarefa
          </label>
          <input
            type="text"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Ajustar margem do item..."
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#e3e7ec] text-xs text-[#17202a]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
            Descrição / Contexto
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Detalhes para execução..."
            className="w-full p-3 rounded-lg bg-white border border-[#e3e7ec] text-xs text-[#17202a]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
              Prioridade
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as InboxPriority)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-xs text-[#17202a]"
            >
              <option value="informative">Informativa</option>
              <option value="attention">Atenção</option>
              <option value="important">Importante</option>
              <option value="critical">Crítica</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
              Responsável
            </label>
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-xs text-[#17202a]"
            >
              <option value="">Sem responsável</option>
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
            <div className="relative">
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-xs text-[#17202a]"
              />
              <Calendar size={12} className="hidden" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
            Checklist (um item por linha)
          </label>
          <textarea
            value={checklistText}
            onChange={(e) => setChecklistText(e.target.value)}
            rows={3}
            placeholder="Ex: Conferir estoque físico&#10;Acionar fornecedor&#10;Validar preço"
            className="w-full p-3 rounded-lg bg-white border border-[#e3e7ec] text-xs text-[#17202a] font-mono text-[11px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#e3e7ec]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg font-medium border border-[#e3e7ec] bg-white text-[#5b6573] hover:text-[#17202a] hover:bg-[#f1f4f7]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold bg-[#167a52] hover:bg-[#106441] text-white disabled:opacity-50"
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : null}
            Criar Tarefa
          </button>
        </div>
      </form>
    </div>
  );
};
