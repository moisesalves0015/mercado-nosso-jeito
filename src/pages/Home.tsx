import { useState, useEffect } from 'react';
import { Topbar } from '../components/Topbar';
import { Section } from '../components/Section';
import { ProductCard } from '../components/ProductCard';
import { PromoCard } from '../components/PromoCard';
import { Bike, Award, Lock, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHomeConfig } from '../hooks/useHomeConfig';
import bannerFreteGratis from '../assets/banners/bannerFreteGratis.svg';
import bannerIndique from '../assets/banners/bannerIndique.svg';

// Custom SVG backgrounds and button assets
import manhaBg from '../assets/bkgs/manha.svg';
import almocoBg from '../assets/bkgs/almoço.svg';
import tardeBg from '../assets/bkgs/tarde.svg';
import noiteBg from '../assets/bkgs/noite.svg';
import madrugadaBg from '../assets/bkgs/madrugada.svg';

const periodBgs: Record<Period, string> = {
  morning: manhaBg,
  lunch: almocoBg,
  afternoon: tardeBg,
  night: noiteBg,
  dawn: madrugadaBg,
};


interface Product {
  id: string;
  title: string;
  price: number | string;
  image: string;
  category: string;
  badge?: string;
  badgeStyle?: 'orange' | 'light';
  diamondReward?: number;
}

type Period = 'morning' | 'lunch' | 'afternoon' | 'night' | 'dawn';

const periodTitles: Record<Period, string> = {
  morning: 'Essenciais do Café da Manhã',
  lunch: 'Sugestões para o Almoço',
  afternoon: 'Lanches da Tarde',
  night: 'Destaques para o Jantar',
  dawn: 'Essenciais da Madrugada',
};

