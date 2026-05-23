import { useState, useEffect } from 'react';
import { Topbar } from '../components/Topbar';
import { Section } from '../components/Section';
import { ProductCard } from '../components/ProductCard';
import { PromoCard } from '../components/PromoCard';
import { Search, Croissant, Flame, Sparkles, Candy, Bike, Award, Lock, SlidersHorizontal, Cigarette, CupSoda, Headphones, MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import bannerFreteGratis from '../assets/banners/bannerFreteGratis.svg';
import bannerIndique from '../assets/banners/bannerIndique.svg';

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

export const Home = () => {
  const [bebidas, setBebidas] = useState<Product[]>([]);

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
    <main className="app">
      <Topbar />

      {/* SEARCH BAR WITH FILTER BUTTON INSIDE */}
      <div className="search-container">
        <Link to="/search" style={{textDecoration: 'none'}}>
          <div className="search-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <Search size={16} color="rgba(255, 255, 255, 0.4)" />
              <input type="text" placeholder="O que você procura hoje?" disabled style={{pointerEvents: 'none'}} />
            </div>
            <div className="search-filter-btn-inside" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', paddingLeft: '8px' }}>
              <SlidersHorizontal size={14} color="#D4AF37" />
            </div>
          </div>
        </Link>
      </div>

      {/* CATEGORY ROW (3D REALISTIC ICONS) */}
      <div className="category-row">
        <Link to="/bebidas" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/bebidas.png" alt="Bebidas" className="category-3d-icon" /></div>
            <span className="category-text">Bebidas</span>
          </div>
        </Link>
        <Link to="/tabacaria" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/tabacaria.png" alt="Tabacaria" className="category-3d-icon" /></div>
            <span className="category-text">Tabacaria</span>
          </div>
        </Link>
        <Link to="/eletronicos" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/eletronicos.png" alt="Eletrônicos" className="category-3d-icon" /></div>
            <span className="category-text">Eletrônicos</span>
          </div>
        </Link>
        <Link to="/search" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/padaria.png" alt="Padaria" className="category-3d-icon" /></div>
            <span className="category-text">Padaria</span>
          </div>
        </Link>
        <Link to="/promotions" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/ofertas.png" alt="Ofertas" className="category-3d-icon" /></div>
            <span className="category-text">Ofertas</span>
          </div>
        </Link>
        <Link to="/search" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/limpeza.png" alt="Limpeza" className="category-3d-icon" /></div>
            <span className="category-text">Limpeza</span>
          </div>
        </Link>
        <Link to="/search" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/doces.png" alt="Doces" className="category-3d-icon" /></div>
            <span className="category-text">Doces</span>
          </div>
        </Link>
        <Link to="/search" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="category-item">
            <div className="category-icon-wrapper"><img src="/categories/mais.png" alt="Mais" className="category-3d-icon" /></div>
            <span className="category-text">Mais</span>
          </div>
        </Link>
      </div>


      {/* HERO PROMO BANNER (MOVED UP AND HIGHLY DETAILED) */}
      <Link to="/promotions" style={{textDecoration: 'none'}}>
        <div className="hero-banner">
          <div className="hero-left">
            <div className="hero-badge">
              <span className="hero-badge-icon">🔥</span>
              <span>OFERTA DO DIA</span>
            </div>
            <h2>Descontos que você vai amar!</h2>
            <p>Economize hoje em itens selecionados.</p>
            <button className="hero-btn">Ver ofertas</button>
          </div>
          
          <div className="hero-right">
            <div className="hero-image-wrapper">
              <img src="/basket_hero.png" alt="Cesta de Ofertas" className="hero-basket-img" />
            </div>
          </div>

          {/* SLIDER DOTS */}
          <div className="hero-dots">
            <span className="dot active"></span>
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>
      </Link>

      <Section
        title="Essenciais do Café"
        theme="hero"
        linkText="Ver tudo >"
      >
        <ProductCard
          title="Pão de Queijo Tradicional (1kg)"
          price="R$ 32,90"
          image="/paodequeijo-novo.webp"
          diamondReward={18}
          category="cafe"
        />
        <ProductCard
          title="Iogurte Grego Danone (4x)"
          price="R$ 18,90"
          image="/iogurte-novo.webp"
          diamondReward={12}
          category="cafe"
        />
        <ProductCard
          title="Granola Mel Barano (500g)"
          price="R$ 24,90"
          image="/granola-novo.png"
          category="cafe"
        />
        <ProductCard
          title="Ovo Branco Médio (12un)"
          price="R$ 15,90"
          image="/ovos-novo.png"
          category="cafe"
        />
        <ProductCard
          title="Café Melitta Tradicional (500g)"
          price="R$ 19,90"
          image="/cafe-novo.png"
          diamondReward={15}
          category="cafe"
        />
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



      {/* FOOTER */}
      <footer className="app-footer">
        <h4>mercado do nosso jeito</h4>
        <p>O melhor do supermercado na palma da mão.</p>
        <p>Atendimento: (11) 99999-9999</p>
      </footer>
    </main>
  );
};
