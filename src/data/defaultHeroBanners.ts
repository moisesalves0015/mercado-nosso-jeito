import type { HeroBannerConfig } from '../types/home';

export const DEFAULT_HERO_BANNERS: HeroBannerConfig[] = [
  {
    id: 'default-promocoes',
    title: 'Promoções',
    subtitle: 'Ofertas selecionadas da loja',
    image: '/hero_background.png',
    link: '/promotions',
    badgeText: 'Destaques',
    badgeIcon: '🔥',
    buttonText: 'Ver Ofertas',
    highlightWords: [],
    order: 0,
    active: true,
  },
  {
    id: 'default-bebidas',
    title: 'Bebidas',
    subtitle: 'Geladas e prontas para entrega',
    image: '/hero_bebidas.png',
    link: '/bebidas',
    badgeText: 'Adega & Bebidas',
    badgeIcon: '🍺',
    buttonText: 'Ver Bebidas',
    highlightWords: [],
    order: 1,
    active: true,
  },
  {
    id: 'default-tabacaria',
    title: 'Tabacaria',
    subtitle: 'Conveniência completa no seu condomínio',
    image: '/hero_tabacaria.png',
    link: '/tabacaria',
    badgeText: 'Conveniência',
    badgeIcon: '✨',
    buttonText: 'Ver Tabacaria',
    highlightWords: [],
    order: 2,
    active: true,
  },
];

