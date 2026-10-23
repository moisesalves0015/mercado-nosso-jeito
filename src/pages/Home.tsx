/**
 * Home — vitrine principal.
 *
 * Esta página apenas COMPÕE blocos; cada bloco vive em src/components/home/*.
 * Fontes de dados:
 *  - produtos:        useCatalog (coleção `products`, mesmo cache de busca/detalhe/carrinho);
 *  - editorial:       useHomeConfig (`home-config/data/*`, normalizado e validado);
 *  - suporte/prazo:   useAdminConfig (`settings/admin`);
 *  - frete:           useShippingConfig (`settings/shipping`);
 *  - categorias:      src/data/homeCategories.ts (declarativo).
 * Nenhum produto, preço ou métrica fictícia é gerado no front-end.
 */
import { useMemo } from 'react';
import { Topbar } from '../components/Topbar';
import { PwaInstallBanner } from '../components/PwaInstallBanner';
import { SocialProofBanner } from '../components/SocialProofBanner';
import { HomeHero } from '../components/home/HomeHero';
import type { HeroSlide } from '../components/home/HomeHero';
import { HomeQuickCategories } from '../components/home/HomeQuickCategories';
import { HomeSearch } from '../components/home/HomeSearch';
import { HomePeriodSelector } from '../components/home/HomePeriodSelector';
import { HomeVitrineList } from '../components/home/HomeVitrineList';
import { HomeMegaOffers } from '../components/home/HomeMegaOffers';
import { HomeBenefitCards, HomePromoBanners } from '../components/home/HomeBenefitCards';
import { HomeCategoryCarousel } from '../components/home/HomeCategoryCarousel';
import { HomeCondoFavorites } from '../components/home/HomeCondoFavorites';
import { HomeFooter } from '../components/home/HomeFooter';
import { useCatalog } from '../hooks/useCatalog';
import { useHomeConfig } from '../hooks/useHomeConfig';
import { useAdminConfig } from '../hooks/useAdminConfig';
import { useShippingConfig } from '../hooks/useShippingConfig';
import { QUICK_CATEGORIES, VISUAL_CATEGORIES } from '../data/homeCategories';
import { buildShowcases } from '../utils/homeShowcases';

/**
 * Fallback visual APENAS quando não há banners configurados. Títulos neutros: não prometem
 * campanha ("ofertas do dia" etc.) que possa não existir.
 */
const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  { id: 'default-promocoes', image: '/hero_background.png', link: '/promotions', title: 'Promoções' },
  { id: 'default-bebidas', image: '/hero_bebidas.png', link: '/bebidas', title: 'Bebidas' },
  { id: 'default-tabacaria', image: '/hero_tabacaria.png', link: '/tabacaria', title: 'Tabacaria' },
];

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export const Home = () => {
  const catalog = useCatalog();
  const homeConfig = useHomeConfig();
  const { config: adminConfig } = useAdminConfig();
  const { config: shippingConfig } = useShippingConfig();

  // Cópia ordenada (nunca muta o array recebido do hook).
  const heroSlides = useMemo<HeroSlide[]>(() => {
    if (homeConfig.heroBanners.length === 0) return DEFAULT_HERO_SLIDES;
    return [...homeConfig.heroBanners].sort(byOrder).map(b => ({
      id: b.id,
      title: b.title || 'Banner',
      image: b.image,
      link: b.link,
    }));
  }, [homeConfig.heroBanners]);

  const showcases = useMemo(
    () => buildShowcases(homeConfig.vitrines, catalog.products, catalog.byId),
    [homeConfig.vitrines, catalog.products, catalog.byId],
  );

  const quickCategories = useMemo(() => QUICK_CATEGORIES.filter(c => c.active).sort(byOrder), []);
  const visualCategories = useMemo(() => VISUAL_CATEGORIES.filter(c => c.active).sort(byOrder), []);

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <div className="app" style={{ position: 'relative', zIndex: 1, paddingBottom: 6 }}>
          <Topbar />

          {/* Convite de instalação do PWA */}
          <PwaInstallBanner />

          {/* Carrossel de banners (admin: home-config/data/hero-banners) */}
          <HomeHero slides={heroSlides} />

          {/* Atalhos rápidos + busca */}
          <HomeQuickCategories items={quickCategories} />
          <HomeSearch />
        </div>
      </div>

      <main className="app" style={{ paddingTop: 0 }}>
        {homeConfig.error && (
          <div className="section-state-message" role="status">
            Algumas seções da página podem estar desatualizadas. Tente recarregar em instantes.
          </div>
        )}

        {/* Os mais pedidos por horário */}
        <HomePeriodSelector catalog={catalog} periodConfig={homeConfig.periodConfig} />

        {/* Mensagens editoriais (sem números fabricados) */}
        <div style={{ padding: '0 0 0' }}>
          <SocialProofBanner />
        </div>

        {/* Vitrines — grupo 1 */}
        <HomeVitrineList showcases={showcases.slice(0, 2)} catalog={catalog} />

        {/* MEGA OFERTAS */}
        <HomeMegaOffers catalog={catalog} megaOfertas={homeConfig.megaOfertas} />

        {/* Vitrines — grupo 2 */}
        <HomeVitrineList showcases={showcases.slice(2, 4)} catalog={catalog} />

        {/* Frete grátis / indicação */}
        <HomePromoBanners freeShippingThreshold={shippingConfig.freeShippingThreshold} />

        {/* Vitrines — grupo 3 (inclui todas as restantes) */}
        <HomeVitrineList showcases={showcases.slice(4)} catalog={catalog} />

        {/* Entrega, Clube e segurança */}
        <HomeBenefitCards deliveryEta={adminConfig.deliveryEta} />

        {/* Categorias ilustradas */}
        <HomeCategoryCarousel items={visualCategories} />

        {/* Favoritos do Condomínio */}
        <HomeCondoFavorites catalog={catalog} favorites={homeConfig.condoFavorites} />

        <HomeFooter config={adminConfig} />
      </main>
    </div>
  );
};
