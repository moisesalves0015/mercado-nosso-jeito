import { Link } from 'react-router-dom';
import { Bike, Award, Lock } from 'lucide-react';
import bannerFreteGratis from '../../assets/banners/bannerFreteGratis.svg';
import bannerIndique from '../../assets/banners/bannerIndique.svg';

const formatBRL = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

/**
 * Banners de frete e indicação, lado a lado.
 * O texto alternativo do frete reflete a regra vigente (`settings/shipping.freeShippingThreshold`),
 * não uma promessa fixa de primeira compra.
 */
export const HomePromoBanners = ({ freeShippingThreshold }: { freeShippingThreshold: number }) => {
  const freightAlt = freeShippingThreshold > 0
    ? `Frete grátis em compras acima de ${formatBRL(freeShippingThreshold)}`
    : 'Confira as condições de frete e as promoções do app';

  return (
    <div className="home-promo-banners">
      <Link to="/promotions" className="home-promo-banner-link">
        <img src={bannerFreteGratis} alt={freightAlt} className="home-promo-banner-img" />
      </Link>
      <Link to="/clube" className="home-promo-banner-link">
        <img src={bannerIndique} alt="Indique e ganhe no Clube" className="home-promo-banner-img" />
      </Link>
    </div>
  );
};

/**
 * Benefícios: entrega, Clube e segurança.
 * O prazo vem de `settings/admin.deliveryEta`; sem valor configurado, nenhum prazo é prometido.
 */
export const HomeBenefitCards = ({ deliveryEta }: { deliveryEta: string }) => (
  <div className="info-cards-row">
    <div className="info-card">
      <div className="info-card-icon-wrapper" aria-hidden="true">
        <Bike size={18} color="#D4AF37" />
      </div>
      <div className="info-card-content">
        <h4>Entrega rápida</h4>
        <p>{deliveryEta ? `Receba em até ${deliveryEta} no seu condomínio.` : 'Receba direto no seu condomínio.'}</p>
      </div>
    </div>

    <Link to="/clube" className="info-card info-card--link">
      <div className="info-card-icon-wrapper" aria-hidden="true">
        <Award size={18} color="#D4AF37" />
      </div>
      <div className="info-card-content">
        <h4>Nosso Clube</h4>
        <p>Ganhe diamantes nas suas compras.</p>
      </div>
    </Link>

    <Link to="/support" className="info-card info-card--link">
      <div className="info-card-icon-wrapper" aria-hidden="true">
        <Lock size={16} color="#D4AF37" />
      </div>
      <div className="info-card-content">
        <h4>Compras seguras</h4>
        <p>Saiba como protegemos seus dados.</p>
      </div>
    </Link>
  </div>
);
