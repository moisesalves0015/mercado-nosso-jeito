import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    // Hard refresh to reload code and clear cache
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-backdrop" />
          
          <div className="error-boundary-card">
            <div className="error-boundary-icon-box">
              <AlertTriangle size={28} />
            </div>
            
            <h2 className="error-boundary-title">
              Ops! Algo deu errado
            </h2>
            
            <p className="error-boundary-desc">
              Ocorreu um erro inesperado ao carregar a página. Não se preocupe, seus dados estão seguros! Clique no botão abaixo para recarregar o mercado.
            </p>
            
            <button 
              className="error-boundary-btn"
              onClick={this.handleReload}
            >
              <RefreshCw size={16} />
              <span>Recarregar Mercado</span>
            </button>

            <button
              className="error-boundary-details-toggle"
              onClick={this.toggleDetails}
            >
              <span>{this.state.showDetails ? 'Ocultar Detalhes' : 'Ver Detalhes Técnicos'}</span>
              {this.state.showDetails ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {this.state.showDetails && (
              <div className="error-boundary-details">
                <strong>Erro:</strong> {this.state.error?.toString() || 'Sem detalhes do erro.'}
                {this.state.errorInfo?.componentStack && (
                  <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: '9px', textAlign: 'left', opacity: 0.8 }}>
                    <strong>Pilha:</strong>
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
