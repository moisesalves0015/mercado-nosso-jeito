import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ExternalLink,
  Headphones,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AdminDataProvider, useAdminData } from './AdminDataContext';
import './adminTheme.css';
import {
  ADMIN_NAV_ITEMS,
  NAV_GROUP_LABELS,
  resolveAdminBreadcrumbs,
  type AdminNavItem,
  type NavGroupId,
} from './routes';
import { RoleBadge } from './components/AdminUi';

const ICON_MAP: Record<AdminNavItem['iconName'], React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={18} />,
  ShoppingBag: <ShoppingBag size={18} />,
  Users: <Users size={18} />,
  Headphones: <Headphones size={18} />,
  Package: <Package size={18} />,
  Boxes: <Boxes size={18} />,
  DollarSign: <DollarSign size={18} />,
  Megaphone: <Megaphone size={18} />,
  Sparkles: <Sparkles size={18} />,
  BarChart3: <BarChart3 size={18} />,
  ShieldCheck: <ShieldCheck size={18} />,
  KeyRound: <KeyRound size={18} />,
  ScrollText: <ScrollText size={18} />,
  Settings: <Settings size={18} />,
};

const AdminShellInner: React.FC = () => {
  const { userProfile, staffAccess, canAny, logout } = useAuth();
  const { orders, products, clients, tickets, feedback } = useAdminData();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
    setQuickOpen(false);
  }, [location.pathname]);

  const breadcrumbs = useMemo(
    () => resolveAdminBreadcrumbs(location.pathname),
    [location.pathname],
  );

  // Operational badges for sidebar
  const badges = useMemo(() => {
    const pendingOrders = orders.filter(
      (o) => o.status === 'pending' || o.paymentStatus === 'awaiting_confirmation',
    ).length;
    const openTickets = tickets.filter(
      (t) => t.status === 'open' || t.status === 'in_progress',
    ).length;
    const lowStock = products.filter(
      (p) => p.active !== false && Number(p.stock ?? 0) <= Number(p.minStock ?? 5),
    ).length;
    const awaitingPix = orders.filter(
      (o) => o.status !== 'cancelled' && o.paymentStatus === 'awaiting_confirmation',
    ).length;

    return {
      orders: pendingOrders,
      support: openTickets,
      inventory: lowStock,
      finance: awaitingPix,
    } as Record<string, number>;
  }, [orders, products, tickets]);

  // Filter nav items by caller's permissions
  const visibleGroups = useMemo(() => {
    const groups: Array<{ group: NavGroupId; label: string; items: AdminNavItem[] }> = [];
    const order: NavGroupId[] = ['operacao', 'crm', 'catalogo', 'comercial', 'governanca'];
    for (const grp of order) {
      const items = ADMIN_NAV_ITEMS.filter(
        (item) => item.group === grp && canAny(item.requiredPermissions),
      );
      if (items.length > 0) {
        groups.push({ group: grp, label: NAV_GROUP_LABELS[grp], items });
      }
    }
    return groups;
  }, [canAny]);

  // Quick global search results
  const quickResults = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Array<{ label: string; sub: string; to: string; type: string }> = [];

    for (const o of orders) {
      if (
        o.id.toLowerCase().includes(q) ||
        (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
        (o.userName && o.userName.toLowerCase().includes(q))
      ) {
        out.push({
          type: 'Pedido',
          label: `Pedido #${(o.orderNumber || o.id).slice(0, 8).toUpperCase()}`,
          sub: `${o.userName || 'Cliente'} • R$ ${Number(o.total ?? 0).toFixed(2)}`,
          to: `/admin/orders/${o.id}`,
        });
        if (out.length >= 6) break;
      }
    }

    for (const c of clients) {
      if (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      ) {
        out.push({
          type: 'Morador',
          label: c.name || 'Sem nome',
          sub: c.email || c.id,
          to: `/admin/customers/${c.id}`,
        });
        if (out.length >= 8) break;
      }
    }

    for (const p of products) {
      if (
        p.title.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      ) {
        out.push({
          type: 'Produto',
          label: p.title,
          sub: `Estoque: ${p.stock ?? 0} un. • R$ ${Number(p.price ?? 0).toFixed(2)}`,
          to: `/admin/products/${p.id}`,
        });
        if (out.length >= 10) break;
      }
    }

    return out.slice(0, 8);
  }, [quickQuery, orders, clients, products]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setQuickOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderNavContent = (isMobile = false) => (
    <div className="flex flex-col h-full">
      {/* Brand header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-[var(--adm-border)] shrink-0">
        <Link to="/admin/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-900/90 border border-[var(--adm-gold-border)] text-[var(--adm-gold)] font-black text-xs flex items-center justify-center shrink-0">
            NJ
          </div>
          {(!collapsed || isMobile) && (
            <div className="truncate">
              <div className="text-sm font-extrabold text-[var(--adm-text)] tracking-tight leading-none">
                Nosso Jeito
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--adm-gold)] mt-0.5">
                CRM & Operações
              </div>
            </div>
          )}
        </Link>

        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] hover:bg-[var(--adm-surface-elevated)]"
            aria-label="Fechar menu lateral"
          >
            <X size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] hover:bg-[var(--adm-surface-elevated)]"
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* Navigation groups */}
      <nav
        aria-label="Navegação administrativa"
        className="flex-1 overflow-y-auto px-2.5 py-3.5 space-y-4"
      >
        {visibleGroups.map(({ group, label, items }) => (
          <div key={group}>
            {(!collapsed || isMobile) && (
              <div className="px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--adm-text-dim)]">
                {label}
              </div>
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
                const count = badges[item.id] ?? 0;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    title={collapsed && !isMobile ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-[var(--adm-brand)] text-emerald-950 font-bold'
                          : 'text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] hover:bg-[var(--adm-surface-elevated)]'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0">{ICON_MAP[item.iconName]}</span>
                      {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
                    </div>
                    {(!collapsed || isMobile) && count > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-black/25 text-current shrink-0 tabular-nums">
                        {count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer user & store link */}
      <div className="p-2.5 border-t border-[var(--adm-border)] space-y-1.5 shrink-0 bg-[var(--adm-bg)]">
        <Link
          to="/"
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] bg-[var(--adm-surface)] hover:bg-[var(--adm-surface-elevated)] border border-[var(--adm-border)] transition-colors"
          title="Voltar à vitrine da loja"
        >
          <ExternalLink size={14} />
          {(!collapsed || isMobile) && <span>Ver Loja do Morador</span>}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition-colors"
          title="Encerrar sessão"
        >
          <LogOut size={14} />
          {(!collapsed || isMobile) && <span>Sair da Conta</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin-shell min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-[var(--adm-bg-subtle)] border-r border-[var(--adm-border)] shrink-0 transition-all duration-200 sticky top-0 h-screen ${
          collapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        {renderNavContent(false)}
      </aside>

      {/* Mobile & Tablet Off-Canvas Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu administrativo"
        >
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-[var(--adm-bg-subtle)] border-r border-[var(--adm-border-strong)] h-full z-10 flex flex-col">
            {renderNavContent(true)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar (Selective frosted glass) */}
        <header className="sticky top-0 z-30 h-16 adm-glass border-b border-[var(--adm-border)] px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-[var(--adm-surface)] text-[var(--adm-text)] border border-[var(--adm-border)] hover:bg-[var(--adm-surface-elevated)]"
              aria-label="Abrir menu de navegação"
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs sm:text-sm truncate">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={`${crumb.label}-${idx}`}>
                    {idx > 0 && <span className="text-[var(--adm-text-dim)]">/</span>}
                    {crumb.to && !isLast ? (
                      <Link
                        to={crumb.to}
                        className="text-[var(--adm-text-muted)] hover:text-[var(--adm-gold)] font-semibold transition-colors hidden sm:inline"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-[var(--adm-text)] font-bold truncate">{crumb.label}</span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          {/* Right controls: Quick Search + Role Badge + Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="relative hidden md:block w-60 lg:w-72">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-dim)] pointer-events-none"
              />
              <input
                type="search"
                value={quickQuery}
                onChange={(e) => {
                  setQuickQuery(e.target.value);
                  setQuickOpen(true);
                }}
                onFocus={() => setQuickOpen(true)}
                placeholder="Buscar pedido, morador, SKU..."
                aria-label="Busca rápida global no painel"
                className="adm-input w-full pl-9 pr-3 py-1.5 text-xs placeholder-[var(--adm-text-dim)]"
              />
              {quickOpen && quickQuery.trim().length >= 2 && (
                <div className="adm-glass absolute right-0 mt-2 w-80 border border-[var(--adm-border-strong)] rounded-[10px] shadow-2xl overflow-hidden z-50">
                  {quickResults.length === 0 ? (
                    <div className="p-4 text-xs text-[var(--adm-text-muted)] text-center">
                      Nenhum resultado para "{quickQuery}".
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--adm-border)] max-h-80 overflow-y-auto">
                      {quickResults.map((r, i) => (
                        <Link
                          key={`${r.to}-${i}`}
                          to={r.to}
                          onClick={() => {
                            setQuickOpen(false);
                            setQuickQuery('');
                          }}
                          className="block px-3.5 py-2.5 hover:bg-[var(--adm-surface-elevated)] transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[var(--adm-text)] truncate">{r.label}</span>
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border border-[var(--adm-gold-border)]">
                              {r.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--adm-text-muted)] truncate mt-0.5">{r.sub}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <RoleBadge roleId={staffAccess.roleId} status={staffAccess.status} />

            <div className="hidden sm:flex items-center gap-2 pl-2.5 border-l border-[var(--adm-border)]">
              <div className="text-right">
                <div className="text-xs font-bold text-[var(--adm-text)] leading-tight truncate max-w-[130px]">
                  {userProfile?.name || 'Operador'}
                </div>
                <div className="text-[10px] text-[var(--adm-text-dim)] truncate max-w-[130px]">
                  {userProfile?.email || ''}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Global Feedback Toast */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-[10px] shadow-2xl border text-xs sm:text-sm font-semibold transition-all ${
              feedback.type === 'ok'
                ? 'bg-[#0b2316] border-[var(--adm-brand-border)] text-emerald-100'
                : 'bg-[#280d14] border-rose-500/40 text-rose-100'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            ) : (
              <XCircle size={18} className="text-rose-400 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* Active Route Outlet */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const AdminLayout: React.FC = () => (
  <AdminDataProvider>
    <AdminShellInner />
  </AdminDataProvider>
);
