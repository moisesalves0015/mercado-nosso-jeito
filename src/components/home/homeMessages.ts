/** Mensagem de estado vazio/erro padronizada dos blocos dinâmicos da Home. */
export const CATALOG_ERROR_MESSAGE = 'Não foi possível carregar os produtos agora. Tente novamente em instantes.';

export const emptyMessage = (catalogError: boolean, whenEmpty: string): string =>
  catalogError ? CATALOG_ERROR_MESSAGE : whenEmpty;
