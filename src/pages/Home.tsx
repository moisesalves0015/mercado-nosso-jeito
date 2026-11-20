/**
 * Home — vitrine principal composicional (No-Code Page Builder).
 *
 * A ordem e visibilidade de todos os blocos da Home são controladas em tempo real
 * pelo CRM Admin (`home-config/data/home-layout`), permitindo posicionar banners
 * entre vitrines, reordenar seções e gerenciar Marcas e Parceiros Locais.
 */
import { useMemo, useEffect } from 'react';
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
import { HomeRoundCardList } from '../components/home/HomeRoundCardList';
import { HomeFooter } from '../components/home/HomeFooter';
import { HomeFullPageSkeleton } from '../components/home/HomeFullPageSkeleton';
import { useCatalog } from '../hooks/useCatalog';
import { useHomeConfig } from '../hooks/useHomeConfig';
import { useAdminConfig } from '../hooks/useAdminConfig';
import { useShippingConfig } from '../hooks/useShippingConfig';
import { QUICK_CATEGORIES, VISUAL_CATEGORIES } from '../data/homeCategories';
import { DEFAULT_HERO_BANNERS } from '../data/defaultHeroBanners';
import {
  DEFAULT_BRANDS,
  DEFAULT_LOCAL_PARTNERS,
  buildDefaultHomeLayout,
} from '../data/defaultHomeExtras';
import { buildShowcases } from '../utils/homeShowcases';
import type { HeroBannerConfig, HomeLayoutBlock } from '../types/home';

const DEFAULT_HERO_SLIDES: HeroSlide[] = DEFAULT_HERO_BANNERS.map((b) => ({
  id: b.id,
  image: b.image,
  link: b.link,
  title: b.title,
}));

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

const toHeroSlide = (b: HeroBannerConfig): HeroSlide => ({
  id: b.id,
  title: b.title || 'Banner',
  image: b.image,
  link: b.link,
  videoUrl: b.videoUrl,
  mediaType: b.mediaType,
  posterImage: b.posterImage,
  aspectRatio: b.aspectRatio,
});

