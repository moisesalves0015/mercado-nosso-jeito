import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import { resolveLink } from '../../utils/homeProducts';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

export interface HeroSlide {
  id: string;
  title: string;
  /** Pode ser vazio: o slide mostra o título em texto sobre um fundo neutro. */
  image: string;
  /** Rota interna, URL http(s) ou vazio (slide sem destino). */
  link: string;
}

const ROTATE_MS = 4500;
const MIN_SWIPE_PX = 50;

/**
 * Carrossel de banners da Home.
 *  - Rotação automática pausa com mouse, foco ou `prefers-reduced-motion`.
 *  - O timer NÃO reinicia a cada troca de slide (depende só de quantidade/pausa).
 *  - O índice é sempre limitado à quantidade atual (banner removido não deixa o carrossel vazio).
 *  - Teclado: ←/→ no carrossel; pontos são botões reais.
 */
export const HomeHero = ({ slides }: { slides: HeroSlide[] }) => {
  const count = slides.length;
  const reducedMotion = usePrefersReducedMotion();
  const [rawIndex, setRawIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const index = count > 0 ? Math.min(rawIndex, count - 1) : 0;

  useEffect(() => {
    if (count <= 1 || reducedMotion || paused) return;
    const interval = setInterval(() => {
      setRawIndex(prev => (Math.min(prev, count - 1) + 1) % count);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [count, reducedMotion, paused]);

  const go = (delta: number) => setRawIndex((Math.min(rawIndex, count - 1) + delta + count) % count);

  const onTouchStart = (e: TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };
  const onTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };
  const onTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null || count <= 1) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > MIN_SWIPE_PX) go(1);
    else if (distance < -MIN_SWIPE_PX) go(-1);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (count <= 1) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  };

  if (count === 0) return null;

  return (
    <div
      className="hero-banner"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Destaques da loja"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
      onKeyDown={onKeyDown}
    >
      <div className="hero-slider-track" style={{ transform: `translateX(-${index * 100}%)` }} aria-live={paused || reducedMotion ? 'polite' : 'off'}>
        {slides.map((slide, idx) => {
          const active = idx === index;
          const link = resolveLink(slide.link);
          const common = {
            className: `hero-slide${slide.image ? '' : ' hero-slide--text'}`,
            style: slide.image ? { backgroundImage: `url('${slide.image}')` } : undefined,
            'aria-label': `${slide.title || 'Banner'} (${idx + 1} de ${count})`,
            'aria-hidden': active ? undefined : true,
          } as const;
          // Slides fora de vista não entram na ordem de tabulação.
          const tabIndex = active ? undefined : -1;
          const content = slide.image ? null : <span className="hero-slide-title">{slide.title}</span>;

          if (link?.kind === 'internal') {
            return <Link key={slide.id} {...common} tabIndex={tabIndex} to={link.href}>{content}</Link>;
          }
          if (link?.kind === 'external') {
            return <a key={slide.id} {...common} tabIndex={tabIndex} href={link.href} target="_blank" rel="noopener noreferrer">{content}</a>;
          }
          // Sem link válido: slide apenas informativo (não clicável).
          return <div key={slide.id} role="group" {...common}>{content}</div>;
        })}
      </div>

      {count > 1 && (
        <div className="hero-dots" role="group" aria-label="Navegar entre slides">
          {slides.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              className={`dot ${index === idx ? 'active' : ''}`}
              aria-label={`Ir para o slide ${idx + 1}: ${slide.title || 'Banner'}`}
              aria-current={index === idx ? 'true' : undefined}
              onClick={() => setRawIndex(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
