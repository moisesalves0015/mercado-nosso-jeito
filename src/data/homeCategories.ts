/**
 * Categorias da Home em formato declarativo.
 *
 * Novas categorias = novo item aqui (sem duplicar JSX). Nenhum atalho/categoria anterior foi
 * removido. Tipos de destino:
 *  - `route`:    página própria (/promotions, /bebidas, ...);
 *  - `search`:   /search?q=termo (busca textual em título, descrição e categoria — tolerante a
 *                variações de maiúsculas/acentos, por isso é o padrão quando não há página própria);
 *  - `category`: /search?category=Valor (igualdade exata, normalizada, com o campo `category`
 *                do produto — use somente após conferir o valor real no catálogo).
 */
import type { HomeCategoryLink } from '../types/home';

export const QUICK_CATEGORIES: HomeCategoryLink[] = [
  { id: 'promocoes', label: 'Promoções', type: 'route', target: '/promotions', icon: 'flame', order: 1, active: true },
  { id: 'doces', label: 'Doces', type: 'search', target: 'doces', icon: 'candy', order: 2, active: true },
  { id: 'biscoitos', label: 'Biscoitos', type: 'search', target: 'biscoitos', icon: 'cookie', order: 3, active: true },
  { id: 'higiene', label: 'Higiene', type: 'search', target: 'higiene', icon: 'droplet', order: 4, active: true },
  { id: 'limpeza', label: 'Limpeza', type: 'search', target: 'limpeza', icon: 'sparkles', order: 5, active: true },
  { id: 'combos', label: 'Combos', type: 'search', target: 'combos', icon: 'gift', order: 6, active: true },
  { id: 'ver-todas', label: 'Ver todas', type: 'route', target: '/categories', icon: 'layout-grid', order: 7, active: true },
];

const img = (slug: string) => `/categories/${slug}.png`;

export const VISUAL_CATEGORIES: HomeCategoryLink[] = [
  { id: 'promocoes', label: 'Ofertas', type: 'route', target: '/promotions', image: img('promocoes'), order: 1, active: true },
  { id: 'bebidas', label: 'Bebidas', type: 'route', target: '/bebidas', image: img('bebidas'), order: 2, active: true },
  { id: 'padaria', label: 'Padaria', type: 'route', target: '/padaria', image: img('padaria'), order: 3, active: true },
  { id: 'congelados', label: 'Congelados', type: 'search', target: 'congelados', image: img('congelados'), order: 4, active: true },
  { id: 'petshop', label: 'Pet Shop', type: 'search', target: 'petshop', image: img('petshop'), order: 5, active: true },
  { id: 'salgadinhos', label: 'Salgadinhos', type: 'search', target: 'salgadinhos', image: img('salgadinhos'), order: 6, active: true },
  { id: 'doces', label: 'Doces', type: 'search', target: 'doces', image: img('doces'), order: 7, active: true },
  { id: 'biscoitos', label: 'Biscoitos', type: 'search', target: 'biscoitos', image: img('biscoitos'), order: 8, active: true },
  { id: 'beleza', label: 'Beleza', type: 'search', target: 'beleza', image: img('beleza'), order: 9, active: true },
  { id: 'limpeza', label: 'Limpeza', type: 'search', target: 'limpeza', image: img('limpeza'), order: 10, active: true },
  { id: 'eletronicos', label: 'Eletrônicos', type: 'route', target: '/eletronicos', image: img('eletronicos'), order: 11, active: true },
  { id: 'tabacaria', label: 'Tabacaria', type: 'route', target: '/tabacaria', image: img('tabacaria'), order: 12, active: true },
  { id: 'sorvetes', label: 'Sorvetes', type: 'search', target: 'sorvetes', image: img('sorvetes'), order: 13, active: true },
  { id: 'utilidades', label: 'Utilidades', type: 'search', target: 'utilidades', image: img('utilidades'), order: 14, active: true },
  { id: 'churrasco', label: 'Churrasco', type: 'search', target: 'churrasco', image: img('churrasco'), order: 15, active: true },
  { id: 'adega', label: 'Adega', type: 'search', target: 'adega', image: img('adega'), order: 16, active: true },
  { id: 'bomboniere', label: 'Bomboniere', type: 'search', target: 'bomboniere', image: img('bomboniere'), order: 17, active: true },
  { id: 'higiene', label: 'Higiene', type: 'search', target: 'higiene', image: img('higiene'), order: 18, active: true },
  { id: 'fitness', label: 'Fitness', type: 'search', target: 'fitness', image: img('fitness'), order: 19, active: true },
  { id: 'combos', label: 'Combos', type: 'search', target: 'combos', image: img('combos'), order: 20, active: true },
];
