import { Topbar } from '../components/Topbar';
import { Section } from '../components/Section';
import { ProductCard } from '../components/ProductCard';
import { Search, Croissant, Flame, Beef, Wine, PartyPopper, Bike, Award, Lock, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Home = () => {
  return (
    <main className="app">
      <Topbar />

      {/* SEARCH BAR WITH FILTER BUTTON */}
      <div className="search-container">
        <div className="search-bar-wrapper">
          <Link to="/search" style={{textDecoration: 'none', flex: 1}}>
            <div className="search-bar">
              <Search size={16} color="rgba(255, 255, 255, 0.4)" />
              <input type="text" placeholder="O que você procura hoje?" disabled style={{pointerEvents: 'none'}} />
            </div>
          </Link>
          <div className="search-filter-btn">
            <SlidersHorizontal size={14} color="#D4AF37" />
          </div>
        </div>
      </div>

      {/* CATEGORY ROW (REVERTED EXACTLY AS REQUESTED) */}
      <div className="category-row">
        <div className="category-item">
          <div className="category-icon-wrapper"><Croissant size={28} /></div>
          <span className="category-text">Padaria</span>
        </div>
        <div className="category-item">
          <div className="category-icon-wrapper"><Flame size={28} /></div>
          <span className="category-text">Ofertas</span>
        </div>
        <div className="category-item">
          <div className="category-icon-wrapper"><Beef size={28} /></div>
          <span className="category-text">Carnes</span>
        </div>
        <div className="category-item">
          <div className="category-icon-wrapper"><Wine size={28} /></div>
          <span className="category-text">Adega</span>
        </div>
        <div className="category-item">
          <div className="category-icon-wrapper"><PartyPopper size={28} /></div>
          <span className="category-text">Presentes</span>
        </div>
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
        />
        <ProductCard
          title="Iogurte Grego Danone (4x)"
          price="R$ 18,90"
          image="/iogurte-novo.webp"
          diamondReward={12}
        />
        <ProductCard
          title="Granola Mel Barano (500g)"
          price="R$ 24,90"
          image="/granola-novo.png"
        />
        <ProductCard
          title="Ovo Branco Médio (12un)"
          price="R$ 15,90"
          image="/ovos-novo.png"
        />
        <ProductCard
          title="Café Melitta Tradicional (500g)"
          price="R$ 19,90"
          image="/cafe-novo.png"
          diamondReward={15}
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
            <h4>Clube do Nosso Jeito</h4>
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

      {/* PINK FRETE GRÁTIS BANNER */}
      <Link to="/promotions" style={{textDecoration: 'none'}}>
        <div className="promo-banner">
          <div className="promo-text">
            <h3>Frete Grátis</h3>
            <p>Na sua primeira compra no app!</p>
          </div>
          <PartyPopper size={40} color="#fff" />
        </div>
      </Link>

      <Section
        title="Bebidas"
        subtitle={["Gelada é aqui! 🧊", "As melhores marcas", "Refresque seu dia"]}
        linkText="Ver tudo >"
        theme="purple"
      >
        <ProductCard
          title="Suco de Laranja Integral Do Bem (1L)"
          price="R$ 14,90"
          image="/suco_do_bem_laranja_integral.png"
          badge="Promocional"
          badgeStyle="light"
          diamondReward={10}
        />
        <ProductCard
          title="Café Torrado e Moído Pilão (500g)"
          price="R$ 17,90"
          image="/Café-Pilão-Torrado-E-Moído-Tradicional-Almofada-500g.png"
          badge="Melhor Preço"
          badgeStyle="orange"
        />
        <ProductCard
          title="Chá Matte Natural Leão (100g)"
          price="R$ 9,90"
          image="/Cha-Matte-Natural-100g-Leao.png"
        />
        <ProductCard
          title="Leite Longa Vida Integral (1L)"
          price="R$ 5,49"
          image="/leite-integral-interna.png"
        />
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
          image="https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600"
          badge="Melhor Preço"
          badgeStyle="orange"
        />
        <ProductCard
          title="Queijo Minas Frescal Itambé (300g)"
          price="R$ 19,90"
          image="https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?q=80&w=600"
          badge="Promocional"
          badgeStyle="orange"
        />
        <ProductCard
          title="Peito de Peru Fatiado Sadia (100g)"
          price="R$ 7,49"
          image="https://images.unsplash.com/photo-1603048297172-c92544798d5e?q=80&w=600"
        />
        <ProductCard
          title="Manteiga Itambé Extra Sal (200g)"
          price="R$ 11,90"
          image="https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=600"
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
          image="https://images.unsplash.com/photo-1583947215259-38e31be8751f?q=80&w=600"
        />
        <ProductCard
          title="Multiuso Fresh Ultra"
          price="R$ 12,90"
          image="https://images.unsplash.com/photo-1610701596007-11502861dcfa?q=80&w=600"
          badge="Melhor Preço"
          badgeStyle="orange"
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
