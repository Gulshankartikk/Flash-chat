import React, { useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import {
  ArrowLeft,
  Clock,
  Send,
  Share2,
  Trash2,
  AlertCircle,
  Check,
  Copy,
  Info,
  Sparkles,
  Phone
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Textarea } from '../../components/Textarea';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useChatStore } from '../../store/useChatStore';
import { getDisplayName } from '../../utils/getDisplayName';
import api from '../../services/api';

export const PendingChatScreen = ({ pendingConversation, onBack, onDeleted }) => {
  const toast = useToast();
  const { queuePendingMessage, deletePendingConversation } = useChatStore();

  const [messageText, setMessageText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  if (!pendingConversation) return null;

  const queuedMessages = pendingConversation.queuedMessages || [];
  const queuedCount = queuedMessages.length;
  const displayName = getDisplayName(pendingConversation, pendingConversation.rawPhoneMasked || 'Contact');
  const daysLeft = pendingConversation.expiresAt
    ? Math.max(0, differenceInDays(new Date(pendingConversation.expiresAt), new Date()))
    : 30;

  // Queue message action
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || queuedCount >= 5) return;

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await queuePendingMessage(pendingConversation._id, messageText.trim());
      setMessageText('');
      toast.show({
        title: 'Message queued',
        message: `${displayName} will receive this message as soon as they register.`,
        type: 'success'
      });
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to queue message. Limit is 5 messages.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Invite again action
  const handleInviteAgain = async () => {
    setIsInviting(true);
    setErrorMessage('');
    const shareData = {
      title: 'Join me on Flash Chat',
      text: `Hey! Chat with me on Flash Chat:`,
      url: window.location.origin
    };

    try {
      if (pendingConversation.contactId) {
        await api.post(`/contacts/${pendingConversation.contactId}/invite`).catch(() => {});
      }

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast.show({ title: 'Invite sent', message: 'Invitation link shared.', type: 'success' });
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        setCopied(true);
        toast.show({ title: 'Invite link copied', message: 'Paste it to send an SMS or message.', type: 'success' });
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        const msg = err.response?.data?.message || 'Unable to invite. Try again later.';
        setErrorMessage(msg);
      }
    } finally {
      setIsInviting(false);
    }
  };

  // Cancel / delete pending request
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePendingConversation(pendingConversation._id);
      setShowDeleteConfirm(false);
      toast.show({ title: 'Request cancelled', message: 'Pending message request removed.', type: 'info' });
      if (onDeleted) onDeleted(pendingConversation._id);
      if (onBack) onBack();
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to delete pending conversation.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative flex flex-col h-full flex-1 bg-cream/30 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-line z-10 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-cream text-muted hover:text-ink cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="w-10 h-10 rounded-full bg-brand-gradient text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            <Clock className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-ink truncate flex items-center gap-1.5">
              <span>{displayName}</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                Waiting to join
              </span>
            </h3>
            <p className="text-[11px] text-muted truncate">
              {pendingConversation.rawPhoneMasked || 'Phone invite'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            isLoading={isInviting}
            onClick={handleInviteAgain}
            icon={copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Share2 className="w-3.5 h-3.5" />}
          >
            {copied ? 'Copied' : 'Invite again'}
          </Button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-xl text-muted hover:text-accent hover:bg-accent/10 transition cursor-pointer"
            title="Cancel Request"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expiry Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 text-center text-xs text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2">
        <Info className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          Queued messages expire in <strong>{daysLeft} days</strong> if this person doesn't join Flash Chat.
        </span>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="mx-4 mt-3 p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent font-medium flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Queued Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {queuedMessages.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted space-y-2">
            <Clock className="w-8 h-8 text-line mx-auto mb-2" />
            <p className="font-bold text-ink">No message requests sent yet</p>
            <p className="text-[11px]">
              Type a message below. It will be delivered automatically when {displayName} signs up.
            </p>
          </div>
        ) : (
          queuedMessages.map((msg, index) => {
            const text = typeof msg === 'string' ? msg : msg.text;
            const time = msg.createdAt ? format(new Date(msg.createdAt), 'p') : '';
            return (
              <div key={index} className="flex flex-col items-end">
                <div className="max-w-md p-3.5 rounded-2xl rounded-tr-xs bg-brand text-white shadow-md text-xs leading-relaxed space-y-1">
                  <p>{text}</p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-white/80">
                    <Clock className="w-3 h-3" />
                    <span>Queued</span>
                    {time && <span>• {time}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message Composer */}
      <div className="p-3 bg-card border-t border-line space-y-2">
        <div className="flex items-center justify-between text-xs text-muted px-1">
          <span className="font-semibold">{queuedCount} of 5 messages used</span>
          <span>{messageText.length} / 500 chars</span>
        </div>

        <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
          <div className="flex-1">
            <Textarea
              placeholder={
                queuedCount >= 5
                  ? 'Message limit reached (max 5 queued messages)'
                  : `Write a message to ${displayName}...`
              }
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={queuedCount >= 5 || isSubmitting}
              maxLength={500}
              rows={2}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={!messageText.trim() || queuedCount >= 5}
            className="h-10 px-4"
            icon={<Send className="w-4 h-4" />}
          >
            Send
          </Button>
        </form>
        <p className="text-[10px] text-muted text-center">
          Only text messages can be queued. They will be delivered once they register.
        </p>
      </div>

      {/* Delete / Cancel Confirm Modal */}
      {showDeleteConfirm && (
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Cancel Message Request?"
          maxWidth="max-w-sm"
        >
          <div className="space-y-4 pt-1">
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to cancel this request? All queued messages to{' '}
              <strong>{displayName}</strong> will be permanently deleted.
            </p>
            <div className="flex gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                Keep Request
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={isDeleting}
                onClick={handleDelete}
                className="flex-1 bg-accent hover:bg-accent/90"
              >
                Yes, Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PendingChatScreen;
