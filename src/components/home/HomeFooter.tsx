import { Link } from 'react-router-dom';
import type { AdminConfig } from '../../hooks/useAdminConfig';

/** Telefone → href `tel:` (apenas dígitos e +). Vazio se não houver dígitos suficientes. */
const toTelHref = (phone: string): string => {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 8 ? `tel:${digits}` : '';
};

/** Rodapé: atendimento vem de `settings/admin` (supportPhone, storeHours) — sem número fixo. */
export const HomeFooter = ({ config }: { config: Pick<AdminConfig, 'supportPhone' | 'storeHours'> }) => {
  const tel = toTelHref(config.supportPhone);
  return (
    <footer className="app-footer">
      <h4>mercado do nosso jeito</h4>
      <p>O melhor do supermercado na palma da mão.</p>
      <p>
        {config.supportPhone ? (
          <>
            Atendimento:{' '}
            {tel ? <a href={tel} className="app-footer-link">{config.supportPhone}</a> : config.supportPhone}
          </>
        ) : (
          <>Atendimento: <Link to="/support" className="app-footer-link">fale com o suporte</Link></>
        )}
      </p>
      {config.storeHours && <p>Horário: {config.storeHours}</p>}
      {config.supportPhone && (
        <p><Link to="/support" className="app-footer-link">Central de ajuda</Link></p>
      )}
    </footer>
  );
};