const periodProducts: Record<Period, Product[]> = {
  morning: [
    { id: 'paodequeijo-novo', title: "Pão de Queijo Tradicional (1kg)", price: 32.90, image: "/paodequeijo-novo.webp", category: "cafe", diamondReward: 18 },
    { id: 'iogurte-novo', title: "Iogurte Grego Danone (4x)", price: 18.90, image: "/iogurte-novo.webp", category: "cafe", diamondReward: 12 },
    { id: 'granola-novo', title: "Granola Mel Barano (500g)", price: 24.90, image: "/granola-novo.png", category: "cafe" },
    { id: 'ovos-novo', title: "Ovo Branco Médio (12un)", price: 15.90, image: "/ovos-novo.png", category: "cafe" },
    { id: 'cafe-novo', title: "Café Melitta Tradicional (500g)", price: 19.90, image: "/cafe-novo.png", category: "cafe", diamondReward: 15 },
  ],
  lunch: [
    { id: 'peito_de_peru', title: "Peito de Peru Fatiado Sadia (100g)", price: 7.49, image: "/peito_de_peru.webp", category: "alimentos" },
    { id: 'queijo_minas', title: "Queijo Minas Frescal Itambé (300g)", price: 19.90, image: "/queijo_minas.png", category: "alimentos", badge: "Promocional", badgeStyle: "orange" },
    { id: 'manteiga_itambe', title: "Manteiga Itambé Extra Sal (200g)", price: 11.90, image: "/manteiga_itambe.png", category: "alimentos" },
    { id: 'coca-cola-350ml', title: "Refrigerante Coca-Cola Sem Açúcar Lata (350ml)", price: 4.50, image: "/coca_cola_zero.png", category: "Bebidas", diamondReward: 1 },
    { id: 'heineken-330ml', title: "Cerveja Heineken Long Neck (330ml)", price: 7.90, image: "/heineken.png", category: "Bebidas", badge: "Trincando", badgeStyle: "orange", diamondReward: 2 },
  ],
  afternoon: [
    { id: 'pao_de_forma', title: "Pão Pullman Forma Integral (500g)", price: 12.90, image: "/pao_de_forma.png", category: "alimentos", badge: "Melhor Preço", badgeStyle: "orange" },
    { id: 'manteiga_itambe', title: "Manteiga Itambé Extra Sal (200g)", price: 11.90, image: "/manteiga_itambe.png", category: "alimentos" },
    { id: 'cha_leao', title: "Chá Matte Natural Leão (100g)", price: 8.90, image: "/Cha-Matte-Natural-100g-Leao.png", category: "cafe" },
    { id: 'iogurte-novo', title: "Iogurte Grego Danone (4x)", price: 18.90, image: "/iogurte-novo.webp", category: "cafe", diamondReward: 12 },
    { id: 'suco_laranja', title: "Suco de Laranja Integral Do Bem (1L)", price: 12.90, image: "/suco_do_bem_laranja_integral.png", category: "cafe" },
  ],
  night: [
    { id: 'heineken-330ml', title: "Cerveja Heineken Long Neck (330ml)", price: 7.90, image: "/heineken.png", category: "Bebidas", badge: "Trincando", badgeStyle: "orange", diamondReward: 2 },
    { id: 'spaten-350ml', title: "Cerveja Spaten Puro Malte Lata (350ml)", price: 5.20, image: "/spaten.webp", category: "Bebidas", diamondReward: 1 },
    { id: 'monster-energy', title: "Energético Monster Energy Tradicional (473ml)", price: 9.90, image: "/monster_energy.webp", category: "Bebidas", badge: "Mais Vendido", badgeStyle: "orange", diamondReward: 3 },
    { id: 'coca-cola-350ml', title: "Refrigerante Coca-Cola Sem Açúcar Lata (350ml)", price: 4.50, image: "/coca_cola_zero.png", category: "Bebidas", diamondReward: 1 },
    { id: 'peito_de_peru', title: "Peito de Peru Fatiado Sadia (100g)", price: 7.49, image: "/peito_de_peru.webp", category: "alimentos" },
  ],
  dawn: [
    { id: 'monster-energy', title: "Energético Monster Energy Tradicional (473ml)", price: 9.90, image: "/monster_energy.webp", category: "Bebidas", badge: "Mais Vendido", badgeStyle: "orange", diamondReward: 3 },
    { id: 'cafe_pilao', title: "Café Pilão Torrado e Moído (500g)", price: 21.90, image: "/Café-Pilão-Torrado-E-Moído-Tradicional-Almofada-500g.png", category: "cafe" },
    { id: 'lava_roupa', title: "Sabão Líquido Premium (3L)", price: 19.90, image: "/lava_roupa.png", category: "limpeza" },
    { id: 'pano_multiuso', title: "Multiuso Fresh Ultra", price: 12.90, image: "/pano_multiuso.webp", category: "limpeza", badge: "Melhor Preço", badgeStyle: "orange" },
    { id: 'heineken-330ml', title: "Cerveja Heineken Long Neck (330ml)", price: 7.90, image: "/heineken.png", category: "Bebidas", badge: "Trincando", badgeStyle: "orange", diamondReward: 2 },
  ],
};

