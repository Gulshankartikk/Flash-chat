import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Compass, MessageSquare, HelpCircle } from 'lucide-react';
import { Button } from '../components/Button';

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cream text-ink flex items-center justify-center p-4 select-none">
      <div className="bg-card rounded-3xl p-8 max-w-md w-full shadow-xl border border-line text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mx-auto shadow-md shadow-primary/20">
          <Compass className="w-8 h-8 text-white" />
        </div>

        <div className="space-y-2">
          <span className="text-4xl font-black bg-brand bg-clip-text text-transparent">
            404
          </span>
          <h1 className="text-lg font-black text-ink">Page Not Found</h1>
          <p className="text-xs text-muted leading-relaxed">
            The conversation, post, or pocket record you were looking for doesn't exist or has moved.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <Button
              variant="primary"
              className="w-full"
              icon={<MessageSquare className="w-4 h-4" />}
              onClick={() => navigate('/chats')}
            >
              Open Chats
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              icon={<Home className="w-4 h-4" />}
              onClick={() => navigate('/social')}
            >
              Social Feed
            </Button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/support')}
            className="text-xs font-bold text-primary hover:underline py-1.5 flex items-center justify-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Need assistance? Chat with us</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
