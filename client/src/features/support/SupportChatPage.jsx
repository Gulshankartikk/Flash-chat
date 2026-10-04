import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Clock,
  Star,
  Sparkles,
  ArrowLeft,
  UserCheck,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Check,
  PlusCircle
} from 'lucide-react';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { useSupportStore } from './useSupport';
import { useChatStore } from '../../store/useChatStore';
import { getSocket, useSocketStore } from '../../services/socket';
import api from '../../services/api';

export const SupportChatPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ticketId = searchParams.get('ticketId');
  const conversationId = searchParams.get('cid');

  const {
    tickets,
    policy,
    rateTicket,
    closeTicket,
    reopenTicket,
    requestHumanHandoff,
    fetchPolicy,
    fetchTickets
  } = useSupportStore();

  const [currentTicket, setCurrentTicket] = useState(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isRequestingHandoff, setIsRequestingHandoff] = useState(false);
  const [ratingSubmittedSuccess, setRatingSubmittedSuccess] = useState(false);

  useEffect(() => {
    fetchPolicy();
    fetchTickets();
  }, [fetchPolicy, fetchTickets]);

  // Find active ticket
  useEffect(() => {
    if (ticketId) {
      const match = tickets.find((t) => t._id === ticketId);
      if (match) setCurrentTicket(match);
    } else if (conversationId) {
      const match = tickets.find(
        (t) => (t.conversation?._id || t.conversation) === conversationId
      );
      if (match) setCurrentTicket(match);
    }
  }, [ticketId, conversationId, tickets]);

  // Listen to socket support:ticket-updated events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTicketUpdated = (data) => {
      if (data && currentTicket && data._id === currentTicket._id) {
        setCurrentTicket(data);
      }
    };

    socket.on('support:ticket-updated', handleTicketUpdated);
    return () => {
      socket.off('support:ticket-updated', handleTicketUpdated);
    };
  }, [currentTicket]);

  const handleHandoff = async () => {
    if (!currentTicket) return;
    setIsRequestingHandoff(true);
    try {
      const updated = await requestHumanHandoff(currentTicket._id);
      setCurrentTicket(updated);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request human support');
    } finally {
      setIsRequestingHandoff(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!currentTicket) return;
    try {
      const updated = await closeTicket(currentTicket._id);
      setCurrentTicket(updated);
      setCloseConfirmOpen(false);
      setRatingModalOpen(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close ticket');
    }
  };

  const handleReopen = async () => {
    if (!currentTicket) return;
    try {
      const updated = await reopenTicket(currentTicket._id);
      setCurrentTicket(updated);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reopen ticket');
    }
  };

  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    if (!currentTicket) return;
    setIsSubmittingRating(true);
    try {
      await rateTicket(currentTicket._id, selectedRating, ratingComment.trim());
      setRatingSubmittedSuccess(true);
      setTimeout(() => {
        setRatingModalOpen(false);
        setRatingSubmittedSuccess(false);
      }, 1200);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit rating');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const isResolved = currentTicket?.status === 'resolved' || currentTicket?.status === 'closed';
  const isPendingHandoff = currentTicket?.status === 'pending';
  const hasRated = Boolean(currentTicket?.rating?.score);

  // 7-day reopen window logic
  const isReopenAllowed = () => {
    if (!isResolved || !currentTicket?.updatedAt) return false;
    const resolvedTime = new Date(currentTicket.resolvedAt || currentTicket.updatedAt).getTime();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - resolvedTime <= SEVEN_DAYS_MS;
  };

  return (
    <div className="flex flex-col h-full bg-cream select-none overflow-hidden">
      {/* Support Specific Banner */}
      <div className="p-3 bg-gradient-to-r from-primary to-secondary text-white flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/support')}
            className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs">Flash Support</span>
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          {currentTicket && (
            <span className="hidden sm:inline text-xs text-white/80">
              • Ticket #{currentTicket._id.slice(-6)} ({currentTicket.subject})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {policy?.expectedResponseTime && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-white/80">
              <Clock className="w-3.5 h-3.5" />
              <span>Avg response: {policy.expectedResponseTime}</span>
            </span>
          )}

          {isResolved ? (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">
                Resolved
              </span>
              {isReopenAllowed() ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs py-1 cursor-pointer"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={handleReopen}
                >
                  Reopen
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs py-1 cursor-pointer"
                  icon={<PlusCircle className="w-3.5 h-3.5" />}
                  onClick={() => navigate('/support')}
                >
                  Start New Ticket
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {!isPendingHandoff && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs py-1 text-ink cursor-pointer"
                  icon={<UserCheck className="w-3.5 h-3.5 text-primary" />}
                  isLoading={isRequestingHandoff}
                  onClick={handleHandoff}
                >
                  Talk to a human
                </Button>
              )}
              {isPendingHandoff && (
                <span className="text-[11px] bg-white/20 text-white px-2.5 py-1 rounded-full font-medium">
                  Waiting on support team
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-white hover:bg-white/20 cursor-pointer"
                onClick={() => setCloseConfirmOpen(true)}
              >
                Close Ticket
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Resolved Satisfaction Banner */}
      {isResolved && !hasRated && (
        <div className="p-3 bg-card border-b border-line flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span className="font-semibold text-ink">
              This issue is marked as resolved. How did we do?
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            className="text-xs cursor-pointer"
            onClick={() => setRatingModalOpen(true)}
          >
            Rate Support
          </Button>
        </div>
      )}

      {/* Main Chat Window (Reused) */}
      <div className="flex-1 overflow-hidden">
        {conversationId ? (
          <ChatWindow
            conversationId={conversationId}
            onBack={() => navigate('/support')}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted">
            Loading support chat...
          </div>
        )}
      </div>

      {/* Close Confirmation Modal */}
      <Modal
        isOpen={closeConfirmOpen}
        onClose={() => setCloseConfirmOpen(false)}
        title="Close Support Ticket"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted leading-relaxed">
            Are you sure you want to mark this issue as resolved? You can always reopen it within 7 days if you still need assistance.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setCloseConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              onClick={handleConfirmClose}
            >
              Confirm Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* 1-5 Star Rating Modal */}
      <Modal
        isOpen={ratingModalOpen}
        onClose={() => setRatingModalOpen(false)}
        title="Rate your support experience"
        maxWidth="max-w-sm"
      >
        {ratingSubmittedSuccess ? (
          <div className="py-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-ink">Thank you for your feedback!</h4>
            <p className="text-xs text-muted">Your rating helps us improve Flash Support.</p>
          </div>
        ) : (
          <form onSubmit={handleRatingSubmit} className="space-y-4 text-center">
            <p className="text-xs text-muted">
              Please let us know how helpful Flash Support and Flash AI were with your request.
            </p>

            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedRating(star)}
                  className="p-2 transition-transform hover:scale-125 cursor-pointer"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= selectedRating
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-muted/30'
                    }`}
                  />
                </button>
              ))}
            </div>

            <Textarea
              placeholder="Additional comments (optional)..."
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              rows={2}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setRatingModalOpen(false)}
              >
                Skip
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                isLoading={isSubmittingRating}
              >
                Submit Rating
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
