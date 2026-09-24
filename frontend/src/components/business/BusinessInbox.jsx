import React, { useState, useEffect } from "react";
import {
  Plus,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  Inbox,
  UserCheck,
  ChevronDown,
} from "lucide-react";
import useBusinessStore from "../../store/useBusinessStore";
import useChatStore from "../../store/chatStore";
import useLayoutStore from "../../store/useLayoutStore";
import CreateOrgModal from "./CreateOrgModal";
import BusinessAnalyticsModal from "./BusinessAnalyticsModal";
import KnowledgeBaseModal from "./KnowledgeBaseModal";
import { formatTime } from "../../utils/formatTime";

const BusinessInbox = () => {
  const organizations = useBusinessStore((s) => s.organizations);
  const currentOrg = useBusinessStore((s) => s.currentOrg);
  const selectOrganization = useBusinessStore((s) => s.selectOrganization);
  const tickets = useBusinessStore((s) => s.tickets);
  const isLoadingTickets = useBusinessStore((s) => s.isLoadingTickets);
  const filter = useBusinessStore((s) => s.filter);
  const setFilter = useBusinessStore((s) => s.setFilter);
  const statusFilter = useBusinessStore((s) => s.statusFilter);
  const setStatusFilter = useBusinessStore((s) => s.setStatusFilter);
  const fetchTickets = useBusinessStore((s) => s.fetchTickets);

  const setSelectedContact = useLayoutStore((s) => s.setSelectedContact);
  const selectedContact = useLayoutStore((s) => s.selectedContact);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const fetchMessages = useChatStore((s) => s.fetchMessages);

  // Modals
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showKB, setShowKB] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  useEffect(() => {
    if (currentOrg) {
      fetchTickets();
    }
  }, [currentOrg, fetchTickets]);

  const handleSelectTicket = (ticket) => {
    setSelectedContact(ticket);
    setActiveConversation(ticket);
    fetchMessages(ticket._id);
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "urgent":
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-500/10 text-red-500">Urgent</span>;
      case "high":
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/10 text-amber-500">High</span>;
      case "medium":
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-500/10 text-blue-500">Medium</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-500">Low</span>;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "resolved":
        return <CheckCircle2 size={12} className="text-emerald-500" />;
      case "pending":
        return <Clock size={12} className="text-amber-500" />;
      default:
        return <AlertCircle size={12} className="text-blue-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111111] border-r border-slate-200 dark:border-[#222222]">
      {/* Business Workspace Header */}
      <div className="p-4 border-b border-slate-100 dark:border-[#222222]">
        <div className="relative">
          <button
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#262626] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-7 h-7 rounded-lg bg-[#FF6B00] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {(currentOrg?.name || "B").charAt(0).toUpperCase()}
              </div>
              <div className="text-left truncate">
                <div className="text-xs font-bold text-slate-800 dark:text-white truncate">
                  {currentOrg?.name || "Select Workspace"}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {currentOrg?.category || "Workspace"}
                </div>
              </div>
            </div>
            <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
          </button>

          {orgDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2c2c2c] rounded-xl shadow-xl z-30 p-1 space-y-1">
              {organizations.map((org) => (
                <button
                  key={org._id}
                  onClick={() => {
                    selectOrganization(org);
                    setOrgDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                    currentOrg?._id === org._id
                      ? "bg-[#FF6B00]/10 text-[#FF6B00]"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222222]"
                  }`}
                >
                  <span className="truncate">{org.name}</span>
                  {currentOrg?._id === org._id && <CheckCircle2 size={12} />}
                </button>
              ))}
              <div className="border-t border-slate-100 dark:border-[#222222] pt-1">
                <button
                  onClick={() => {
                    setOrgDropdownOpen(false);
                    setShowCreateOrg(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-[#FF6B00] hover:bg-[#FF6B00]/10 flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={14} />
                  <span>Create Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Tools: Analytics & Knowledge Base */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={() => setShowAnalytics(true)}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#181818] hover:bg-slate-100 dark:hover:bg-[#222222] text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            <BarChart3 size={13} className="text-[#FF6B00]" />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => setShowKB(true)}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#181818] hover:bg-slate-100 dark:hover:bg-[#222222] text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            <BookOpen size={13} className="text-[#FF6B00]" />
            <span>Knowledge Base</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 mt-3 bg-slate-100 dark:bg-[#181818] p-1 rounded-lg text-[11px]">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 py-1 rounded-md font-semibold transition-colors ${
              filter === "all"
                ? "bg-white dark:bg-[#262626] text-[#FF6B00] shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("assigned_to_me")}
            className={`flex-1 py-1 rounded-md font-semibold transition-colors ${
              filter === "assigned_to_me"
                ? "bg-white dark:bg-[#262626] text-[#FF6B00] shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Assigned to Me
          </button>
          <button
            onClick={() => setFilter("unassigned")}
            className={`flex-1 py-1 rounded-md font-semibold transition-colors ${
              filter === "unassigned"
                ? "bg-white dark:bg-[#262626] text-[#FF6B00] shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Unassigned
          </button>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto text-[10px] font-semibold text-slate-500">
          {["all", "open", "pending", "resolved"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2 py-0.5 rounded-full capitalize whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? "bg-[#FF6B00] text-white"
                  : "bg-slate-100 dark:bg-[#1c1c1c] hover:bg-slate-200 dark:hover:bg-[#262626]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-[#1c1c1c]">
        {isLoadingTickets ? (
          <div className="py-12 flex justify-center">
            <div className="w-5 h-5 border-2 border-slate-300 dark:border-[#222222] border-t-[#FF6B00] rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Inbox size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs font-semibold">No tickets match this filter</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Customer support inquiries will appear here automatically.
            </p>
          </div>
        ) : (
          tickets.map((ticket) => {
            const isSelected = selectedContact?._id === ticket._id;
            const customer = ticket.participants?.[0] || {};
            const lastMsg = ticket.lastMessage;

            return (
              <div
                key={ticket._id}
                onClick={() => handleSelectTicket(ticket)}
                className={`p-3.5 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-[#FF6B00]/10 border-l-3 border-[#FF6B00]"
                    : "hover:bg-slate-50 dark:hover:bg-[#181818]"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 truncate">
                    {getStatusIcon(ticket.ticketStatus)}
                    <span className="font-bold text-xs text-slate-800 dark:text-white truncate">
                      {customer.displayName || customer.username || "Customer"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {getPriorityBadge(ticket.priority)}
                    <span className="text-[10px] text-slate-400">
                      {ticket.updatedAt ? formatTime(ticket.updatedAt) : ""}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-[#999999] truncate mb-2">
                  {lastMsg?.content || "No messages yet"}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 truncate">
                    <UserCheck size={11} className="text-slate-400" />
                    {ticket.assignedAgent ? ticket.assignedAgent.displayName || ticket.assignedAgent.username : "Unassigned"}
                  </span>
                  {ticket.internalNotes && ticket.internalNotes.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#222222] font-semibold text-slate-500">
                      {ticket.internalNotes.length} notes
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <CreateOrgModal isOpen={showCreateOrg} onClose={() => setShowCreateOrg(false)} />
      <BusinessAnalyticsModal isOpen={showAnalytics} onClose={() => setShowAnalytics(false)} />
      <KnowledgeBaseModal isOpen={showKB} onClose={() => setShowKB(false)} />
    </div>
  );
};

export default BusinessInbox;
