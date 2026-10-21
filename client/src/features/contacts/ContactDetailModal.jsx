import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  Video,
  MessageSquare,
  Share2,
  Edit2,
  Trash2,
  Star,
  User,
  Mail,
  FileText,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  Send
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { BottomSheet } from '../../components/BottomSheet';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useContactsStore } from './useContacts';
import { useCall } from '../calls';
import { formatDisplayPhone } from './phoneUtils';

export const ContactDetailModal = ({
  isOpen,
  onClose,
  contact,
  onEdit,
  onDeleted
}) => {
  const navigate = useNavigate();
  const { deleteContact, updateContact, startChatWithContact, inviteContact } = useContactsStore();
  const { startCall } = useCall();

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!contact) return null;

  const isLinked = Boolean(contact.linkedUser);
  const linkedUserData = contact.linkedUser && typeof contact.linkedUser === 'object' ? contact.linkedUser : null;

  const handleToggleFavorite = async () => {
    try {
      await updateContact(contact._id, { isFavorite: !contact.isFavorite });
    } catch (_) {}
  };

  const handleMessage = async () => {
    try {
      const res = await startChatWithContact(contact._id);
      const conv = res?.conversation || res;
      onClose();
      if (conv?._id) {
        navigate(`/chats/${conv._id}`);
      } else if (conv?.conversationId) {
        navigate(`/chats/${conv.conversationId}`);
      } else if (res?.status === 'pending' || res?.pendingId) {
        navigate('/chats');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start chat');
    }
  };

  const handleStartCall = (type = 'audio') => {
    if (!linkedUserData?._id) {
      alert('Calls are only available with registered Flash Chat users.');
      return;
    }
    onClose();
    startCall(linkedUserData._id, type);
  };

  const handleInvite = async (channel = 'sms') => {
    setIsInviting(true);
    setInviteStatus(null);
    try {
      const res = await inviteContact(contact._id, channel);
      setInviteStatus({ success: true, message: res.message || 'Invitation sent successfully!' });
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Could not send invitation at this time.';
      setInviteStatus({ success: false, message: errMsg });
    } finally {
      setIsInviting(false);
    }
  };

  const handleShareLink = async () => {
    const shareUrl = `${window.location.origin}/welcome?ref=${contact._id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Flash Chat',
          text: `Hey ${contact.name}, join me on Flash Chat!`,
          url: shareUrl
        });
      } catch (_) {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteContact(contact._id);
      if (onDeleted) onDeleted(contact);
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete contact');
    } finally {
      setIsDeleting(false);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const Wrapper = isMobile ? BottomSheet : Modal;

  return (
    <Wrapper isOpen={isOpen} onClose={onClose} title="Contact Details" maxWidth="max-w-md">
      <div className="space-y-5 overflow-y-auto max-h-[75vh] pr-1 scrollbar-thin">
        {/* Profile Card Header */}
        <div className="flex flex-col items-center text-center p-4 bg-cream rounded-2xl border border-line">
          <Avatar
            src={contact.avatar || linkedUserData?.avatar}
            name={contact.name}
            size="xl"
            className="mb-3 shadow-md shadow-primary/10"
          />
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-ink">{contact.name}</h3>
            <button
              type="button"
              onClick={handleToggleFavorite}
              className="p-1 text-muted hover:text-amber-500 transition-colors"
              title={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                className={`w-4 h-4 ${
                  contact.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-muted'
                }`}
              />
            </button>
          </div>

          {isLinked ? (
            <div className="mt-1 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-bold">
              <span>⚡ On Flash Chat</span>
              {linkedUserData?.username && (
                <span className="text-muted font-normal">(@{linkedUserData.username})</span>
              )}
            </div>
          ) : (
            <span className="mt-1 px-2.5 py-0.5 rounded-full bg-card border border-line text-muted text-xs font-medium">
              Not on Flash Chat yet
            </span>
          )}

          {/* Quick Action Buttons (Horizontal Scrollable) */}
          <div className="flex items-center gap-2.5 mt-4 w-full overflow-x-auto pb-1.5 scrollbar-thin snap-x">
            <button
              type="button"
              onClick={handleMessage}
              className="flex flex-col items-center gap-1 p-2.5 min-w-[80px] rounded-xl bg-card border border-line hover:border-primary/50 text-ink text-xs font-semibold flex-1 transition shadow-xs snap-start shrink-0 cursor-pointer"
            >
              <MessageSquare className="w-5 h-5 text-primary" />
              <span>Message</span>
            </button>

            {isLinked ? (
              <>
                <button
                  type="button"
                  onClick={() => handleStartCall('audio')}
                  className="flex flex-col items-center gap-1 p-2.5 min-w-[80px] rounded-xl bg-card border border-line hover:border-primary/50 text-ink text-xs font-semibold flex-1 transition shadow-xs snap-start shrink-0 cursor-pointer"
                >
                  <Phone className="w-5 h-5 text-primary" />
                  <span>Audio Call</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartCall('video')}
                  className="flex flex-col items-center gap-1 p-2.5 min-w-[80px] rounded-xl bg-card border border-line hover:border-primary/50 text-ink text-xs font-semibold flex-1 transition shadow-xs snap-start shrink-0 cursor-pointer"
                >
                  <Video className="w-5 h-5 text-secondary" />
                  <span>Video Call</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleInvite('sms')}
                  disabled={isInviting || !contact.phone}
                  className="flex flex-col items-center gap-1 p-2.5 min-w-[100px] rounded-xl bg-card border border-line hover:border-primary/50 text-ink text-xs font-semibold flex-1 transition disabled:opacity-50 shadow-xs snap-start shrink-0 cursor-pointer"
                >
                  <Send className="w-5 h-5 text-primary" />
                  <span>Invite SMS</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareLink}
                  className="flex flex-col items-center gap-1 p-2.5 min-w-[100px] rounded-xl bg-card border border-line hover:border-primary/50 text-ink text-xs font-semibold flex-1 transition shadow-xs snap-start shrink-0 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-5 h-5 text-primary" /> : <Share2 className="w-5 h-5 text-secondary" />}
                  <span>{copiedLink ? 'Copied!' : 'Share Link'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Invite Status Notification */}
        {inviteStatus && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              inviteStatus.success
                ? 'bg-primary/10 border border-primary/20 text-primary font-medium'
                : 'bg-accent/10 border border-accent/20 text-accent font-medium'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{inviteStatus.message}</span>
          </div>
        )}

        {/* Details List */}
        <div className="space-y-3 bg-card p-3 rounded-2xl border border-line">
          {contact.phone && (
            <div className="flex items-center justify-between text-xs py-1.5 border-b border-line/50">
              <div className="flex items-center gap-2.5 text-muted">
                <Phone className="w-4 h-4 text-primary" />
                <span>Phone</span>
              </div>
              <span className="font-semibold text-ink">{formatDisplayPhone(contact.phone)}</span>
            </div>
          )}

          {contact.email && (
            <div className="flex items-center justify-between text-xs py-1.5 border-b border-line/50">
              <div className="flex items-center gap-2.5 text-muted">
                <Mail className="w-4 h-4 text-primary" />
                <span>Email</span>
              </div>
              <span className="font-semibold text-ink">{contact.email}</span>
            </div>
          )}

          {contact.note && (
            <div className="text-xs py-1.5 border-b border-line/50">
              <div className="flex items-center gap-2.5 text-muted mb-1">
                <FileText className="w-4 h-4 text-primary" />
                <span>Private Note</span>
              </div>
              <p className="text-ink bg-cream p-2.5 rounded-xl border border-line/40">{contact.note}</p>
            </div>
          )}

          {isLinked && linkedUserData?.username && (
            <div className="flex items-center justify-between text-xs py-1.5">
              <span className="text-muted">Public Profile</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/u/${linkedUserData.username}`);
                }}
                className="text-primary font-bold hover:underline flex items-center gap-1"
              >
                <span>View Profile</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Delete Confirmation or Controls */}
        {showDeleteConfirm ? (
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-2xl space-y-2">
            <p className="text-xs font-bold text-accent">
              Are you sure you want to delete this contact?
            </p>
            <p className="text-[11px] text-muted">
              This will only remove the contact from your personal list. Existing chat histories are preserved.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                isLoading={isDeleting}
                onClick={handleDelete}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => {
                onClose();
                if (onEdit) onEdit(contact);
              }}
            >
              Edit Contact
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-accent hover:bg-accent/10"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </Wrapper>
  );
};
