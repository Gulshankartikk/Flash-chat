import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  Search,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Bug,
  Lightbulb,
  CreditCard,
  User,
  Shield,
  Clock,
  ExternalLink,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  Lock,
  WifiOff,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { useSupportStore } from './useSupport';
import { SupportTicketModal } from './SupportTicketModal';
import { useAuthStore } from '../../store/useAuthStore';

const TOPIC_CHIPS = [
  { id: 'all', label: 'All FAQs', icon: <HelpCircle className="w-3.5 h-3.5" /> },
  { id: 'account', label: 'Account & Login', icon: <User className="w-3.5 h-3.5" /> },
  { id: 'bug', label: 'Bugs & Troubleshooting', icon: <Bug className="w-3.5 h-3.5" /> },
  { id: 'feature', label: 'Features & AI', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'billing', label: 'Pocket & Storage', icon: <CreditCard className="w-3.5 h-3.5" /> }
];

export const SupportHomePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const {
    faqs,
    policy,
    tickets,
    isLoading,
    error,
    fetchFaqs,
    fetchPolicy,
    fetchTickets
  } = useSupportStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFaqId, setExpandedFaqId] = useState(null);
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [ticketInitialCategory, setTicketInitialCategory] = useState('general');

  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

  useEffect(() => {
    fetchFaqs();
    fetchPolicy();
    fetchTickets();
  }, [fetchFaqs, fetchPolicy, fetchTickets]);

  // Deep-linkable FAQ hash support (#faq-id)
  useEffect(() => {
    if (location.hash && location.hash.startsWith('#faq-')) {
      const faqId = location.hash.replace('#faq-', '');
      setExpandedFaqId(faqId);
      setTimeout(() => {
        const el = document.getElementById(`faq-${faqId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [location.hash, faqs]);

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory =
      selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFaq = (id) => {
    setExpandedFaqId((prev) => (prev === id ? null : id));
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'open':
        return (
          <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
            Open
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-0.5 rounded-full bg-muted/20 text-muted text-[10px] font-bold">
            Waiting on agent
          </span>
        );
      case 'resolved':
      case 'closed':
        return (
          <span className="px-2 py-0.5 rounded-full bg-card border border-line text-ink text-[10px] font-semibold">
            Resolved
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-cream select-none overflow-y-auto">
      {/* Top Page Header */}
      <PageHeader
        title="Help & Support"
        subtitle="FAQs, AI assistant and live support"
        actions={
          user?.role === 'admin' || user?.role === 'support' ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<Shield className="w-3.5 h-3.5 text-primary" />}
              onClick={() => navigate('/admin/support')}
            >
              Agent Console
            </Button>
          ) : null
        }
      />

      {/* Offline Warning Banner */}
      {!isOnline && (
        <div className="mx-4 md:mx-6 mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-200">
          <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
          <span>You are currently offline. You can still write and queue messages; they will send automatically once you reconnect.</span>
        </div>
      )}

      {/* Hero Section */}
      <div className="p-6 md:p-8 bg-gradient-to-r from-primary to-secondary text-white rounded-3xl m-4 md:m-6 shadow-xl shadow-primary/20 space-y-4">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Flash Support 24/7</span>
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">How can we help you today?</h1>
          <p className="text-white/90 text-xs md:text-sm mt-1.5 leading-relaxed">
            Instant assistance from Flash AI and human escalation when you need it.
          </p>
        </div>

        {/* Big Chat With Us Button */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setTicketInitialCategory('general');
              setIsTicketModalOpen(true);
            }}
            className="px-5 py-3 rounded-2xl bg-white text-primary font-bold text-xs shadow-lg hover:bg-cream hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 fill-primary" />
            <span>Chat with us</span>
          </button>

          {policy?.expectedResponseTime && (
            <div className="flex items-center gap-1.5 text-white/80 text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>Typical human response time: <strong>{policy.expectedResponseTime}</strong></span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 md:px-6 space-y-6 pb-12">
        {/* Expandable "What can our team see?" Privacy Disclosure */}
        <div className="bg-card border border-line rounded-2xl overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setIsPrivacyExpanded((prev) => !prev)}
            aria-expanded={isPrivacyExpanded}
            className="w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-cream/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-bold text-ink">What can our team see?</span>
            </div>
            {isPrivacyExpanded ? (
              <ChevronUp className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted shrink-0" />
            )}
          </button>
          {isPrivacyExpanded && (
            <div className="px-4 pb-4 pt-1 text-xs text-muted leading-relaxed border-t border-line/40 bg-cream/30 space-y-2">
              <p>
                <strong>Strict Privacy Guarantee:</strong> Support agents and team members can <em>only</em> see the specific support conversation and ticket details you submit.
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Agents <strong>never</strong> have access to your private 1:1 or group chats.</li>
                <li>Agents <strong>never</strong> have access to your zero-knowledge Pocket vault.</li>
                <li>Agents <strong>never</strong> have access to your contacts or personal Flash AI history.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Your Support Tickets Section */}
        {isLoading && tickets.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-48 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          </div>
        ) : error && tickets.length === 0 ? (
          <div className="p-4 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-between text-xs text-accent">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={fetchTickets}>
              Retry
            </Button>
          </div>
        ) : tickets.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Your Support Conversations</h2>
              <span className="text-xs text-muted font-medium">{tickets.length} tickets</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket._id}
                  onClick={() =>
                    navigate(
                      `/support/chat?ticketId=${ticket._id}&cid=${
                        ticket.conversation?._id || ticket.conversation
                      }`
                    )
                  }
                  className="p-3.5 bg-card hover:bg-orange-50/30 border border-line rounded-2xl cursor-pointer transition shadow-xs flex items-center justify-between group"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusChip(ticket.status)}
                      <span className="text-[11px] text-muted capitalize">
                        {ticket.category}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-ink truncate group-hover:text-primary transition-colors">
                      {ticket.subject}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-cream border border-line flex items-center justify-center text-primary group-hover:scale-110 transition-transform shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* FAQ Search & Topic Filter */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Frequently Asked Questions</h2>
              <p className="text-[11px] text-muted">Quick answers to common questions</p>
            </div>

            {/* Search FAQ input */}
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-card border border-line rounded-xl text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* Topic Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {TOPIC_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedCategory(chip.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === chip.id
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-card border border-line text-muted hover:text-ink'
                }`}
              >
                {chip.icon}
                <span>{chip.label}</span>
              </button>
            ))}
          </div>

          {/* FAQ Accordion List */}
          <div className="space-y-2.5">
            {filteredFaqs.length === 0 ? (
              <div className="p-8 text-center bg-card rounded-2xl border border-line">
                <p className="text-xs font-bold text-ink">No matching FAQs found</p>
                <p className="text-[11px] text-muted mt-1">
                  Have a specific question? Start a support conversation with us.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  onClick={() => setIsTicketModalOpen(true)}
                >
                  Ask Flash Support
                </Button>
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const isExpanded = expandedFaqId === faq._id;
                return (
                  <div
                    key={faq._id}
                    id={`faq-${faq._id}`}
                    className="bg-card border border-line rounded-2xl overflow-hidden transition-all shadow-xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(faq._id)}
                      aria-expanded={isExpanded}
                      className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-orange-50/20 transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-bold text-ink">{faq.question}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 text-xs text-ink/80 leading-relaxed border-t border-line/40 bg-cream/40">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Start Ticket Modal */}
      <SupportTicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        initialCategory={ticketInitialCategory}
      />
    </div>
  );
};

