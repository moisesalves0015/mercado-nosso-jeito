import type { HeroBannerConfig, HomeLayoutBlock, RoundCardItem } from '../types/home';

export const DEFAULT_BRANDS: RoundCardItem[] = [
  {
    id: 'brand-heineken',
    name: 'Heineken',
    subtitle: 'Cervejas',
    image: '/heineken.png',
    link: '/search?q=Heineken',
    order: 0,
    active: true,
  },
  {
    id: 'brand-coca-cola',
    name: 'Coca-Cola',
    subtitle: 'Refrigerantes',
    image: '/coca_cola_zero.png',
    link: '/search?q=Coca-Cola',
    order: 1,
    active: true,
  },
  {
    id: 'brand-monster',
    name: 'Monster',
    subtitle: 'Energéticos',
    image: '/monster_energy.webp',
    link: '/search?q=Monster',
    order: 2,
    active: true,
  },
  {
    id: 'brand-spaten',
    name: 'Spaten',
    subtitle: 'Puro Malte',
    image: '/spaten.webp',
    link: '/search?q=Spaten',
    order: 3,
    active: true,
  },
  {
    id: 'brand-padaria',
    name: 'Fornada',
    subtitle: 'Padaria',
    image: '/pao_de_queijo.png',
    link: '/padaria',
    order: 4,
    active: true,
  },
  {
    id: 'brand-ofertas',
    name: 'Seleção VIP',
    subtitle: 'Promoções',
    image: '/hero_background.png',
    link: '/promotions',
    order: 5,
    active: true,
  },
];

export const DEFAULT_LOCAL_PARTNERS: RoundCardItem[] = [
  {
    id: 'partner-padaria-artesanal',
    name: 'Padaria do Bairro',
    subtitle: 'Pães & Doces',
    image: '/pao_de_queijo.png',
    link: '/padaria',
    badge: 'Local',
    order: 0,
    active: true,
  },
  {
    id: 'partner-adega-express',
    name: 'Adega Gelada',
    subtitle: 'Bebidas 24h',
    image: '/hero_bebidas.png',
    link: '/bebidas',
    badge: 'Local',
    order: 1,
    active: true,
  },
  {
    id: 'partner-tabacaria',
    name: 'Empório Lounge',
    subtitle: 'Conveniência',
    image: '/hero_background.png',
    link: '/tabacaria',
    badge: 'Parceiro',
    order: 2,
    active: true,
  },
  {
    id: 'partner-eletronicos',
    name: 'Tech Express',
    subtitle: 'Acessórios',
    image: '/hero_background.png',
    link: '/eletronicos',
    badge: 'Parceiro',
    order: 3,
    active: true,
  },
];

/**
 * Monta a estrutura padrão de blocos da Home quando o admin ainda não salvou
 * uma ordenação customizada em `home-config/data/home-layout`.
 */
export function buildDefaultHomeLayout(
  vitrineEntries: ReadonlyArray<{ id: string; title: string }>,
  inlineBanners: ReadonlyArray<HeroBannerConfig> = [],
): HomeLayoutBlock[] {
  const blocks: HomeLayoutBlock[] = [];
  let order = 0;
  const push = (b: Omit<HomeLayoutBlock, 'order'>) => {
    blocks.push({ ...b, order: order++ });
  };

  push({ id: 'block-hero', type: 'hero', label: 'Banner Principal (Hero)', active: true });
  push({ id: 'block-quick-categories', type: 'quick_categories', label: 'Atalhos Rápidos', active: true });
  push({ id: 'block-search', type: 'search', label: 'Barra de Busca', active: true });
  push({ id: 'block-period-selector', type: 'period_selector', label: 'Mais Pedidos por Horário', active: true });
  push({ id: 'block-social-proof', type: 'social_proof', label: 'Faixa Editorial / Prova Social', active: true });

  // Vitrines grupo 1 (primeiras 2)
  vitrineEntries.slice(0, 2).forEach((v) => {
    push({ id: `block-vitrine-${v.id}`, type: 'vitrine', label: `Vitrine: ${v.title}`, refId: v.id, active: true });
  });

  // Se houver banner inline #1, insere após o primeiro grupo de vitrines
  if (inlineBanners[0]) {
    push({
      id: `block-banner-${inlineBanners[0].id}`,
      type: 'banner',
      label: `Banner: ${inlineBanners[0].title || 'Promocional'}`,
      refId: inlineBanners[0].id,
      active: true,
    });
  }

  push({ id: 'block-mega-ofertas', type: 'mega_ofertas', label: 'Mega Ofertas', active: true });

  // Vitrines grupo 2 (próximas 2)
  vitrineEntries.slice(2, 4).forEach((v) => {
    push({ id: `block-vitrine-${v.id}`, type: 'vitrine', label: `Vitrine: ${v.title}`, refId: v.id, active: true });
  });

  // Se houver banner inline #2, insere após grupo 2
  if (inlineBanners[1]) {
    push({
      id: `block-banner-${inlineBanners[1].id}`,
      type: 'banner',
      label: `Banner: ${inlineBanners[1].title || 'Promocional'}`,
      refId: inlineBanners[1].id,
      active: true,
    });
  }

  // Novo bloco: Marcas (cards redondos)
  push({
    id: 'block-brands',
    type: 'brands',
    label: 'Marcas (Cards Redondos)',
    title: 'Principais Marcas',
    subtitle: 'As marcas que você confia sempre geladas e fresquinhas',
    active: true,
  });

  push({ id: 'block-promo-banners', type: 'promo_banners', label: 'Banners Frete Grátis / Indicação', active: true });

  // Vitrines restantes + banners inline restantes intercalados
  const remainingVitrines = vitrineEntries.slice(4);
  const remainingBanners = inlineBanners.slice(2);
  remainingVitrines.forEach((v, idx) => {
    push({ id: `block-vitrine-${v.id}`, type: 'vitrine', label: `Vitrine: ${v.title}`, refId: v.id, active: true });
    if (remainingBanners[idx]) {
      push({
        id: `block-banner-${remainingBanners[idx].id}`,
        type: 'banner',
        label: `Banner: ${remainingBanners[idx].title || 'Promocional'}`,
        refId: remainingBanners[idx].id,
        active: true,
      });
    }
  });
  remainingBanners.slice(remainingVitrines.length).forEach((b) => {
    push({
      id: `block-banner-${b.id}`,
      type: 'banner',
      label: `Banner: ${b.title || 'Promocional'}`,
      refId: b.id,
      active: true,
    });
  });

  // Novo bloco: Parceiros Locais (cards redondos)
  push({
    id: 'block-local-partners',
    type: 'local_partners',
    label: 'Parceiros Locais (Cards Redondos)',
    title: 'Parceiros Locais',
    subtitle: 'Comércios e produtores selecionados perto de você',
    active: true,
  });

  push({ id: 'block-benefit-cards', type: 'benefit_cards', label: 'Cartões de Benefícios', active: true });
  push({ id: 'block-categories', type: 'categories', label: 'Categorias Ilustradas', active: true });
  push({ id: 'block-condo-favorites', type: 'condo_favorites', label: 'Favoritos do Condomínio', active: true });

  return blocks;
}

