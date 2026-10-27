/**
 * Utilitários para autenticação, sanitização de redirecionamento e suporte a PWA.
 */

/**
 * Valida e sanitiza um caminho de redirecionamento interno.
 * Garante que apenas rotas relativas internas do app sejam aceitas,
 * prevenindo ataques de Open Redirect e evitando loops em rotas de auth.
 */
export const sanitizeInternalRedirect = (url: unknown, defaultUrl = '/'): string => {
  if (typeof url !== 'string') return defaultUrl;
  const trimmed = url.trim();
  if (!trimmed) return defaultUrl;

  // Deve iniciar com '/' único (rejeita '//' ou '/\', que navegadores interpretam como URL de protocolo relativo a outro domínio)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return defaultUrl;
  }

  // Não permitir esquemas de URI (ex: javascript:, data:, https:, vbscript:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return defaultUrl;
  }

  // Prevenir retorno em loop para páginas de autenticação
  const cleanPath = trimmed.split('?')[0].split('#')[0];
  if (['/login', '/register', '/forgot-password'].includes(cleanPath)) {
    return defaultUrl;
  }

  return trimmed;
};

/**
 * Detecta se o aplicativo está sendo executado como PWA instalado (standalone)
 * em iOS (Safari Web Clip), Android (WebAPK / TWA) ou Desktop.
 */
export const isStandalonePwa = (): boolean => {
  if (typeof window === 'undefined') return false;

  const isStandaloneMatch = window.matchMedia('(display-mode: standalone)').matches;
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const isMinimalUi = window.matchMedia('(display-mode: minimal-ui)').matches;
  const isNavigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const isReferrerAndroidApp = typeof document !== 'undefined' && document.referrer.startsWith('android-app://');

  return isStandaloneMatch || isFullscreen || isMinimalUi || isNavigatorStandalone || isReferrerAndroidApp;
};

export interface AuthErrorInfo {
  title: string;
  message: string;
  isCancelled: boolean;
}

/**
 * Mapeia erros de autenticação (especialmente Google Auth e Redirect)
 * para mensagens claras e resolutivas em português.
 */
export const getAuthErrorMessage = (err: unknown): AuthErrorInfo => {
  const e = err as { code?: string; message?: string };
  const code = e?.code || '';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      title: 'Login cancelado',
      message: 'Você fechou a janela do Google antes de concluir o login.',
      isCancelled: true,
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      title: 'Popup bloqueado pelo navegador',
      message: 'O navegador bloqueou a janela do Google. Permitindo popups ou aguarde o redirecionamento automático.',
      isCancelled: false,
    };
  }

  if (code === 'auth/unauthorized-domain') {
    const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'este domínio';
    return {
      title: 'Domínio não autorizado no Firebase',
      message: `O domínio "${currentDomain}" não está autorizado no Firebase Console. Adicione-o em Firebase Console > Authentication > Settings > Authorized domains.`,
      isCancelled: false,
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      title: 'Login com Google desativado',
      message: 'O provedor Google não está ativado no Firebase Authentication. Ative o Google em Firebase Console > Authentication > Sign-in method.',
      isCancelled: false,
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      title: 'Falha de conexão',
      message: 'Não foi possível conectar aos servidores de autenticação. Verifique sua conexão com a internet e tente novamente.',
      isCancelled: false,
    };
  }

  if (code === 'auth/account-exists-with-different-credential') {
    return {
      title: 'E-mail já cadastrado com senha',
      message: 'Já existe uma conta com este e-mail cadastrada por senha. Entre usando seu e-mail e senha.',
      isCancelled: false,
    };
  }

  if (code === 'auth/invalid-api-key' || code === 'auth/app-not-authorized') {
    return {
      title: 'Configuração do Firebase incorreta',
      message: 'A chave da API ou o projeto Firebase não estão autorizados. Verifique as variáveis de ambiente.',
      isCancelled: false,
    };
  }

  return {
    title: 'Erro ao autenticar',
    message: e?.message || 'Não foi possível concluir o login com o Google. Tente novamente em instantes.',
    isCancelled: false,
  };
};
