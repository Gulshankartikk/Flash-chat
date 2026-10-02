import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Share2,
  Lock,
  Sparkles,
  ArrowRight,
  Zap,
  PhoneCall,
  CheckCircle2
} from 'lucide-react';

export const WelcomePage = () => {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FFF7ED] text-[#1F2937]">
      {/* Top Navbar */}
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] flex items-center justify-center text-white shadow-lg shadow-orange-500/25">
            <span className="font-black text-xl">⚡</span>
          </div>
          <div>
            <span className="text-xl font-black tracking-tight">Flash Chat</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-orange-100 text-[#F97316] border border-[#FED7AA]">
              Super-App
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-semibold rounded-xl text-[#1F2937] hover:bg-orange-100/60 transition"
          >
            Sign In
          </Link>
          <Link
            to="/login"
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:from-[#EA580C] hover:to-[#DB2777] text-white shadow-md shadow-orange-500/25 transition cursor-pointer"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-10 text-center flex-1 flex flex-col justify-center items-center">
        {/* Glow backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#F97316]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#FED7AA] text-[#F97316] text-xs font-semibold mb-6 shadow-sm">
          <Zap className="w-3.5 h-3.5 fill-[#F97316]" />
          <span>The All-In-One Unified Super-App</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight max-w-3xl text-[#1F2937]">
          Chats, Social Feed, Personal Pocket & Gemini AI.
        </h1>

        <p className="mt-5 text-sm sm:text-base text-[#6B7280] max-w-2xl leading-relaxed">
          One unified account, one contact graph, one messaging engine. Seamlessly switch between WhatsApp-style chats, Instagram-style social media, an encrypted personal data vault, and intelligent AI assistance.
        </p>

        {/* CTA Button Group */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link
            to="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:from-[#EA580C] hover:to-[#DB2777] text-white font-bold text-sm shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2 transition hover:-translate-y-0.5 cursor-pointer"
          >
            <span>Launch with Phone or Email OTP</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 4 Super-App Feature Cards */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left">
          <div className="p-5 rounded-2xl bg-white border border-[#FED7AA] shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#F97316] mb-3">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[#1F2937]">Chats (WhatsApp)</h2>
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
              1:1 & groups, rich media, real-time read ticks, voice notes & WebRTC video calls.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#FED7AA] shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-[#EC4899] mb-3">
              <Share2 className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[#1F2937]">Social (Instagram)</h2>
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
              Feed, vertical Reels, 24h Stories, direct DM integration into the same chat engine.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#FED7AA] shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[#1F2937]">Pocket Vault</h2>
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
              Private vault with PIN protection. Save any message, post, note, or document with 1 tap.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#FED7AA] shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-[#F43F5E] mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[#1F2937]">Gemini AI</h2>
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
              Standalone AI chat + smart replies, chat summarizer, and post caption generator.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto px-6 py-6 border-t border-[#FED7AA]/60 flex flex-col sm:flex-row items-center justify-between text-xs text-[#6B7280] gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#1F2937]">⚡ Flash Chat Super-App</span>
          <span>•</span>
          <span>Production Ready MERN</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> High-Performance Stack
          </span>
        </div>
      </footer>
    </div>
  );
};

export default WelcomePage;
