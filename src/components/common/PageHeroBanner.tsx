import React, { useMemo } from 'react';
import { HomeHero, type HeroSlide } from '../home/HomeHero';
import { useHomeConfig } from '../../hooks/useHomeConfig';

export interface PageHeroBannerProps {
  placement: 'promotions' | 'bebidas' | 'padaria' | 'tabacaria' | 'eletronicos' | 'home' | string;
  defaultSlides?: HeroSlide[];
}

export const PageHeroBanner: React.FC<PageHeroBannerProps> = ({
  placement,
  defaultSlides = [],
}) => {
  const homeConfig = useHomeConfig();

  const slides = useMemo<HeroSlide[]>(() => {
    const targetKey = placement.toLowerCase().trim();
    const matching = homeConfig.heroBanners.filter((b) => {
      if (b.active === false) return false;
      const bPlace = (b.placement || 'home').toLowerCase().trim();
      return bPlace === targetKey || bPlace === 'all';
    });

    if (matching.length > 0) {
      return [...matching]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((b) => ({
          id: b.id,
          title: b.title || 'Destaque',
          image: b.image,
          link: b.link || '',
          videoUrl: b.videoUrl,
          mediaType: b.mediaType,
          posterImage: b.posterImage,
        }));
    }

    return defaultSlides;
  }, [homeConfig.heroBanners, placement, defaultSlides]);

  if (slides.length === 0) return null;

  return (
    <div className="page-hero-banner-wrapper" style={{ margin: '14px 4px 18px 4px' }}>
      <HomeHero slides={slides} />
    </div>
  );
};

export default PageHeroBanner;
