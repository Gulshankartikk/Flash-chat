import React from 'react';
import { AlertTriangle, RefreshCw, Home, HelpCircle } from 'lucide-react';
import { Button } from './Button';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error caught by Flash Chat ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/chats';
  };

  handleGoSupport = () => {
    window.location.href = '/support';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cream text-ink flex items-center justify-center p-4 select-none">
          <div className="bg-card rounded-3xl p-8 max-w-md w-full shadow-2xl border border-line text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-accent/15 text-accent flex items-center justify-center mx-auto border border-accent/20">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-black text-ink">Something went wrong</h1>
              <p className="text-xs text-muted leading-relaxed">
                An unexpected error occurred in this view. Your data is safe in your local vault.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-cream border border-line text-[11px] font-mono text-muted text-left break-all max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  icon={<Home className="w-3.5 h-3.5" />}
                  onClick={this.handleGoHome}
                >
                  Home
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={this.handleReload}
                >
                  Reload App
                </Button>
              </div>

              <button
                type="button"
                onClick={this.handleGoSupport}
                className="text-xs font-bold text-primary hover:underline py-1.5 flex items-center justify-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Contact support team</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
