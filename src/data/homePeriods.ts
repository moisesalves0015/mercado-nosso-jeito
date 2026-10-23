/**
 * Metadados dos períodos do dia (conteúdo editorial, separado dos componentes visuais).
 *
 * IMPORTANTE: `FALLBACK_PERIOD_PRODUCT_IDS` NÃO é catálogo. São apenas IDs de produtos usados
 * quando `home-config/data/period-config/{periodo}` não define produtos; cada ID só aparece se
 * existir em `products`, estiver ativo e com estoque (título/preço/imagem vêm do produto).
 */
import type { HomePeriod } from '../types/home';
import manhaBg from '../assets/bkgs/manha.png';
import almocoBg from '../assets/bkgs/almoco.png';
import tardeBg from '../assets/bkgs/tarde.png';
import noiteBg from '../assets/bkgs/noite.png';
import madrugadaBg from '../assets/bkgs/madrugada.png';

export interface PeriodMeta {
  id: HomePeriod;
  label: string;
  buttonSubtitle: string;
  defaultTitle: string;
  background: string;
}

export const PERIOD_ORDER: HomePeriod[] = ['morning', 'lunch', 'afternoon', 'night', 'dawn'];

export const PERIOD_META: Record<HomePeriod, PeriodMeta> = {
  morning: { id: 'morning', label: 'Manhã', buttonSubtitle: 'Café da manhã', defaultTitle: 'Essenciais do Café da Manhã', background: manhaBg },
  lunch: { id: 'lunch', label: 'Almoço', buttonSubtitle: 'Refeições', defaultTitle: 'Sugestões para o Almoço', background: almocoBg },
  afternoon: { id: 'afternoon', label: 'Tarde', buttonSubtitle: 'Lanches', defaultTitle: 'Lanches da Tarde', background: tardeBg },
  night: { id: 'night', label: 'Noite', buttonSubtitle: 'Jantar', defaultTitle: 'Destaques para o Jantar', background: noiteBg },
  dawn: { id: 'dawn', label: 'Madrugada', buttonSubtitle: 'Essenciais', defaultTitle: 'Essenciais da Madrugada', background: madrugadaBg },
};

export const FALLBACK_PERIOD_PRODUCT_IDS: Record<HomePeriod, string[]> = {
  morning: ['paodequeijo-novo', 'iogurte-novo', 'granola-novo', 'ovos-novo', 'cafe-novo'],
  lunch: ['peito_de_peru', 'queijo_minas', 'manteiga_itambe', 'coca-cola-350ml', 'heineken-330ml'],
  afternoon: ['pao_de_forma', 'manteiga_itambe', 'cha_leao', 'iogurte-novo', 'suco_laranja'],
  night: ['heineken-330ml', 'spaten-350ml', 'monster-energy', 'coca-cola-350ml', 'peito_de_peru'],
  dawn: ['monster-energy', 'cafe_pilao', 'lava_roupa', 'pano_multiuso', 'heineken-330ml'],
};
