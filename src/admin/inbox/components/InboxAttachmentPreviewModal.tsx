import React, { useEffect } from 'react';
import { Download, X } from 'lucide-react';
import type { InboxAttachment } from '../types';

interface InboxAttachmentPreviewModalProps {
  attachment: InboxAttachment;
  url: string;
  onClose: () => void;
}

export const InboxAttachmentPreviewModal: React.FC<InboxAttachmentPreviewModalProps> = ({
  attachment,
  url,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isPdf = attachment.mimeType === 'application/pdf';
  const isImage = attachment.mimeType.startsWith('image/');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Topbar */}
        <div className="px-5 py-3.5 border-b border-[var(--adm-border)] flex items-center justify-between gap-3 bg-[var(--adm-surface-elevated)]/60">
          <div className="min-w-0">
            <h3 id="preview-modal-title" className="text-xs font-semibold text-[var(--adm-text)] truncate">
              {attachment.originalName}
            </h3>
            <p className="text-[10px] text-[var(--adm-text-dim)]">
              {(attachment.size / (1024 * 1024)).toFixed(2)} MB • Visualização segura temporária
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={url}
              download={attachment.originalName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--adm-border)] text-[var(--adm-gold)] hover:bg-[var(--adm-surface)] transition-colors"
            >
              <Download size={13} />
              Baixar
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar pré-visualização"
              className="p-1.5 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] hover:bg-[var(--adm-surface)] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-black/30">
          {isImage ? (
            <img
              src={url}
              alt={attachment.originalName}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-sm"
            />
          ) : isPdf ? (
            <iframe
              src={url}
              title={attachment.originalName}
              className="w-full h-[75vh] rounded-lg border-0 bg-white"
            />
          ) : (
            <div className="text-center p-8 text-xs text-[var(--adm-text-muted)]">
              Formato não suporta pré-visualização direta. Utilize o botão acima para baixar com segurança.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
