import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface SectionProps {
  title: string;
  /** Texto único ou lista rotativa. Aceita string | string[] (padronizado internamente). */
  subtitle?: string | string[];
  theme?: 'hero' | 'purple' | 'orange' | 'green';
  linkText?: string;
  /**
   * Destino do link "Ver tudo". Sem `to`, o link NÃO é renderizado (nada de `href="#"`).
   * A regra de negócio (qual categoria/busca) é decidida por quem usa a Section.
   */
  to?: string;
  /** Layout configurado na vitrine: `grid` quebra em linhas; `horizontal`/`carousel` rolam na horizontal. */
  layout?: 'horizontal' | 'grid' | 'carousel';
  /** Mostra mensagem de carregamento no lugar dos produtos. */
  loading?: boolean;
  /** Quando true (e não está carregando), mostra `emptyMessage` em vez de uma linha vazia. */
  isEmpty?: boolean;
  emptyMessage?: string;
  children?: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({
  title,
  subtitle,
  theme = 'green',
  linkText,
  to,
  layout = 'horizontal',
  loading = false,
  isEmpty = false,
  emptyMessage = 'Nenhum produto disponível no momento.',
  children,
}) => {
  const isHero = theme === 'hero';
  const headingId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Chave estável: o efeito só reinicia quando o CONTEÚDO dos subtítulos muda,
  // não quando o pai recria o array a cada render.
  const subtitleKey = Array.isArray(subtitle) ? subtitle.join('\u0000') : subtitle ?? '';
  const subtitles = useMemo(() => (subtitleKey ? subtitleKey.split('\u0000') : []), [subtitleKey]);
  const activeIndex = subtitles.length > 0 ? currentIndex % subtitles.length : 0;

  useEffect(() => {
    if (subtitles.length <= 1 || reducedMotion) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % subtitles.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [subtitles.length, reducedMotion]);

  const showMessage = loading || isEmpty;

  return (
    <section
      className={`section ${isHero ? 'hero-section' : `standard-section ${theme}`}`}
      aria-labelledby={headingId}
    >
      <div className="section-header">
        <div className="section-header-left">
          <h2 id={headingId}>{title}</h2>
          {subtitles.length > 0 && (
            <div className="animated-subtitle-container">
              {subtitles.map((text, idx) => {
                let className = 'animated-subtitle';
                if (subtitles.length === 1 || reducedMotion) {
                  if (idx === 0) className += ' active';
                } else if (idx === activeIndex) {
                  className += ' active';
                } else if (idx === (activeIndex - 1 + subtitles.length) % subtitles.length) {
                  className += ' exit';
                }
                // Só o subtítulo visível é lido por leitores de tela.
                const hidden = !className.includes('active');
                return (
                  <p key={`${idx}-${text}`} className={className} aria-hidden={hidden || undefined}>{text}</p>
                );
              })}
            </div>
          )}
        </div>
        {linkText && to && (
          <Link to={to} aria-label={`${linkText.replace(/[>]/g, '').trim()} — ${title}`}>{linkText}</Link>
        )}
      </div>

      <div className="products-wrapper">
        {isHero && <div className="scroll-arrow left" aria-hidden="true">&lt;</div>}
        {showMessage ? (
          <div className="section-state-message" role="status">
            {loading ? 'Carregando produtos…' : emptyMessage}
          </div>
        ) : (
          // Região rolável focável: permite rolar com as setas do teclado.
          <div className={`products${layout === 'grid' ? ' products--grid' : ''}`} role="group" aria-label={`Produtos: ${title}`} tabIndex={0}>
            {children}
          </div>
        )}
        {isHero && <div className="scroll-arrow right" aria-hidden="true">&gt;</div>}
      </div>
    </section>
  );
};
