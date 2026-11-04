import React, { useState } from 'react';
import { BarChart2, CheckCircle2, Circle } from 'lucide-react';
import api from '../../services/api';

export const PollBubble = ({ poll, messageId, currentUserId, isOwn }) => {
  const [localPoll, setLocalPoll] = useState(poll);
  const [isVoting, setIsVoting] = useState(false);

  if (!localPoll || !Array.isArray(localPoll.options)) return null;

  const totalVotes = localPoll.options.reduce(
    (acc, opt) => acc + (Array.isArray(opt.votes) ? opt.votes.length : 0),
    0
  );

  const handleVote = async (optionIndex) => {
    if (isVoting) return;
    setIsVoting(true);

    // Optimistic UI update
    const updatedOptions = localPoll.options.map((opt, idx) => {
      const votes = Array.isArray(opt.votes) ? [...opt.votes] : [];
      const userVoteIdx = votes.findIndex(
        (v) => String(v?._id || v) === String(currentUserId)
      );

      if (idx === optionIndex) {
        if (userVoteIdx >= 0) {
          votes.splice(userVoteIdx, 1);
        } else {
          votes.push(currentUserId);
        }
      } else if (!localPoll.allowMultiple && userVoteIdx >= 0) {
        votes.splice(userVoteIdx, 1);
      }

      return { ...opt, votes };
    });

    setLocalPoll({ ...localPoll, options: updatedOptions });

    try {
      const res = await api.post(`/messages/${messageId}/poll/vote`, { optionIndex });
      if (res.data?.message?.poll) {
        setLocalPoll(res.data.message.poll);
      }
    } catch (err) {
      console.warn('Poll voting failed, reverting optimistic state:', err.message);
      setLocalPoll(poll);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl p-3.5 my-1 text-xs select-none max-w-sm space-y-3 ${
        isOwn
          ? 'bg-white/15 text-white border border-white/20'
          : 'bg-card text-ink border border-line shadow-xs'
      }`}
    >
      {/* Poll Header */}
      <div className="flex items-start gap-2">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            isOwn ? 'bg-white/20 text-white' : 'bg-primary/20 text-primary'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm leading-snug break-words">
            {localPoll.question}
          </p>
          <p className="text-[10px] opacity-75 mt-0.5">
            {localPoll.allowMultiple ? 'Select one or more' : 'Select one option'}
          </p>
        </div>
      </div>

      {/* Options List */}
      <div className="space-y-2">
        {localPoll.options.map((option, idx) => {
          const voteCount = Array.isArray(option.votes) ? option.votes.length : 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const hasVoted =
            Array.isArray(option.votes) &&
            option.votes.some((v) => String(v?._id || v) === String(currentUserId));

          return (
            <button
              key={idx}
              type="button"
              disabled={isVoting}
              onClick={() => handleVote(idx)}
              className={`relative w-full text-left p-2.5 rounded-xl border transition overflow-hidden flex items-center justify-between gap-3 cursor-pointer ${
                hasVoted
                  ? isOwn
                    ? 'border-white bg-white/20 font-bold'
                    : 'border-primary bg-primary/10 font-bold'
                  : isOwn
                  ? 'border-white/20 hover:bg-white/10'
                  : 'border-line hover:bg-cream/60'
              }`}
            >
              {/* Progress Bar Fill */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-300 pointer-events-none ${
                  isOwn ? 'bg-white/20' : 'bg-primary/20'
                }`}
                style={{ width: `${percentage}%` }}
              />

              {/* Option Text and Check Icon */}
              <div className="relative z-10 flex items-center gap-2 min-w-0 flex-1">
                {hasVoted ? (
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 ${
                      isOwn ? 'text-white' : 'text-primary'
                    }`}
                  />
                ) : (
                  <Circle
                    className={`w-4 h-4 shrink-0 ${
                      isOwn ? 'text-white/40' : 'text-muted/60'
                    }`}
                  />
                )}
                <span className="truncate">{option.text}</span>
              </div>

              {/* Vote Stats */}
              <div className="relative z-10 text-[11px] shrink-0 font-mono flex items-center gap-1.5 opacity-90">
                <span>{voteCount}</span>
                <span className="text-[10px] opacity-75">({percentage}%)</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Poll Footer */}
      <div className="flex items-center justify-between text-[10px] opacity-75 pt-1 border-t border-current/10">
        <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} total</span>
        <span>Poll</span>
      </div>
    </div>
  );
};
export default PollBubble;
