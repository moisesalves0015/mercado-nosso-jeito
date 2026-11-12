import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { EmptyState } from '../components/AdminUi';

export const AdminNotFoundPage: React.FC = () => {
  const location = useLocation();
  return (
    <EmptyState
      icon={<Compass size={24} />}
      title="Rota Administrativa Não Encontrada (404)"
      description={`O caminho "${location.pathname}" não corresponde a nenhum módulo ativo do painel administrativo.`}
      action={
        <Link
          to="/admin/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs"
        >
          <ArrowLeft size={14} />
          Voltar para Visão Geral
        </Link>
      }
    />
  );
};

