import React from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Flame,
  Bookmark,
  Sparkles,
  ArrowRight,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { AiProviderDisclosure } from '../components/common/AiProviderDisclosure';

export const WelcomePage = () => {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-cream text-ink">
      {/* Top Navbar */}
      <header className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center text-white shadow-soft">
            <span className="font-black text-xl">⚡</span>
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-ink">Flash Chat</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-cream text-primary border border-line">
              Super-App
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-semibold rounded-xl text-ink hover:bg-cream transition"
          >
            Sign In
          </Link>
          <Link to="/login">
            <Button size="sm" variant="primary">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-8 text-center flex-1 flex flex-col justify-center items-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card border border-line text-primary text-xs font-semibold mb-6 shadow-soft">
          <Zap className="w-3.5 h-3.5 fill-primary text-primary" />
          <span>Chat. Share. Save. All in one.</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight max-w-3xl text-ink">
          Unified Messaging, Social Reels, Pocket Vault & Flash AI.
        </h1>

        <p className="mt-5 text-sm sm:text-base text-muted max-w-2xl leading-relaxed">
          One unified account, one contact graph, one messaging engine. Seamlessly switch between WhatsApp-style encrypted chats, Instagram-style social media, an encrypted personal data vault, and intelligent Flash AI assistance.
        </p>

        {/* CTA Button Group */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link to="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="primary" className="w-full sm:w-auto gap-2 text-base px-8 py-3.5">
              <span>Launch with Phone or Email OTP</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* 4 Super-App Feature Cards */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left">
          <Card padding="p-5" className="hover:shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-cream border border-line flex items-center justify-center text-primary mb-3">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-ink">Chats (Real-Time)</h2>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              1:1 & groups, rich media, real-time read ticks, voice notes & WebRTC video calls.
            </p>
          </Card>

          <Card padding="p-5" className="hover:shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-cream border border-line flex items-center justify-center text-secondary mb-3">
              <Flame className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-ink">Social Feed</h2>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Feed posts, vertical Reels, 24h Stories, direct DM integration into the same chat engine.
            </p>
          </Card>

          <Card padding="p-5" className="hover:shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-cream border border-line flex items-center justify-center text-primary mb-3">
              <Bookmark className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-ink">Pocket Vault</h2>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Private vault with PIN protection & zero-knowledge AES-256-GCM encryption.
            </p>
          </Card>

          <Card padding="p-5" className="hover:shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-cream border border-line flex items-center justify-center text-accent mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-ink">Flash AI</h2>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Standalone AI chat + smart replies, chat summarizer, and post caption generator.
            </p>
          </Card>
        </div>

        <div className="mt-8 max-w-lg w-full">
          <AiProviderDisclosure compact />
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto px-6 py-6 border-t border-line flex flex-col sm:flex-row items-center justify-between text-xs text-muted gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">⚡ Flash Chat Super-App</span>
          <span>•</span>
          <span>High-Performance Real-Time Engine</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1 text-primary font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> WCAG AA Compliant
          </span>
        </div>
      </footer>
    </div>
  );
};

export default WelcomePage;
