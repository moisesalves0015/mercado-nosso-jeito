import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const categoriesList = [
  { id: 'promocoes', title: 'Promoções', image: '/categories/promocoes.png', path: '/promotions' },
  { id: 'bebidas', title: 'Bebidas', image: '/categories/bebidas.png', path: '/bebidas' },
  { id: 'padaria', title: 'Padaria', image: '/categories/padaria.png', path: '/search?q=padaria' },
  { id: 'congelados', title: 'Congelados', image: '/categories/congelados.png', path: '/search?q=congelados' },
  { id: 'petshop', title: 'Pet Shop', image: '/categories/petshop.png', path: '/search?q=petshop' },
  { id: 'salgadinhos', title: 'Salgadinhos', image: '/categories/salgadinhos.png', path: '/search?q=salgadinhos' },
  { id: 'doces', title: 'Doces', image: '/categories/doces.png', path: '/search?q=doces' },
  { id: 'biscoitos', title: 'Biscoitos', image: '/categories/biscoitos.png', path: '/search?q=biscoitos' },
  { id: 'beleza', title: 'Beleza', image: '/categories/beleza.png', path: '/search?q=beleza' },
  { id: 'limpeza', title: 'Limpeza', image: '/categories/limpeza.png', path: '/search?q=limpeza' },
  { id: 'eletronicos', title: 'Eletrônicos', image: '/categories/eletronicos.png', path: '/eletronicos' },
  { id: 'tabacaria', title: 'Tabacaria', image: '/categories/tabacaria.png', path: '/tabacaria' },
  { id: 'sorvetes', title: 'Sorvetes', image: '/categories/sorvetes.png', path: '/search?q=sorvetes' },
  { id: 'utilidades', title: 'Utilidades', image: '/categories/utilidades.png', path: '/search?q=utilidades' },
  { id: 'churrasco', title: 'Churrasco', image: '/categories/churrasco.png', path: '/search?q=churrasco' },
  { id: 'adega', title: 'Adega', image: '/categories/adega.png', path: '/search?q=adega' },
  { id: 'bomboniere', title: 'Bomboniere', image: '/categories/bomboniere.png', path: '/search?q=bomboniere' },
  { id: 'higiene', title: 'Higiene', image: '/categories/higiene.png', path: '/search?q=higiene' },
  { id: 'fitness', title: 'Fitness', image: '/categories/fitness.png', path: '/search?q=fitness' },
  { id: 'combos', title: 'Combos', image: '/categories/combos.png', path: '/search?q=combos' },
];

export const Categories = () => {
  const navigate = useNavigate();

  return (
    <div className="categories-page-container">
      {/* HEADER */}
      <header className="categories-page-header">
        <button className="categories-back-btn" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <h2>Categorias</h2>
        <div style={{ width: 32 }}></div> {/* Spacer to balance the header */}
      </header>

      {/* CATEGORIES GRID */}
      <main className="categories-page-main">
        <div className="categories-page-grid">
          {categoriesList.map((cat) => (
            <Link key={cat.id} to={cat.path} className="categories-page-card">
              <div className="categories-page-card-image-wrapper">
                <img src={cat.image} alt={cat.title} className="categories-page-card-image" />
              </div>
              <div className="categories-page-card-info">
                <span className="categories-page-card-title">{cat.title}</span>
                <span className="categories-page-card-arrow">
                  <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};
