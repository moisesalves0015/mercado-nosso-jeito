import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AdminMarketing } from '../../components/AdminMarketing';
import { PageHeader } from '../components/AdminUi';

export const AdminMarketingPage: React.FC = () => (
  <div className="space-y-5">
    <PageHeader
      title="Marketing, Banners & Cupons"
      subtitle="Gerencie banners da vitrine, ofertas relâmpago, vitrines temáticas, cupons e campanhas patrocinadas do Clube."
      badge="Campanhas"
      actions={
        <Link
          to="/admin/marketing/campaigns"
          className="px-3.5 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
        >
          <Sparkles size={14} />
          Anúncios Patrocinados (Clube)
        </Link>
      }
    />
    <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 sm:p-6">
      <AdminMarketing />
    </div>
  </div>
);

