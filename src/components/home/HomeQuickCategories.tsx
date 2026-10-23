import { Link } from 'react-router-dom';
import { Flame, Candy, Cookie, Droplet, Sparkles, Gift, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HomeCategoryLink } from '../../types/home';
import { getCategoryHref } from '../../utils/homeProducts';

const ICONS: Record<string, LucideIcon> = {
  flame: Flame,
  candy: Candy,
  cookie: Cookie,
  droplet: Droplet,
  sparkles: Sparkles,
  gift: Gift,
  'layout-grid': LayoutGrid,
};

/** Atalhos rápidos de categoria (lista declarativa em src/data/homeCategories.ts). */
export const HomeQuickCategories = ({ items }: { items: HomeCategoryLink[] }) => (
  <>
    <div className="section-header" style={{ padding: '0 8px', marginBottom: '2px', marginTop: '10px' }}>
      <h2 style={{ margin: 0, fontSize: '11.5px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Categorias</h2>
    </div>
    <nav className="quick-categories-grid-no-scroll" aria-label="Atalhos de categorias" style={{ marginBottom: '10px' }}>
      {items.map(item => {
        const Icon = ICONS[item.icon ?? ''] ?? LayoutGrid;
        return (
          <Link key={item.id} to={getCategoryHref(item)} className="quick-gold-card">
            <div className="quick-gold-icon-container" aria-hidden="true">
              <Icon size={24} />
            </div>
            <span className="quick-gold-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  </>
);
