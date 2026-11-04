import React, { useState } from 'react';
import { Share2, MessageSquarePlus, Bookmark, Check, AlertCircle, Clock, Copy, Send } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Textarea } from '../../components/Textarea';
import { formatDisplayPhone } from './phoneUtils';
import { useToast } from '../../components/Toast';
import api from '../../services/api';

export const NotOnFlashChatSheet = ({
  isOpen,
  onClose,
  pendingData = null, // { pendingId, contactId, phone, name }
  onDone
}) => {
  const toast = useToast();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const Wrapper = isMobile ? BottomSheet : Modal;

  const [activeAction, setActiveAction] = useState(null); // null | 'message_request' | 'invited'
  const [messageText, setMessageText] = useState('');
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  if (!pendingData) return null;

  const displayPhone = formatDisplayPhone(pendingData.phone || '');
  const recipientName = pendingData.name || displayPhone;

  // 1. Handle Share / SMS Invite
  const handleInvite = async () => {
    setIsInviting(true);
    setErrorMessage('');
    const inviteUrl = window.location.origin;
    const shareData = {
      title: 'Join me on Flash Chat',
      text: `Hey ${recipientName}! Chat with me on Flash Chat, the fast & secure messaging super-app:`,
      url: inviteUrl
    };

    try {
      if (pendingData.contactId) {
        await api.post(`/contacts/${pendingData.contactId}/invite`).catch(() => {});
      }

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast.show({ title: 'Invite sent!', message: `Shared invitation with ${recipientName}.`, type: 'success' });
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        setCopiedLink(true);
        toast.show({ title: 'Invite link copied!', message: 'Paste it to your SMS or messaging app.', type: 'success' });
        setTimeout(() => setCopiedLink(false), 4000);
      }
      setActiveAction('invited');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorMessage(err.response?.data?.message || 'Unable to share invite. Please copy the link manually.');
      }
    } finally {
      setIsInviting(false);
    }
  };

  // 2. Handle Sending Queued Message Request
  const handleSendMessageRequest = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !pendingData.pendingId) return;

    setIsSubmittingMessage(true);
    setErrorMessage('');
    try {
      const res = await api.post(`/chats/pending/${pendingData.pendingId}/messages`, {
        text: messageText.trim()
      });

      setQueuedCount(res.data.queuedCount || queuedCount + 1);
      setMessageText('');
      toast.show({
        title: 'Message request queued',
        message: `${recipientName} will receive this message right after they join.`,
        type: 'success'
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to queue message. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmittingMessage(false);
    }
  };

  return (
    <Wrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Unregistered Contact"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-1">
        {/* Banner */}
        <div className="p-4 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/5 border border-line rounded-2xl flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-brand flex items-center justify-center text-white shrink-0 shadow-xs">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-ink">
              This number isn't on Flash Chat yet
            </h3>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              <strong>{displayPhone}</strong> is not registered. You can send them an invitation or queue a message request.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent font-medium flex items-center gap-2" role="alert" aria-live="polite">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action 1: Invite via Share / Copy Link */}
        <div className="p-3.5 bg-card border border-line rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">Invite to Flash Chat</p>
                <p className="text-[11px] text-muted">Send an SMS or share a direct app link</p>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isInviting}
              onClick={handleInvite}
              icon={copiedLink ? <Check className="w-3.5 h-3.5 text-cream" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedLink ? 'Copied!' : 'Invite'}
            </Button>
          </div>
        </div>

        {/* Action 2: Message Request Composer */}
        <div className="p-3.5 bg-card border border-line rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary">
                <MessageSquarePlus className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">Send a Message Request</p>
                <p className="text-[11px] text-muted">
                  {queuedCount > 0 ? `${queuedCount} of 5 messages queued` : 'Delivered automatically when they sign up'}
                </p>
              </div>
            </div>

            {activeAction !== 'message_request' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setActiveAction('message_request')}
              >
                Write Message
              </Button>
            )}
          </div>

          {activeAction === 'message_request' && (
            <form onSubmit={handleSendMessageRequest} className="space-y-2.5 pt-2 border-t border-line/60">
              <Textarea
                placeholder={`Write a message to ${recipientName}... (Text only, max 500 chars)`}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                maxLength={500}
                rows={3}
                required
              />
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>{messageText.length} / 500 characters</span>
                <span className="text-primary font-semibold">Max 5 queued messages</span>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmittingMessage}
                  disabled={!messageText.trim() || queuedCount >= 5}
                  icon={<Send className="w-3.5 h-3.5" />}
                >
                  {queuedCount >= 5 ? 'Limit Reached (5/5)' : 'Queue Message'}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              onClose();
              if (onDone) onDone();
            }}
            className="w-full"
            icon={<Bookmark className="w-4 h-4 text-muted" />}
          >
            Done (Saved in Contacts)
          </Button>
        </div>
      </div>
    </Wrapper>
  );
};

export default NotOnFlashChatSheet;
