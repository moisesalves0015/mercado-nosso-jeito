import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  Check,
  Edit2,
  FolderTree,
  Image as ImageIcon,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData } from '../AdminDataContext';
import {
  EmptyState,
  MetricCard,
  PageHeader,
  ReasonConfirmModal,
} from '../components/AdminUi';
import {
  deleteAdminCategory,
  getAdminCategories,
  saveAdminCategory,
  slugifyCategory,
  toggleAdminCategoryActive,
  type AdminCategory,
} from '../../services/categoryService';

export const AdminCategoriesPage: React.FC = () => {
  const { canAny } = useAuth();
  const { products, showToast } = useAdminData();

  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formId, setFormId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formOrder, setFormOrder] = useState('1');
  const [formActive, setFormActive] = useState(true);
  const [formType, setFormType] = useState<'search' | 'route' | 'category'>('search');
  const [formTarget, setFormTarget] = useState('');

  const canEdit = canAny(['produtos:edit', 'produtos:create']);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await getAdminCategories();
      setCategories(data);
    } catch {
      showToast('Erro ao carregar categorias.', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Compute products per category
  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.category) {
        const key = p.category.trim().toLowerCase();
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [products]);

  // Enriched categories with product count
  const enrichedCategories = useMemo(() => {
    return categories.map((cat) => {
      const count =
        productCountMap.get(cat.name.trim().toLowerCase()) ||
        productCountMap.get(cat.id.trim().toLowerCase()) ||
        0;
      return { ...cat, productCount: count };
    });
  }, [categories, productCountMap]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedCategories.filter((cat) => {
      if (statusFilter === 'active' && !cat.active) return false;
      if (statusFilter === 'inactive' && cat.active) return false;
      if (q) {
        const matchName = cat.name.toLowerCase().includes(q);
        const matchId = cat.id.toLowerCase().includes(q);
        const matchDesc = cat.description?.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDesc) return false;
      }
      return true;
    });
  }, [enrichedCategories, searchQuery, statusFilter]);

  // Metrics
  const activeCount = useMemo(() => categories.filter((c) => c.active).length, [categories]);
  const categoriesWithProducts = useMemo(
    () => enrichedCategories.filter((c) => (c.productCount || 0) > 0).length,
    [enrichedCategories],
  );

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormId('');
    setFormDescription('');
    setFormImage('');
    setFormOrder(String(categories.length + 1));
    setFormActive(true);
    setFormType('search');
    setFormTarget('');
    setModalOpen(true);
  };

  const openEditModal = (cat: AdminCategory) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormId(cat.id);
    setFormDescription(cat.description || '');
    setFormImage(cat.image || '');
    setFormOrder(String(cat.order || 1));
    setFormActive(cat.active !== false);
    setFormType(cat.type || 'search');
    setFormTarget(cat.target || cat.id);
    setModalOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingCategory) {
      setFormId(slugifyCategory(name));
      if (!formTarget) setFormTarget(slugifyCategory(name));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('O nome da categoria é obrigatório.', 'err');
      return;
    }

    setSaving(true);
    try {
      const payload: AdminCategory = {
        id: formId.trim() || slugifyCategory(formName),
        name: formName.trim(),
        description: formDescription.trim(),
        image: formImage.trim(),
        order: parseInt(formOrder, 10) || 1,
        active: formActive,
        type: formType,
        target: formTarget.trim() || formId.trim() || slugifyCategory(formName),
      };

      await saveAdminCategory(payload);
      showToast(
        editingCategory
          ? `Categoria "${payload.name}" atualizada com sucesso!`
          : `Categoria "${payload.name}" criada com sucesso!`,
        'ok',
      );
      setModalOpen(false);
      await loadCategories();
    } catch {
      showToast('Erro ao salvar categoria.', 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat: AdminCategory) => {
    const nextState = !cat.active;
    const ok = await toggleAdminCategoryActive(cat.id, nextState);
    if (ok) {
      showToast(
        nextState
          ? `Categoria "${cat.name}" ativada!`
          : `Categoria "${cat.name}" desativada.`,
        'ok',
      );
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, active: nextState } : c)),
      );
    } else {
      showToast('Falha ao alternar status da categoria.', 'err');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await deleteAdminCategory(deleteTarget.id);
    if (ok) {
      showToast(`Categoria "${deleteTarget.name}" removida com sucesso.`, 'ok');
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      showToast('Erro ao excluir categoria.', 'err');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Categorias"
        subtitle="Organize as categorias da vitrine, atalhos rápidos e mapeamento com os produtos do catálogo."
        badge={`${categories.length} cadastradas`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadCategories}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)]"
              title="Recarregar categorias"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <Link
              to="/admin/products"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)]"
            >
              <Boxes size={14} />
              Ver Produtos
            </Link>
            {canEdit && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs transition-colors"
              >
                <Plus size={15} />
                Nova Categoria
              </button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <MetricCard
          label="Total de Categorias"
          value={categories.length}
          icon={<FolderTree size={16} />}
        />
        <MetricCard
          label="Categorias Ativas"
          value={activeCount}
          subtitle={`${categories.length ? Math.round((activeCount / categories.length) * 100) : 0}% ativas`}
          tone="emerald"
          icon={<Check size={16} />}
        />
        <MetricCard
          label="Categorias com Produtos"
          value={categoriesWithProducts}
          icon={<Layers size={16} />}
        />
        <MetricCard
          label="Total de Produtos no Catálogo"
          value={products.length}
          icon={<Tag size={16} />}
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-dim)] pointer-events-none"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar categoria por nome, identificador slug ou descrição..."
              aria-label="Buscar categorias"
              className="adm-input w-full pl-9 pr-4 py-2 text-xs sm:text-sm placeholder-[var(--adm-text-dim)]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'active', label: 'Ativas' },
              { id: 'inactive', label: 'Desativadas' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-[var(--adm-brand)] text-emerald-950 font-bold'
                    : 'bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] border border-[var(--adm-border)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table / List */}
      {filteredCategories.length === 0 ? (
        <EmptyState
          icon={<FolderTree size={22} />}
          title="Nenhuma categoria encontrada"
          description={
            searchQuery
              ? 'Nenhuma categoria corresponde à busca digitada.'
              : 'Cadastre sua primeira categoria para organizar os produtos.'
          }
          action={
            canEdit && (
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] text-emerald-950 font-bold text-xs inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                Cadastrar Categoria
              </button>
            )
          }
        />
      ) : (
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--adm-surface-elevated)] text-[var(--adm-text-dim)] font-bold uppercase tracking-wider text-[10px] border-b border-[var(--adm-border)]">
                <tr>
                  <th className="py-3 px-4">Ordem</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Identificador (Slug)</th>
                  <th className="py-3 px-4">Destino / Tipo</th>
                  <th className="py-3 px-4 text-center">Produtos Vinculados</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-border)] text-[var(--adm-text)]">
                {filteredCategories.map((cat) => (
                  <tr
                    key={cat.id}
                    className="hover:bg-[var(--adm-surface-elevated)]/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-[var(--adm-text-dim)] font-bold">
                      #{cat.order}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {cat.image ? (
                          <img
                            src={cat.image}
                            alt={cat.name}
                            className="w-10 h-10 rounded-lg object-contain bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] shrink-0 p-1"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] flex items-center justify-center text-[var(--adm-text-dim)] shrink-0">
                            <ImageIcon size={16} />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-sm text-[var(--adm-text)]">
                            {cat.name}
                          </div>
                          {cat.description && (
                            <div className="text-[11px] text-[var(--adm-text-dim)] line-clamp-1">
                              {cat.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[var(--adm-text-muted)] text-[11px]">
                      {cat.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] text-[var(--adm-text-muted)]">
                        <span className="uppercase">{cat.type || 'search'}</span>
                        <span className="text-[var(--adm-text-dim)]">→</span>
                        <span className="text-[var(--adm-gold)]">{cat.target || cat.id}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold">
                      <Link
                        to={`/admin/products?category=${encodeURIComponent(cat.name)}`}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                          (cat.productCount || 0) > 0
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                        title="Ver produtos desta categoria"
                      >
                        <Tag size={12} />
                        {cat.productCount || 0}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(cat)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${
                          cat.active
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                        title="Clique para alternar status"
                      >
                        {cat.active ? 'Ativa' : 'Desativada'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEditModal(cat)}
                            className="p-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] border border-[var(--adm-border)] transition-colors"
                            title="Editar categoria"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(cat)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 transition-colors"
                            title="Excluir categoria"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit / Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[12px] max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--adm-border)] pb-4">
              <div className="flex items-center gap-2">
                <FolderTree size={20} className="text-[var(--adm-gold)]" />
                <h3 className="text-base font-bold text-[var(--adm-text)]">
                  {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--adm-text-dim)] hover:text-[var(--adm-text)] rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Bebidas, Churrasco, Pet Shop..."
                  className="adm-input w-full p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                    Slug / Identificador *
                  </label>
                  <input
                    type="text"
                    required
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="ex: bebidas"
                    className="adm-input w-full p-2.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formOrder}
                    onChange={(e) => setFormOrder(e.target.value)}
                    className="adm-input w-full p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                  Descrição (Opcional)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Breve descrição da categoria"
                  className="adm-input w-full p-2.5"
                />
              </div>

              <div>
                <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                  URL do Ícone / Imagem (PNG transparente recomendado)
                </label>
                <input
                  type="text"
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  placeholder="/categories/bebidas.png ou URL externa"
                  className="adm-input w-full p-2.5 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                    Tipo de Navegação
                  </label>
                  <select
                    value={formType}
                    onChange={(e) =>
                      setFormType(e.target.value as 'search' | 'route' | 'category')
                    }
                    className="adm-input w-full p-2.5"
                  >
                    <option value="search">Busca Dinâmica (search)</option>
                    <option value="route">Página Própria (route)</option>
                    <option value="category">Filtro Exato (category)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                    Destino / Rota
                  </label>
                  <input
                    type="text"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    placeholder="ex: doces ou /bebidas"
                    className="adm-input w-full p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="cat-active"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--adm-border)] bg-[var(--adm-bg-subtle)] text-[var(--adm-brand)] focus:ring-0"
                />
                <label
                  htmlFor="cat-active"
                  className="text-xs font-semibold text-[var(--adm-text)] cursor-pointer"
                >
                  Ativa na vitrine do aplicativo
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--adm-border)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text-muted)] font-semibold text-xs border border-[var(--adm-border)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  {saving ? 'Salvando...' : 'Salvar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ReasonConfirmModal
        open={Boolean(deleteTarget)}
        title={`Excluir Categoria — ${deleteTarget?.name || ''}`}
        description="Ao remover esta categoria, os produtos já cadastrados não serão apagados, mas deixarão de estar associados ao link desta categoria."
        confirmLabel="Excluir Categoria"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
