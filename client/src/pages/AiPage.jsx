import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MessageSquare, Bot, Cpu, Zap, Image, BookmarkPlus } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const AiPage = () => {
  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-3xl bg-gradient-to-r from-[#EC4899] via-[#F43F5E] to-[#F97316] text-white shadow-xl shadow-rose-500/15"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold">
              <Bot className="w-3.5 h-3.5" />
              <span>Google Gemini AI</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Shared Multimodal Intelligence Layer
            </h2>
            <p className="text-xs text-white/90 max-w-md">
              Standalone AI chat with streaming responses, multimodal image understanding, and one-tap save to your Pocket vault.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3.5 py-2 rounded-2xl text-xs font-bold self-start sm:self-center">
            <Zap className="w-4 h-4 fill-white" />
            <span>Gemini 1.5 Flash</span>
          </div>
        </div>
      </motion.div>

      {/* Placeholder AI Console */}
      <div className="bg-white rounded-3xl p-8 border border-[#FED7AA] shadow-sm">
        <EmptyState
          emoji="🤖"
          title="Gemini AI Engine Coming in Step 8"
          description="Standalone conversational assistant, chat thread summarization, smart reply pills, and automatic content moderation across Chats and Social."
        />

        <div className="mt-8 pt-6 border-t border-[#FED7AA]/50 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/50 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-pink-100 flex items-center justify-center text-[#EC4899] flex-shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#1F2937]">Smart In-Chat AI</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">Use @ai to ask questions directly in any chat room</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/50 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-[#F43F5E] flex-shrink-0">
              <Image className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#1F2937]">Multimodal Vision</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">Analyze images and extract text effortlessly</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/50 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-[#F97316] flex-shrink-0">
              <BookmarkPlus className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#1F2937]">Save to Pocket</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">Store AI answers directly to your personal vault</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiPage;