export const Home = () => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [bebidas, setBebidas] = useState<Product[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activePeriod, setActivePeriod] = useState<Period>('morning');
  const homeConfig = useHomeConfig();

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      setActivePeriod('morning');
    } else if (hour >= 12 && hour < 14) {
      setActivePeriod('lunch');
    } else if (hour >= 14 && hour < 18) {
      setActivePeriod('afternoon');
    } else if (hour >= 18 && hour < 24) {
      setActivePeriod('night');
    } else {
      setActivePeriod('dawn');
    }
  }, []);

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const handleCategoryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const maxScroll = target.scrollWidth - target.clientWidth;
    if (maxScroll > 0) {
      const percentage = (target.scrollLeft / maxScroll) * 100;
      setScrollProgress(percentage);
    }
  };

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null);
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setCurrentSlide((prev) => (prev + 1) % 3);
    } else if (isRightSwipe) {
      setCurrentSlide((prev) => (prev - 1 + 3) % 3);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadProducts = () => {
      const stored = localStorage.getItem('app-products');
      if (stored) {
        let allProds = JSON.parse(stored) as Product[];
        let updated = false;
        allProds = allProds.map(p => {
          if (p.id === 'heineken-330ml' && p.image !== '/heineken.png') {
            p.image = '/heineken.png';
            updated = true;
          }
          if (p.id === 'coca-cola-350ml' && p.image !== '/coca_cola_zero.png') {
            p.image = '/coca_cola_zero.png';
            updated = true;
          }
          if (p.id === 'monster-energy' && p.image !== '/monster_energy.webp') {
            p.image = '/monster_energy.webp';
            updated = true;
          }
          if (p.id === 'spaten-350ml' && p.image !== '/spaten.webp') {
            p.image = '/spaten.webp';
            updated = true;
          }
          return p;
        });
        if (updated) {
          localStorage.setItem('app-products', JSON.stringify(allProds));
        }
        setAllProducts(allProds);
        setBebidas(allProds.filter(p => p.category === 'Bebidas'));
      } else {
        // Fallback default drinks
        const defaults: Product[] = [
          { id: 'heineken-330ml', title: "Cerveja Heineken Long Neck (330ml)", price: 7.90, image: "/heineken.png", category: "Bebidas", badge: "Trincando", badgeStyle: "orange", diamondReward: 2 },
          { id: 'coca-cola-350ml', title: "Refrigerante Coca-Cola Sem Açúcar Lata (350ml)", price: 4.50, image: "/coca_cola_zero.png", category: "Bebidas", diamondReward: 1 },
          { id: 'monster-energy', title: "Energético Monster Energy Tradicional (473ml)", price: 9.90, image: "/monster_energy.webp", category: "Bebidas", badge: "Mais Vendido", badgeStyle: "orange", diamondReward: 3 },
          { id: 'spaten-350ml', title: "Cerveja Spaten Puro Malte Lata (350ml)", price: 5.20, image: "/spaten.webp", category: "Bebidas", diamondReward: 1 }
        ];
        setBebidas(defaults);
      }
    };

    loadProducts();
    window.addEventListener('app-products-updated', loadProducts);
    return () => window.removeEventListener('app-products-updated', loadProducts);
  }, []);

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        
        {/* The actual background image with its filter and position */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url("/bg-supermercado.jpeg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center 65%',
          filter: 'brightness(0.5)', // Escurece apenas a imagem do fundo
          zIndex: 0,
        }} />

        {/* Gradient shadow to transition into the black background below */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(9, 7, 5, 0.2) 0%, rgba(9, 7, 5, 0.7) 75%, #090705 100%)',
          pointerEvents: 'none',
          zIndex: 0
        }} />
        <div className="app" style={{ position: 'relative', zIndex: 1, paddingBottom: 15 }}>
          <Topbar />

          {/* CATEGORY ROW (3D REALISTIC ICONS) */}
          <div className="section-header" style={{ padding: '0 16px', marginBottom: '4px', marginTop: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>Categorias</h2>
          </div>
          <div className="category-row" onScroll={handleCategoryScroll}>

        <Link to="/promotions" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/promocoes.png" alt="Ofertas" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/bebidas" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/bebidas.png" alt="Bebidas" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=padaria" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/padaria.png" alt="Padaria" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=congelados" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/congelados.png" alt="Congelados" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=petshop" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/petshop.png" alt="Pet Shop" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=salgadinhos" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/salgadinhos.png" alt="Salgadinhos" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=doces" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/doces.png" alt="Doces" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=biscoitos" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/biscoitos.png" alt="Biscoitos" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=beleza" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/beleza.png" alt="Beleza" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=limpeza" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/limpeza.png" alt="Limpeza" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/eletronicos" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/eletronicos.png" alt="Eletrônicos" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/tabacaria" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/tabacaria.png" alt="Tabacaria" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=sorvetes" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/sorvetes.png" alt="Sorvetes" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=utilidades" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/utilidades.png" alt="Utilidades" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=churrasco" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/churrasco.png" alt="Churrasco" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=adega" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/adega.png" alt="Adega" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=bomboniere" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/bomboniere.png" alt="Bomboniere" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=higiene" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/higiene.png" alt="Higiene" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=fitness" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/fitness.png" alt="Fitness" className="category-3d-icon" /></div>
          </div>
        </Link>
        <Link to="/search?q=combos" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/combos.png" alt="Combos" className="category-3d-icon" /></div>
          </div>
        </Link>
      </div>

      {/* CATEGORY SCROLL INDICATOR */}
      <div className="category-scroll-indicators">
        <div className="category-scroll-track">
          <div 
            className="category-scroll-thumb" 
            style={{ 
              left: `${(scrollProgress / 100) * (80 - 24)}px` 
            }}
          />
        </div>
      </div>


      {/* HERO PROMO BANNER (CARROSSEL SLIDER) */}
      <div 
        className="hero-banner"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className="hero-slider-track" 
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {/* Slide 1: Ofertas */}
          <Link to="/promotions" className="hero-slide" style={{ backgroundImage: `url('/hero_background.png')` }}>
            <div className="hero-left">
              <div className="hero-badge">
                <span className="hero-badge-icon">🔥</span>
                <span>OFERTA DO DIA</span>
              </div>
              <h2>Descontos que você <br />vai <span className="highlight-gold">amar! 💛</span></h2>
              <p>Economize hoje em itens selecionados.</p>
              <button className="hero-btn gold-shiny-btn">
                Ver ofertas <span className="btn-arrow">→</span>
              </button>
            </div>
          </Link>

          {/* Slide 2: Bebidas */}
          <Link to="/bebidas" className="hero-slide" style={{ backgroundImage: `url('/hero_bebidas.png')` }}>
            <div className="hero-left">
              <div className="hero-badge">
                <span className="hero-badge-icon">🍻</span>
                <span>BEBIDAS GELADAS</span>
              </div>
              <h2>Cervejas e Refris <br />no <span className="highlight-blue">grau! 🧊</span></h2>
              <p>Para comemorar <br />ou relaxar no fim de semana.</p>
              <button className="hero-btn gold-shiny-btn">
                Ver bebidas <span className="btn-arrow">→</span>
              </button>
            </div>
          </Link>

          {/* Slide 3: Tabacaria */}
          <Link to="/tabacaria" className="hero-slide hero-slide-tabacaria" style={{ backgroundImage: `url('/hero_tabacaria.png')` }}>
            <div className="hero-left hero-left-lowered">
              <h2>O melhor da <br />nossa <span className="highlight-red">tabacaria! 🔞</span></h2>
              <p>Variedade de sedas, <br />isqueiros e importados.</p>
              <button className="hero-btn gold-shiny-btn">
                Ver tabacaria <span className="btn-arrow">→</span>
              </button>
            </div>
          </Link>
        </div>

        {/* SLIDER DOTS */}
        <div className="hero-dots">
          {[0, 1, 2].map((idx) => (
            <span 
              key={idx} 
              className={`dot ${currentSlide === idx ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentSlide(idx);
              }}
            />
          ))}
        </div>
      </div>
        </div>
      </div>

      <main className="app" style={{ paddingTop: 0 }}>
      {/* SEARCH BAR (MOVED BELOW HERO) */}
      <div className="search-container">
        <Link to="/search" style={{ textDecoration: 'none', width: '100%' }}>
          <div className="search-bar">
            <div className="search-bar-input-side">
              <Search size={18} color="rgba(255, 255, 255, 0.4)" />
              <input type="text" placeholder="O que você precisa hoje?" disabled style={{ pointerEvents: 'none' }} />
            </div>
            <button className="search-ai-btn" type="button">
              <span className="search-ai-text">Buscar<br/>por combos</span>
            </button>
          </div>
        </Link>
      </div>

      {/* PERIOD SELECTOR BUTTONS */}
      <div className="period-buttons-row">
        <button
          className={`period-button ${activePeriod === 'morning' ? 'active' : ''}`}
          onClick={() => setActivePeriod('morning')}
          style={{ backgroundImage: `url(${periodBgs.morning})` }}
          type="button"
        >
          <div className="period-button-text">
            <span className="period-button-title">Manhã</span>
            <span className="period-button-subtitle">Café da manhã</span>
          </div>
        </button>

        <button
          className={`period-button ${activePeriod === 'lunch' ? 'active' : ''}`}
          onClick={() => setActivePeriod('lunch')}
          style={{ backgroundImage: `url(${periodBgs.lunch})` }}
          type="button"
        >
          <div className="period-button-text">
            <span className="period-button-title">Almoço</span>
            <span className="period-button-subtitle">Refeições</span>
          </div>
        </button>

        <button
          className={`period-button ${activePeriod === 'afternoon' ? 'active' : ''}`}
          onClick={() => setActivePeriod('afternoon')}
          style={{ backgroundImage: `url(${periodBgs.afternoon})` }}
          type="button"
        >
          <div className="period-button-text">
            <span className="period-button-title">Tarde</span>
            <span className="period-button-subtitle">Lanches</span>
          </div>
        </button>

        <button
          className={`period-button ${activePeriod === 'night' ? 'active' : ''}`}
          onClick={() => setActivePeriod('night')}
          style={{ backgroundImage: `url(${periodBgs.night})` }}
          type="button"
        >
          <div className="period-button-text">
            <span className="period-button-title">Noite</span>
            <span className="period-button-subtitle">Jantar</span>
          </div>
        </button>

        <button
          className={`period-button ${activePeriod === 'dawn' ? 'active' : ''}`}
          onClick={() => setActivePeriod('dawn')}
          style={{ backgroundImage: `url(${periodBgs.dawn})` }}
          type="button"
        >
          <div className="period-button-text">
            <span className="period-button-title">Madrugada</span>
            <span className="period-button-subtitle">Essenciais</span>
          </div>
        </button>
      </div>


      <Section
        title={homeConfig.periodConfig[activePeriod]?.title || periodTitles[activePeriod]}
        theme="hero"
        linkText="Ver tudo >"
      >
        {(homeConfig.periodConfig[activePeriod]?.productIds?.length > 0
          ? homeConfig.periodConfig[activePeriod].productIds
              .map(id => allProducts.find(p => p.id === id) as Product)
              .filter(Boolean)
          : periodProducts[activePeriod]).map((product) => {
            
            // Map the active period to a background image for the cards
            let bgImage = '';
            switch(activePeriod) {
              case 'morning': bgImage = periodBgs.morning; break;
              case 'lunch': bgImage = periodBgs.lunch; break;
              case 'afternoon': bgImage = periodBgs.afternoon; break;
              case 'night': bgImage = periodBgs.night; break;
              case 'dawn': bgImage = periodBgs.dawn; break;
            }

            return <ProductCard key={product.id} {...product} bgImage={bgImage} />;
        })}
      </Section>

      {/* INFO CARDS ROW */}
      <div className="info-cards-row">
        <div className="info-card">
          <div className="info-card-icon-wrapper">
            <Bike size={18} color="#D4AF37" />
          </div>
          <div className="info-card-content">
            <h4>Entrega rápida</h4>
            <p>Receba em até 30 min na sua casa.</p>
          </div>
        </div>

        <div className="info-card">
          <div className="info-card-icon-wrapper">
            <Award size={18} color="#D4AF37" />
          </div>
          <div className="info-card-content">
            <h4>Nosso Clube</h4>
            <p>Ofertas exclusivas só para você!</p>
          </div>
        </div>

        <div className="info-card">
          <div className="info-card-icon-wrapper">
            <Lock size={16} color="#D4AF37" />
          </div>
          <div className="info-card-content">
            <h4>Compras seguras</h4>
            <p>Seus dados sempre protegidos.</p>
          </div>
        </div>
      </div>

      {/* SUPER PROMO SECTION (MEGA OFERTAS) */}
      <div className="super-promo-container">
        <h2 className="super-promo-title">MEGA OFERTAS</h2>
        <div className="super-promo-subtitle">SÓ ESTA SEMANA</div>
        
        <div className="super-promo-scroll">
          {homeConfig.megaOfertas.length > 0 ? (
            homeConfig.megaOfertas.map(mo => {
              const p = allProducts.find(prod => prod.id === mo.productId);
              if (!p) return null;
              return (
                <PromoCard
                  key={mo.id}
                  title={p.title}
                  price={p.price}
                  image={p.image}
                  badge={mo.badge}
                  badgeStyle={mo.badgeStyle}
                  category={p.category}
                />
              );
            })
          ) : (
            <>
              <PromoCard
                title="Energético Monster Energy 473ml"
                price={7.90}
                image="/monster_energy.webp"
                badge="47% OFF"
                badgeStyle="orange"
                category="bebidas"
              />

              <PromoCard
                title="Sabão Líquido Premium 3L"
                price={27.90}
                image="/lava_roupa.png"
                badge="22% OFF"
                badgeStyle="orange"
                category="limpeza"
              />

              <PromoCard
                title="Café Melitta Tradicional 500g"
                price={16.18}
                image="/cafe-novo.png"
                badge="35% OFF"
                badgeStyle="orange"
                category="cafe"
              />
            </>
          )}
        </div>
      </div>

      {/* BANNERS LADO A LADO */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', width: '100%' }}>
        <Link to="/promotions" style={{ textDecoration: 'none', flex: 1 }}>
          <img 
            src={bannerFreteGratis} 
            alt="Frete Grátis na sua primeira compra no app!" 
            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover', borderRadius: '8px' }} 
          />
        </Link>
        <Link to="/clube" style={{ textDecoration: 'none', flex: 1 }}>
          <img 
            src={bannerIndique} 
            alt="Indique e Ganhe" 
            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover', borderRadius: '8px' }} 
          />
        </Link>
      </div>

      {homeConfig.vitrines.filter(v => v.active).sort((a, b) => a.order - b.order).map(vitrine => {
        const prods = vitrine.productIds.map(id => allProducts.find(p => p.id === id)).filter(Boolean) as Product[];
        return (
          <Section
            key={vitrine.id}
            title={vitrine.title}
            subtitle={vitrine.subtitle}
            linkText="Ver tudo >"
            theme={vitrine.theme}
          >
            {prods.map(product => (
              <ProductCard key={product.id} {...product} />
            ))}
            {prods.length === 0 && (
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '12px' }}>Nenhum produto cadastrado nesta vitrine.</span>
            )}
          </Section>
        );
      })}

      {homeConfig.vitrines.length === 0 && (
        <>
          <Section
            title="Bebidas"
            subtitle={["Gelada é aqui! 🧊", "As melhores marcas", "Refresque seu dia"]}
            linkText="Ver tudo >"
            theme="purple"
          >
            {bebidas.map(product => (
              <ProductCard key={product.id} {...product} />
            ))}
            {bebidas.length === 0 && (
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '12px' }}>Nenhuma bebida cadastrada.</span>
            )}
          </Section>

          <Section
            title="Alimentos"
            subtitle={["Descubra novidades exclusivas!", "Sabor inconfundível", "Ofertas especiais"]}
            linkText="Ver tudo >"
            theme="orange"
          >
            <ProductCard
              title="Pão Pullman Forma Integral (500g)"
              price="R$ 12,90"
              image="/pao_de_forma.png"
              badge="Melhor Preço"
              badgeStyle="orange"
              category="alimentos"
            />
            <ProductCard
              title="Queijo Minas Frescal Itambé (300g)"
              price="R$ 19,90"
              image="/queijo_minas.png"
              badge="Promocional"
              badgeStyle="orange"
              category="alimentos"
            />
            <ProductCard
              title="Peito de Peru Fatiado Sadia (100g)"
              price="R$ 7,49"
              image="/peito_de_peru.webp"
              category="alimentos"
            />
            <ProductCard
              title="Manteiga Itambé Extra Sal (200g)"
              price="R$ 11,90"
              image="/manteiga_itambe.png"
              category="alimentos"
            />
          </Section>

          <Section
            title="Limpeza"
            subtitle={["Deixo tudo brilhando ✨", "Limpeza pesada", "Fragrâncias únicas"]}
            linkText="Ver tudo >"
            theme="green"
          >
            <ProductCard
              title="Sabão Líquido Premium"
              price="R$ 19,90"
              image="/lava_roupa.png"
              category="limpeza"
            />
            <ProductCard
              title="Multiuso Fresh Ultra"
              price="R$ 12,90"
              image="/pano_multiuso.webp"
              badge="Melhor Preço"
              badgeStyle="orange"
              category="limpeza"
            />
          </Section>
        </>
      )}



      {/* FOOTER */}
      <footer className="app-footer">
        <h4>mercado do nosso jeito</h4>
        <p>O melhor do supermercado na palma da mão.</p>
        <p>Atendimento: (11) 99999-9999</p>
      </footer>
      </main>
    </div>
  );
};
