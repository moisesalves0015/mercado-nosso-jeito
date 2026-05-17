import { Topbar } from '../components/Topbar';
import { Section } from '../components/Section';
import { ProductCard } from '../components/ProductCard';
import { Search, Croissant, Flame, Beef, Wine, PartyPopper } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Home = () => {
  return (
    <main className="app">
      <Topbar />

      {/* SEARCH BAR */}
      <div className="search-container">
        <Link to="/search" style={{textDecoration: 'none'}}>
          <div className="search-bar">
            <Search size={18} color="#E7BC79" />
            <input type="text" placeholder="O que você procura hoje?" disabled style={{pointerEvents: 'none'}} />
          </div>
        </Link>
      </div>

      {/* CATEGORY ROW */}
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

      <div className="hero-text-container">
        <div className="hero-text-marquee">
          <span>Comece o Dia com o Melhor - Café da Manhã Perfeito! &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <span>Comece o Dia com o Melhor - Café da Manhã Perfeito! &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </div>
      </div>

      <Section
        title="ESSENCIAIS DO CAFÉ"
        theme="hero"
      >
        <ProductCard
          title="Pão de Queijo Forno de Minas (1kg)"
          price="R$ 32,90"
          image="https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?q=80&w=600"
        />
        <ProductCard
          title="Iogurte Grego Danone Tradicional (4x)"
          price="R$ 18,90"
          image="https://images.unsplash.com/photo-1571115177098-24ec42ed204d?q=80&w=600"
        />
        <ProductCard
          title="Granola Kelloggs Integral (500g)"
          price="R$ 24,90"
          image="https://images.unsplash.com/photo-1517673132405-a56a62b18caf?q=80&w=600"
        />
        <ProductCard
          title="Ovo Branco Médio Mantiqueira (12un)"
          price="R$ 15,90"
          image="https://images.unsplash.com/photo-1587486913049-53fc88980cfc?q=80&w=600"
        />
        <ProductCard
          title="Café Melitta Vácuo (500g)"
          price="R$ 19,90"
          image="https://images.unsplash.com/photo-1559525839-b184a4d698c7?q=80&w=600"
        />
      </Section>

      {/* PROMO BANNER */}
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
          image="https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=600"
          badge="Promocional"
          badgeStyle="light"
        />
        <ProductCard
          title="Café Torrado e Moído Pilão (500g)"
          price="R$ 17,90"
          image="https://images.unsplash.com/photo-1587049352847-4d4b1f6db9c6?q=80&w=600"
          badge="Melhor Preço"
          badgeStyle="orange"
        />
        <ProductCard
          title="Chá Leão Erva Doce (15un)"
          price="R$ 9,90"
          image="https://images.unsplash.com/photo-1576092762791-dd9e2220c4af?q=80&w=600"
        />
        <ProductCard
          title="Leite Longa Vida Itambé Integral"
          price="R$ 5,49"
          image="https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600"
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
