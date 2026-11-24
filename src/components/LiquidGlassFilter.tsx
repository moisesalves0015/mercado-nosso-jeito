/**
 * Filtro SVG global do efeito "liquid glass".
 * Usado via CSS: backdrop-filter: url(#liquid-glass) blur(...)
 * Combina desfoque interno do backdrop + ruído fractal orgânico +
 * deslocamento cromático/óptico (feDisplacementMap) para refratar e
 * embaçar de verdade o conteúdo que passa por trás dos elementos flutuantes.
 */
export const LiquidGlassFilter = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
  >
    <defs>
      <filter
        id="liquid-glass"
        x="-15%"
        y="-15%"
        width="130%"
        height="130%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.015 0.024"
          numOctaves="3"
          seed="17"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="2.8" result="softNoise" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="11" result="preBlur" />
        <feDisplacementMap
          in="preBlur"
          in2="softNoise"
          scale="42"
          xChannelSelector="R"
          yChannelSelector="G"
          result="displaced"
        />
        <feGaussianBlur in="displaced" stdDeviation="5" result="finalBlur" />
      </filter>
    </defs>
  </svg>
);
