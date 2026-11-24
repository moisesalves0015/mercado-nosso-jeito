/**
 * Filtro SVG global do efeito "liquid glass".
 * Usado via CSS: backdrop-filter: url(#liquid-glass) blur(...)
 * Combina desfoque profundo do backdrop + ruído fractal orgânico +
 * deslocamento óptico (feDisplacementMap) para dissolver totalmente formas,
 * fotos e textos de trás, deixando apenas manchas líquidas refratadas.
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
        x="-20%"
        y="-20%"
        width="140%"
        height="140%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.018 0.028"
          numOctaves="3"
          seed="23"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="3.2" result="softNoise" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="preBlur" />
        <feDisplacementMap
          in="preBlur"
          in2="softNoise"
          scale="58"
          xChannelSelector="R"
          yChannelSelector="G"
          result="displaced"
        />
        <feGaussianBlur in="displaced" stdDeviation="12" result="finalBlur" />
      </filter>
    </defs>
  </svg>
);
