import React from 'react';
import { AdminMarketing } from '../../components/AdminMarketing';
import { PageHeader } from '../components/AdminUi';

export const AdminMarketingPage: React.FC = () => (
  <div className="space-y-5">
    <PageHeader
      title="Marketing, Banners & Cupons"
      subtitle="Gerencie banners da vitrine, ofertas relâmpago, vitrines temáticas e cupons promocionais."
      badge="Campanhas"
    />
    <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 sm:p-6">
      <AdminMarketing />
    </div>
  </div>
);