export const Home = () => {
  const catalog = useCatalog();
  const homeConfig = useHomeConfig();
  const { config: adminConfig } = useAdminConfig();
  const { config: shippingConfig } = useShippingConfig();

  // Banners principais do topo (Hero)
  const heroSlides = useMemo<HeroSlide[]>(() => {
    if (homeConfig.heroBanners.length === 0) return DEFAULT_HERO_SLIDES;
    const activeBanners = homeConfig.heroBanners.filter(
      (b) => b.active !== false && (!b.placement || b.placement === 'home' || b.placement === 'all'),
    );
    if (activeBanners.length === 0) return DEFAULT_HERO_SLIDES;
    return [...activeBanners].sort(byOrder).map(toHeroSlide);
  }, [homeConfig.heroBanners]);

  // Banners intermediários cadastrados com placement='home-inline'
  const inlineBanners = useMemo<HeroBannerConfig[]>(
    () =>
      homeConfig.heroBanners
        .filter((b) => b.active !== false && b.placement === 'home-inline')
        .sort(byOrder),
    [homeConfig.heroBanners],
  );

  const showcases = useMemo(
    () => buildShowcases(homeConfig.vitrines, catalog.products, catalog.byId),
    [homeConfig.vitrines, catalog.products, catalog.byId],
  );

  const showcasesById = useMemo(() => {
    const map = new Map<string, (typeof showcases)[number]>();
    showcases.forEach((s) => map.set(s.key, s));
    return map;
  }, [showcases]);

  const bannersById = useMemo(() => {
    const map = new Map<string, HeroBannerConfig>();
    homeConfig.heroBanners.forEach((b) => map.set(b.id, b));
    return map;
  }, [homeConfig.heroBanners]);

  const quickCategories = useMemo(() => QUICK_CATEGORIES.filter((c) => c.active).sort(byOrder), []);
  const visualCategories = useMemo(() => VISUAL_CATEGORIES.filter((c) => c.active).sort(byOrder), []);

  const effectiveBrands = useMemo(
    () => (homeConfig.brands.length > 0 ? homeConfig.brands : DEFAULT_BRANDS),
    [homeConfig.brands],
  );

  const effectivePartners = useMemo(
    () => (homeConfig.localPartners.length > 0 ? homeConfig.localPartners : DEFAULT_LOCAL_PARTNERS),
    [homeConfig.localPartners],
  );

  // Estrutura efetiva da Home: customizada no CRM Admin ou fallback padrão inteligente
  const effectiveLayout = useMemo<HomeLayoutBlock[]>(() => {
    if (homeConfig.homeLayout.length > 0) {
      return [...homeConfig.homeLayout].sort(byOrder);
    }
    return buildDefaultHomeLayout(
      showcases.map((s) => ({ id: s.key, title: s.title })),
      inlineBanners,
    );
  }, [homeConfig.homeLayout, showcases, inlineBanners]);

  const isPageReady =
    (!catalog.loading || catalog.products.length > 0) &&
    (!homeConfig.loading || homeConfig.vitrines.length > 0);

  useEffect(() => {
    if (isPageReady) {
      const dismiss = (window as unknown as { __dismissAppSplash?: () => void }).__dismissAppSplash;
      if (typeof dismiss === 'function') {
        dismiss();
      }
    }
  }, [isPageReady]);

  if (!isPageReady) {
    return <HomeFullPageSkeleton />;
  }

  const renderBlock = (block: HomeLayoutBlock) => {
    if (block.active === false) return null;

    switch (block.type) {
      case 'hero':
        return <HomeHero key={block.id} slides={heroSlides} />;

      case 'quick_categories':
        return <HomeQuickCategories key={block.id} items={quickCategories} />;

      case 'search':
        return <HomeSearch key={block.id} />;

      case 'period_selector':
        return (
          <HomePeriodSelector
            key={block.id}
            catalog={catalog}
            periodConfig={homeConfig.periodConfig}
          />
        );

      case 'social_proof':
        return (
          <div key={block.id} style={{ padding: '0 var(--content-padding-x, 14px)' }}>
            <SocialProofBanner />
          </div>
        );

      case 'vitrine': {
        if (!block.refId) return null;
        const matched = showcasesById.get(block.refId);
        if (!matched) return null;
        return <HomeVitrineList key={block.id} showcases={[matched]} catalog={catalog} />;
      }

      case 'banner': {
        if (!block.refId) return null;
        const single = bannersById.get(block.refId);
        if (single) {
          if (single.active === false) return null;
          return (
            <div key={block.id} className="home-inline-banner-slot">
              <HomeHero slides={[toHeroSlide(single)]} />
            </div>
          );
        }
        // Fallback: refId pode ser um placement (ex.: 'home-inline')
        const group = homeConfig.heroBanners
          .filter((b) => b.active !== false && b.placement === block.refId)
          .sort(byOrder);
        if (group.length === 0) return null;
        return (
          <div key={block.id} className="home-inline-banner-slot">
            <HomeHero slides={group.map(toHeroSlide)} />
          </div>
        );
      }

      case 'mega_ofertas':
        return (
          <HomeMegaOffers
            key={block.id}
            catalog={catalog}
            megaOfertas={homeConfig.megaOfertas}
          />
        );

      case 'brands':
        return (
          <HomeRoundCardList
            key={block.id}
            title={block.title || 'Principais Marcas'}
            subtitle={block.subtitle || 'As marcas que você confia sempre geladas e fresquinhas'}
            items={effectiveBrands}
            variant="brands"
            linkText="Ver tudo >"
            to="/search"
          />
        );

      case 'local_partners':
        return (
          <HomeRoundCardList
            key={block.id}
            title={block.title || 'Parceiros Locais'}
            subtitle={block.subtitle || 'Comércios e produtores selecionados perto de você'}
            items={effectivePartners}
            variant="partners"
          />
        );

      case 'promo_banners':
        return (
          <HomePromoBanners
            key={block.id}
            freeShippingThreshold={shippingConfig.freeShippingThreshold}
          />
        );

      case 'benefit_cards':
        return <HomeBenefitCards key={block.id} deliveryEta={adminConfig.deliveryEta} />;

      case 'categories':
        return <HomeCategoryCarousel key={block.id} items={visualCategories} />;

      case 'condo_favorites':
        return (
          <HomeCondoFavorites
            key={block.id}
            catalog={catalog}
            favorites={homeConfig.condoFavorites}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="page-fade-in" style={{ width: '100%', overflowX: 'hidden' }}>
      <main className="app" style={{ paddingTop: 0 }}>
        <PwaInstallBanner />

        {homeConfig.error && (
          <div className="section-state-message" role="status">
            Algumas seções da página podem estar desatualizadas. Tente recarregar em instantes.
          </div>
        )}

        {effectiveLayout.map(renderBlock)}

        <HomeFooter config={adminConfig} />
      </main>
    </div>
  );
};
