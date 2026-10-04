import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Search,
  Filter,
  User,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send,
  MessageSquare,
  FileText,
  Sparkles,
  Layers,
  ChevronRight,
  Info,
  HelpCircle,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  Lock
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { useSupportStore } from './useSupport';
import { useAuthStore } from '../../store/useAuthStore';
import { getSocket, useSocketStore } from '../../services/socket';

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending Handoff' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' }
];

const PRIORITY_FILTERS = [
  { value: '', label: 'All Priorities' },
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'high', label: '🟠 High' },
  { value: 'normal', label: '🟡 Normal' },
  { value: 'low', label: '⚪ Low' }
];

export const AdminSupportPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    adminTickets,
    cannedReplies,
    fetchAdminTickets,
    fetchCannedReplies,
    assignTicketToMe,
    updateTicketStatus,
    sendAgentReply
  } = useSupportStore();

  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showCannedModal, setShowCannedModal] = useState(false);

  // New Canned Reply State
  const [newCannedTitle, setNewCannedTitle] = useState('');
  const [newCannedContent, setNewCannedContent] = useState('');
  const [newCannedCategory, setNewCannedCategory] = useState('general');

  // Role Guard (Strict 404 for normal users)
  const isAgent = user?.role === 'support' || user?.role === 'admin';

  useEffect(() => {
    if (isAgent) {
      fetchAdminTickets({ status: statusFilter, priority: priorityFilter, search });
      fetchCannedReplies();
    }
  }, [isAgent, statusFilter, priorityFilter, search, fetchAdminTickets, fetchCannedReplies]);

  // Socket real-time updates for admin ticket list
  useEffect(() => {
    if (!isAgent) return;
    const socket = getSocket();
    if (!socket) return;

    const handleTicketUpdated = () => {
      fetchAdminTickets({ status: statusFilter, priority: priorityFilter, search });
      if (soundEnabled) {
        try {
          const audio = new Audio('/sounds/notification.mp3');
          audio.play().catch(() => {});
        } catch (_) {}
      }
    };

    socket.on('support:ticket-updated', handleTicketUpdated);
    return () => {
      socket.off('support:ticket-updated', handleTicketUpdated);
    };
  }, [isAgent, statusFilter, priorityFilter, search, soundEnabled, fetchAdminTickets]);

  // Keyboard Shortcuts: J/K navigation, A assign, E resolve, ? help
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore when typing inside input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setShowHelpModal(true);
      } else if (e.key === 'j' || e.key === 'J') {
        // Next ticket
        if (adminTickets.length === 0) return;
        const currentIndex = adminTickets.findIndex((t) => t._id === selectedTicket?._id);
        const nextIndex = currentIndex < adminTickets.length - 1 ? currentIndex + 1 : 0;
        setSelectedTicket(adminTickets[nextIndex]);
      } else if (e.key === 'k' || e.key === 'K') {
        // Prev ticket
        if (adminTickets.length === 0) return;
        const currentIndex = adminTickets.findIndex((t) => t._id === selectedTicket?._id);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : adminTickets.length - 1;
        setSelectedTicket(adminTickets[prevIndex]);
      } else if (e.key === 'a' || e.key === 'A') {
        // Assign to me
        if (selectedTicket) {
          handleAssign(selectedTicket);
        }
      } else if (e.key === 'e' || e.key === 'E') {
        // Resolve ticket
        if (selectedTicket) {
          handleStatusChange(selectedTicket, 'resolved');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [adminTickets, selectedTicket]);

  if (!isAgent) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-cream">
        <div className="w-16 h-16 rounded-3xl bg-accent/15 text-accent flex items-center justify-center mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-ink mb-1">404 - Not Found</h2>
        <p className="text-xs text-muted max-w-sm mb-4">
          The requested page could not be found or you do not have permission to view it.
        </p>
        <Button variant="primary" size="sm" onClick={() => navigate('/support')}>
          Back to Support Home
        </Button>
      </div>
    );
  }

  const handleAssign = async (ticket) => {
    try {
      const updated = await assignTicketToMe(ticket._id);
      if (selectedTicket?._id === ticket._id) {
        setSelectedTicket(updated);
      }
    } catch (_) {}
  };

  const handleStatusChange = async (ticket, newStatus) => {
    try {
      const updated = await updateTicketStatus(ticket._id, newStatus);
      if (selectedTicket?._id === ticket._id) {
        setSelectedTicket(updated);
      }
    } catch (_) {}
  };

  return (
    <div className="flex flex-col h-full bg-cream select-none overflow-hidden">
      {/* Top Header */}
      <PageHeader
        title="Support Agent Console"
        subtitle={`Logged in as ${user.name} (${user.role})`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`p-2 rounded-xl border border-line text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                soundEnabled ? 'bg-primary/15 text-primary' : 'bg-card text-muted hover:text-ink'
              }`}
              title={soundEnabled ? 'Sound alert active' : 'Enable sound alerts'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <Button
              variant="secondary"
              size="sm"
              icon={<HelpCircle className="w-3.5 h-3.5 text-muted" />}
              onClick={() => setShowHelpModal(true)}
            >
              Shortcuts (?)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileText className="w-3.5 h-3.5 text-primary" />}
              onClick={() => setShowCannedModal(true)}
            >
              Canned Replies
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => fetchAdminTickets({ status: statusFilter, priority: priorityFilter, search })}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Main Split Console */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Ticket Queue */}
        <div
          className={`${
            selectedTicket ? 'hidden md:flex' : 'flex'
          } w-full md:w-96 border-r border-line bg-card flex-col h-full overflow-hidden`}
        >
          {/* Filters Bar */}
          <div className="p-3 border-b border-line space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Search ticket subject or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-cream border border-line rounded-xl text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-cream border border-line text-ink rounded-xl px-2 py-1 text-[11px] font-semibold flex-1"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-cream border border-line text-ink rounded-xl px-2 py-1 text-[11px] font-semibold flex-1"
              >
                {PRIORITY_FILTERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ticket List */}
          <div className="flex-1 overflow-y-auto divide-y divide-line/40" role="list">
            {adminTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">
                No tickets matching current filters.
              </div>
            ) : (
              adminTickets.map((ticket) => {
                const isSelected = selectedTicket?._id === ticket._id;
                const needsReply = ticket.status === 'pending';
                return (
                  <div
                    key={ticket._id}
                    role="listitem"
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-3 cursor-pointer transition text-xs relative ${
                      isSelected
                        ? 'bg-orange-50/70 border-l-4 border-l-primary'
                        : needsReply
                        ? 'bg-amber-500/5 hover:bg-cream/50'
                        : 'hover:bg-cream/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-[10px] text-muted">
                        #{ticket._id.slice(-6)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {needsReply && (
                          <span className="w-2 h-2 rounded-full bg-amber-500" title="Needs agent reply" />
                        )}
                        <span
                          className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                            ticket.status === 'open'
                              ? 'bg-primary/15 text-primary'
                              : ticket.status === 'pending'
                              ? 'bg-amber-500/15 text-amber-600'
                              : 'bg-card border border-line text-muted'
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                    </div>
                    <p className="font-bold text-ink truncate mb-1">{ticket.subject}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span className="capitalize">{ticket.category}</span>
                      <span>{ticket.user?.name || 'User'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail / Conversation Panel */}
        <div
          className={`${
            selectedTicket ? 'flex' : 'hidden md:flex'
          } flex-1 flex-col h-full bg-cream overflow-hidden`}
        >
          {selectedTicket ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Ticket Top Action Bar */}
              <div className="p-3 bg-card border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    className="md:hidden p-1.5 rounded-xl bg-cream hover:bg-orange-50/50 border border-line text-ink"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h3 className="text-xs font-bold text-ink flex items-center gap-2">
                      <span>{selectedTicket.subject}</span>
                      <span className="font-mono text-[10px] text-muted font-normal">
                        (#{selectedTicket._id.slice(-6)})
                      </span>
                    </h3>
                    <p className="text-[11px] text-muted flex items-center gap-1">
                      <Lock className="w-3 h-3 text-primary" />
                      <span>Ticket audit: You can only see this specific ticket.</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(selectedTicket, e.target.value)}
                    className="bg-cream border border-line text-ink rounded-xl px-2.5 py-1 text-xs font-semibold cursor-pointer"
                  >
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleAssign(selectedTicket)}
                  >
                    {selectedTicket.assignedTo ? 'Reassign to Me (A)' : 'Assign to Me (A)'}
                  </Button>
                </div>
              </div>

              {/* Middle Chat Window */}
              <div className="flex-1 overflow-hidden">
                <ChatWindow
                  conversationId={
                    selectedTicket.conversation?._id || selectedTicket.conversation
                  }
                />
              </div>

              {/* Bottom Canned Replies Bar */}
              {cannedReplies.length > 0 && (
                <div className="p-2 bg-card border-t border-line flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider shrink-0">
                    Canned:
                  </span>
                  {cannedReplies.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => {
                        // Dispatch canned text to active composer input if any
                        const input = document.querySelector('input[type="text"], textarea');
                        if (input) {
                          input.value = c.content;
                          input.focus();
                        }
                      }}
                      className="px-2.5 py-1 rounded-full bg-cream hover:bg-orange-50/50 border border-line text-[11px] text-ink font-semibold whitespace-nowrap transition cursor-pointer"
                      title={c.content}
                    >
                      {c.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-2xl bg-card border border-line flex items-center justify-center text-muted mb-2">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-ink">Select a ticket from the queue</p>
              <p className="text-[11px] text-muted mt-0.5">
                Pick an inquiry from the list to view the conversation and respond. Use J/K shortcuts to navigate.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="Agent Console Keyboard Shortcuts"
        maxWidth="max-w-sm"
      >
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-2 bg-cream rounded-xl">
            <span className="text-muted">Next ticket</span>
            <kbd className="px-2 py-0.5 bg-card border border-line rounded text-xs font-mono font-bold">J</kbd>
          </div>
          <div className="flex items-center justify-between p-2 bg-cream rounded-xl">
            <span className="text-muted">Previous ticket</span>
            <kbd className="px-2 py-0.5 bg-card border border-line rounded text-xs font-mono font-bold">K</kbd>
          </div>
          <div className="flex items-center justify-between p-2 bg-cream rounded-xl">
            <span className="text-muted">Assign to me</span>
            <kbd className="px-2 py-0.5 bg-card border border-line rounded text-xs font-mono font-bold">A</kbd>
          </div>
          <div className="flex items-center justify-between p-2 bg-cream rounded-xl">
            <span className="text-muted">Resolve ticket</span>
            <kbd className="px-2 py-0.5 bg-card border border-line rounded text-xs font-mono font-bold">E</kbd>
          </div>
          <div className="flex items-center justify-between p-2 bg-cream rounded-xl">
            <span className="text-muted">Show this help</span>
            <kbd className="px-2 py-0.5 bg-card border border-line rounded text-xs font-mono font-bold">?</kbd>
          </div>
        </div>
      </Modal>

      {/* Canned Replies Management Modal */}
      <Modal
        isOpen={showCannedModal}
        onClose={() => setShowCannedModal(false)}
        title="Canned Replies Library"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="max-h-52 overflow-y-auto space-y-2 divide-y divide-line/30">
            {cannedReplies.map((c) => (
              <div key={c._id} className="pt-2 text-xs">
                <p className="font-bold text-ink">{c.title}</p>
                <p className="text-[11px] text-muted line-clamp-2 mt-0.5">{c.content}</p>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
