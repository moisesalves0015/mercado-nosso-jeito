import React from 'react';
import { AdminMarketing } from '../../components/AdminMarketing';
import { PageHeader } from '../components/AdminUi';

export const AdminMarketingPage: React.FC = () => (
  <div className="space-y-6">
    <PageHeader
      title="Marketing, Banners & Cupons"
      subtitle="Gerencie banners da vitrine, ofertas relâmpago, vitrines temáticas e cupons promocionais."
      badge="Campanhas"
    />
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-lg">
      <AdminMarketing />
    </div>
  </div>
);

