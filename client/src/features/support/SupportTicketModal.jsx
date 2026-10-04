import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  HelpCircle,
  Bug,
  Lightbulb,
  CreditCard,
  Paperclip,
  X,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  FileText,
  ExternalLink
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Select } from '../../components/Select';
import { Button } from '../../components/Button';
import { useSupportStore } from './useSupport';

const CATEGORIES = [
  { value: 'account', label: '👤 Account & Login' },
  { value: 'bug', label: '🐛 Bug Report' },
  { value: 'feature', label: '💡 Feature Request' },
  { value: 'billing', label: '💳 Billing & Pocket' },
  { value: 'general', label: '❓ General Inquiry' }
];

export const SupportTicketModal = ({ isOpen, onClose, initialCategory = 'general' }) => {
  const navigate = useNavigate();
  const { tickets, createTicket } = useSupportStore();

  const [category, setCategory] = useState(initialCategory);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachDiagnostics, setAttachDiagnostics] = useState(true);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [isPdf, setIsPdf] = useState(false);

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if user already has an active open ticket
  const openTicket = tickets.find((t) => t.status === 'open' || t.status === 'pending');

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10 MB max)
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, screenshot: 'File size must be under 10MB' }));
      return;
    }

    // Validate type (images or pdf only)
    const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!isValidType) {
      setErrors((prev) => ({ ...prev, screenshot: 'Please upload an image (PNG, JPG, WebP) or PDF document.' }));
      return;
    }

    setAttachmentFile(file);
    setIsPdf(file.type === 'application/pdf');

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentPreview(reader.result);
      setErrors((prev) => ({ ...prev, screenshot: null }));
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    setIsPdf(false);
  };

  const validate = () => {
    const errs = {};
    if (!subject.trim()) {
      errs.subject = 'Please provide a brief subject';
    } else if (subject.trim().length > 100) {
      errs.subject = 'Subject must be 100 characters or fewer';
    }

    if (!message.trim()) {
      errs.message = 'Please describe your issue or question';
    } else if (message.trim().length > 2000) {
      errs.message = 'Message must be 2000 characters or fewer';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const diagnosticInfo = attachDiagnostics
        ? {
            appVersion: '1.0.0',
            platform: navigator.userAgentData?.platform || navigator.platform || 'web',
            language: navigator.language || 'en-US',
            screen: `${window.screen.width}x${window.screen.height}`,
            isOnline: navigator.onLine !== false
          }
        : undefined;

      const res = await createTicket({
        category,
        subject: subject.trim(),
        message: message.trim(),
        screenshot: attachmentPreview || undefined,
        diagnosticInfo
      });

      onClose();
      if (res?.conversation?._id) {
        navigate(`/support/chat?ticketId=${res.ticket?._id}&cid=${res.conversation._id}`);
      } else {
        navigate('/support');
      }
    } catch (err) {
      const status = err.response?.status;
      let msg = err.response?.data?.message || 'Failed to submit ticket';
      if (status === 429) {
        msg = 'You have reached the daily support ticket limit. Please wait until tomorrow or continue your existing conversation.';
      }
      setErrors((prev) => ({
        ...prev,
        general: msg
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start Support Conversation" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Open Ticket Alert */}
        {openTicket && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>You already have an open ticket in progress.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(
                  `/support/chat?ticketId=${openTicket._id}&cid=${
                    openTicket.conversation?._id || openTicket.conversation
                  }`
                );
              }}
              className="text-primary font-bold hover:underline flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
            >
              <span>Continue</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errors.general && (
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}

        <div className="p-3 bg-gradient-to-r from-primary/10 to-secondary/10 border border-line rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center text-xs font-bold shrink-0">
            ⚡
          </div>
          <div>
            <p className="text-xs font-bold text-ink">Instant AI + Human Escalation</p>
            <p className="text-[11px] text-muted">
              Flash AI responds immediately. You can hand off to a human team member anytime.
            </p>
          </div>
        </div>

        {/* Category */}
        <Select
          label="Category *"
          options={CATEGORIES}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        {/* Subject */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-ink">Subject *</label>
            <span className="text-[10px] text-muted">{subject.length} / 100</span>
          </div>
          <Input
            placeholder="e.g. Can't link my phone number"
            value={subject}
            maxLength={100}
            onChange={(e) => setSubject(e.target.value)}
            error={errors.subject}
            required
          />
        </div>

        {/* Message */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-ink">Description *</label>
            <span className="text-[10px] text-muted">{message.length} / 2000</span>
          </div>
          <Textarea
            placeholder="Please explain what you're experiencing with as much detail as possible..."
            value={message}
            maxLength={2000}
            onChange={(e) => setMessage(e.target.value)}
            error={errors.message}
            rows={3}
            required
          />
        </div>

        {/* Attachment Upload (Image or PDF up to 10MB) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-ink flex items-center justify-between">
            <span>Attachment (Optional)</span>
            <span className="text-[11px] text-muted font-normal">Images or PDF (Max 10 MB)</span>
          </label>

          {attachmentPreview ? (
            <div className="relative inline-flex items-center gap-2 p-2 border border-line rounded-xl bg-card">
              {isPdf ? (
                <div className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-primary" />
                  <span className="text-xs text-ink font-semibold">{attachmentFile?.name || 'Document.pdf'}</span>
                </div>
              ) : (
                <img
                  src={attachmentPreview}
                  alt="Attachment preview"
                  className="h-16 w-auto object-cover rounded-lg"
                />
              )}
              <button
                type="button"
                onClick={removeAttachment}
                className="p-1 text-muted hover:text-accent rounded-full"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 p-2.5 bg-card border border-line rounded-xl cursor-pointer hover:border-primary/50 text-xs font-semibold text-muted hover:text-ink transition">
              <Paperclip className="w-4 h-4 text-primary" />
              <span>Attach a screenshot or PDF</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}
          {errors.screenshot && (
            <p className="text-[11px] text-accent font-semibold">{errors.screenshot}</p>
          )}
        </div>

        {/* Diagnostic info consent */}
        <label className="flex items-start gap-2.5 p-2.5 bg-cream rounded-xl border border-line cursor-pointer select-none">
          <input
            type="checkbox"
            checked={attachDiagnostics}
            onChange={(e) => setAttachDiagnostics(e.target.checked)}
            className="mt-0.5 rounded text-primary focus:ring-primary"
          />
          <div className="text-[11px] text-ink">
            <span className="font-bold">Attach diagnostic info</span>
            <p className="text-muted text-[10px]">
              Includes app version (v1.0.0), platform, language, and screen dimensions. Strictly excludes tokens or private messages.
            </p>
          </div>
        </label>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} className="flex-1">
            Submit & Open Chat
          </Button>
        </div>
      </form>
    </Modal>
  );
};
