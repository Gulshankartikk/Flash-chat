import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video, Users } from 'lucide-react';
import { useCall } from './CallContext';
import { Avatar } from '../../components/Avatar';

export const IncomingCallModal = () => {
  const { callState, incomingCall, acceptCall, declineCall } = useCall();

  if (callState !== 'incoming-ringing' || !incomingCall) {
    return null;
  }

  const { call, caller } = incomingCall;
  const isVideo = call.type === 'video';
  const isGroup = call.isGroup;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-2xl border border-line flex flex-col items-center text-center relative overflow-hidden"
        >
          {/* Ambient decorative glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-gradient-to-tr from-secondary/20 to-accent/20 rounded-full blur-2xl pointer-events-none" />

          {/* Call type badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-bold text-primary mb-5">
            {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
            <span>Incoming {isVideo ? 'Video' : 'Voice'} Call</span>
          </div>

          {/* Caller Avatar with animated rings */}
          <div className="relative my-2">
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute -inset-3 rounded-full bg-brand-gradient opacity-40 blur-xs"
            />
            <Avatar
              src={caller.avatar}
              alt={caller.name || caller.username}
              size="2xl"
              className="relative z-10 shadow-lg"
            />
          </div>

          {/* Caller Info */}
          <div className="mt-4 space-y-1">
            <h3 className="text-xl font-black text-ink">
              {caller.name || caller.username}
            </h3>
            <p className="text-xs text-muted">
              {isGroup ? (
                <span className="inline-flex items-center gap-1 font-semibold text-primary">
                  <Users className="w-3 h-3" /> Group Call
                </span>
              ) : (
                `@${caller.username}`
              )}
            </p>
          </div>

          <p className="text-xs text-primary font-semibold animate-pulse mt-4">
            Ringing...
          </p>

          {/* Action Buttons: Decline & Accept */}
          <div className="flex items-center justify-center gap-8 mt-6 w-full pt-2">
            {/* Decline */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={declineCall}
                className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-[#F43F5E] text-white flex items-center justify-center shadow-lg shadow-rose-500/30 hover:scale-105 active:scale-95 transition cursor-pointer"
                title="Decline"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <span className="text-[11px] font-bold text-muted">Decline</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={acceptCall}
                className="w-14 h-14 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-soft hover:scale-105 active:scale-95 transition cursor-pointer"
                title="Accept"
              >
                {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </button>
              <span className="text-[11px] font-bold text-primary">Accept</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
