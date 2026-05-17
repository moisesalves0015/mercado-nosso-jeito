import React, { useState, useEffect } from 'react';

interface SectionProps {
  title: string;
  subtitle?: string | string[];
  theme?: 'hero' | 'purple' | 'orange' | 'green';
  linkText?: string;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({
  title,
  subtitle,
  theme = 'green',
  linkText,
  children,
}) => {
  const isHero = theme === 'hero';
  const [currentIndex, setCurrentIndex] = useState(0);

  const subtitles = Array.isArray(subtitle) ? subtitle : (subtitle ? [subtitle] : []);

  useEffect(() => {
    if (subtitles.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % subtitles.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [subtitles.length]);

  return (
    <section className={`section ${isHero ? 'hero-section' : `standard-section ${theme}`}`}>
      <div className="section-header">
        <div className="section-header-left">
          <h2>{title}</h2>
          {subtitles.length > 0 && (
            <div className="animated-subtitle-container">
              {subtitles.map((text, idx) => {
                let className = "animated-subtitle";
                if (subtitles.length === 1) {
                  className += " active";
                } else {
                  if (idx === currentIndex) className += " active";
                  else if (idx === (currentIndex - 1 + subtitles.length) % subtitles.length) className += " exit";
                }
                
                return (
                  <p key={idx} className={className}>{text}</p>
                );
              })}
            </div>
          )}
        </div>
        {linkText && <a href="#">{linkText}</a>}
      </div>

      <div className="products-wrapper">
        {isHero && <div className="scroll-arrow left">&lt;</div>}
        
        {isHero ? (
          <div className="products">{children}</div>
        ) : (
          <div className="section-inner-glass">
            <div className="products">{children}</div>
          </div>
        )}
        
        {isHero && <div className="scroll-arrow right">&gt;</div>}
      </div>
    </section>
  );
};
