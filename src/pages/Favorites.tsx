import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, ShoppingBag } from 'lucide-react';
import { useCatalog } from '../hooks/useCatalog';
import { useFavorites } from '../hooks/useFavorites';
import { ProductCard } from '../components/ProductCard';
import { MercadoLogo } from './Login';

export function Favorites() {
  const navigate = useNavigate();
  const { products } = useCatalog();
  const { favoriteIds, count } = useFavorites();

  const favoriteProducts = useMemo(() => {
    if (!favoriteIds.length) return [];
    return products.filter((p) => p.active !== false && favoriteIds.includes(p.id));
  }, [products, favoriteIds]);

  return (
    <main className="app favorites-page" style={{ padding: 0, minHeight: '100vh', paddingBottom: '95px' }}>
      {/* ── TOP BAR FLUTUANTE GLASS ── */}
      <div className="floating-topbar-wrapper">
        <div className="floating-topbar-inner">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 8px',
          }}>
            <button
              onClick={() => navigate(-1)}
              className="btn-icon-round"
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft size={17} />
            </button>

            <MercadoLogo size="sm" />

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                color: '#ef4444',
                cursor: 'default'
              }}
            >
              <Heart size={18} fill="#ef4444" />
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <div style={{
        maxWidth: 620,
        margin: '0 auto',
        padding: '12px 14px 20px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{
              fontSize: 20,
              fontWeight: 900,
              color: 'var(--text-primary)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              Meus Favoritos
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 99,
                background: 'rgba(212, 175, 55, 0.18)',
                color: '#D4AF37',
                border: '1px solid rgba(212, 175, 55, 0.3)'
              }}>
                {count} {count === 1 ? 'item' : 'itens'}
              </span>
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Produtos que você salvou com carinho para pedir mais rápido.
            </p>
          </div>
        </div>

        {favoriteProducts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '50px 20px',
            background: 'var(--card-bg)',
            borderRadius: 20,
            border: '1px solid var(--border-primary)',
            marginTop: 20,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1.5px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#ef4444'
            }}>
              <Heart size={30} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Sua lista de favoritos está vazia
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 auto 20px', maxWidth: 280 }}>
              Toque no ícone de coração nos produtos para guardá-los aqui e achá-los facilmente.
            </p>
            <button
              onClick={() => navigate('/search')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #FFDF73, #D4AF37)',
                color: '#000',
                border: 'none',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(212, 175, 55, 0.35)'
              }}
            >
              <ShoppingBag size={16} />
              Explorar Produtos
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              width: '100%',
              justifyItems: 'center',
              paddingTop: '6px'
            }}
          >
            {favoriteProducts.map((product) => (
              <ProductCard
                key={`fav-${product.id}`}
                id={product.id}
                title={product.title}
                price={product.price}
                image={product.image}
                badge={product.badge}
                diamondReward={product.diamondReward}
                stock={product.stock}
                promoActive={product.promoActive}
                promoPrice={product.promoPrice}
                promoExpiry={product.promoExpiry}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
export default Favorites;
