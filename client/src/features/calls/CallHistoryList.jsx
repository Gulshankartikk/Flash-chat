import React, { useState, useEffect } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useCall } from './CallContext';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';

export const CallHistoryList = () => {
  const { user } = useAuthStore();
  const currentUserId = user?._id;
  const { startCall } = useCall();

  const [calls, setCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'missed'

  const fetchCalls = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/calls');
      if (res.data?.success) {
        setCalls(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch call history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const handleDeleteCall = async (e, callId) => {
    e.stopPropagation();
    try {
      await api.delete(`/calls/${callId}`);
      setCalls((prev) => prev.filter((c) => c._id !== callId));
    } catch (err) {
      console.error('Failed to remove call from history:', err);
    }
  };

  const handleCallBack = (call) => {
    if (!call.conversation?._id) return;
    startCall({
      conversationId: call.conversation._id,
      type: call.type || 'audio'
    });
  };

  const formatCallDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    }
    if (isYesterday(date)) {
      return `Yesterday, ${format(date, 'h:mm a')}`;
    }
    return format(date, 'MMM d, h:mm a');
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const filteredCalls = calls.filter((call) => {
    const isMissed =
      call.status === 'missed' ||
      call.endReason === 'missed' ||
      call.endReason === 'offline' ||
      (call.duration === 0 && String(call.caller?._id || call.caller) !== String(currentUserId));

    if (filter === 'missed') return isMissed;
    return true;
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="card" className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Sub-header Filter Tabs (All / Missed) */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#FED7AA]/50 bg-[#FFF7ED]/30">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
            filter === 'all'
              ? 'bg-[#F97316] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#1F2937]'
          }`}
        >
          All Calls ({calls.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('missed')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
            filter === 'missed'
              ? 'bg-[#F43F5E] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#1F2937]'
          }`}
        >
          Missed
        </button>
      </div>

      {/* Calls List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#FED7AA]/30">
        {filteredCalls.length === 0 ? (
          <div className="p-8 text-center">
            <EmptyState
              emoji="📞"
              title={filter === 'missed' ? 'No Missed Calls' : 'No Call History'}
              description={
                filter === 'missed'
                  ? 'You do not have any missed calls.'
                  : 'Start a voice or video call with friends using the call button.'
              }
            />
          </div>
        ) : (
          filteredCalls.map((call) => {
            const isCaller = String(call.caller?._id || call.caller) === String(currentUserId);
            const otherUser = isCaller
              ? call.participants.find((p) => String(p.user?._id || p.user) !== String(currentUserId))?.user
              : call.caller;

            const isMissed =
              call.status === 'missed' ||
              call.endReason === 'missed' ||
              call.endReason === 'offline' ||
              (call.duration === 0 && !isCaller);

            const isVideo = call.type === 'video';
            const displayName =
              call.conversation?.type === 'group'
                ? call.conversation.name
                : otherUser?.name || otherUser?.username || 'Flash User';
            const displayAvatar =
              call.conversation?.type === 'group'
                ? call.conversation.avatar
                : otherUser?.avatar || '';

            return (
              <div
                key={call._id}
                onClick={() => handleCallBack(call)}
                className="group flex items-center justify-between px-4 py-3 hover:bg-[#FFF7ED]/40 transition cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={displayAvatar} alt={displayName} size="md" />

                  <div className="min-w-0">
                    <h4
                      className={`text-sm font-bold truncate ${
                        isMissed ? 'text-[#F43F5E]' : 'text-[#1F2937]'
                      }`}
                    >
                      {displayName}
                    </h4>

                    <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mt-0.5">
                      {/* Direction Icon */}
                      {isCaller ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      ) : isMissed ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-[#F43F5E] flex-shrink-0" />
                      ) : (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      )}

                      <span className="truncate">
                        {isMissed ? 'Missed' : isCaller ? 'Outgoing' : 'Incoming'}
                        {call.duration > 0 && ` (${formatDuration(call.duration)})`}
                      </span>
                      <span>·</span>
                      <span className="text-[11px] text-[#6B7280]">
                        {formatCallDate(call.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Actions: Call Type Icon & Delete */}
                <div className="flex items-center gap-1.5 text-[#6B7280]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCallBack(call);
                    }}
                    className="p-2 rounded-xl text-[#F97316] hover:bg-orange-50 transition cursor-pointer"
                    title={`Call back with ${isVideo ? 'video' : 'voice'}`}
                  >
                    {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteCall(e, call._id)}
                    className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer opacity-0 group-hover:opacity-100"
                    title="Remove from call log"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
