import { create } from "zustand";
import { toast } from "react-toastify";
import * as businessApi from "../services/business.service";

const useBusinessStore = create((set, get) => ({
  isBusinessMode: false,
  organizations: [],
  currentOrg: null,
  tickets: [],
  isLoadingTickets: false,
  totalTickets: 0,

  // Filters
  filter: "all", // "all" | "assigned_to_me" | "unassigned"
  statusFilter: "all", // "all" | "open" | "pending" | "resolved"
  priorityFilter: "all", // "all" | "low" | "medium" | "high" | "urgent"

  // Analytics & KB
  overviewAnalytics: null,
  teamPerformance: [],
  knowledgeDocs: [],
  isLoadingAnalytics: false,
  isLoadingDocs: false,

  setBusinessMode: (isBusinessMode) => {
    set({ isBusinessMode });
    if (isBusinessMode && !get().currentOrg) {
      get().loadOrganizations();
    }
  },

  toggleBusinessMode: () => {
    const nextMode = !get().isBusinessMode;
    get().setBusinessMode(nextMode);
  },

  setFilter: (filter) => {
    set({ filter });
    get().fetchTickets();
  },

  setStatusFilter: (statusFilter) => {
    set({ statusFilter });
    get().fetchTickets();
  },

  setPriorityFilter: (priorityFilter) => {
    set({ priorityFilter });
    get().fetchTickets();
  },

  loadOrganizations: async () => {
    try {
      const res = await businessApi.getMyOrganizations();
      const orgs = res?.data || [];
      set({ organizations: orgs });

      if (orgs.length > 0 && !get().currentOrg) {
        set({ currentOrg: orgs[0] });
        get().fetchTickets();
      }
    } catch (err) {
      console.error("[useBusinessStore] Failed to load organizations:", err);
    }
  },

  selectOrganization: (org) => {
    set({ currentOrg: org });
    get().fetchTickets();
  },

  fetchTickets: async () => {
    const org = get().currentOrg;
    if (!org?._id) return;

    set({ isLoadingTickets: true });
    try {
      const { filter, statusFilter, priorityFilter } = get();
      const res = await businessApi.getSupportInbox(org._id, {
        filter,
        status: statusFilter,
        priority: priorityFilter,
      });

      const data = res?.data || {};
      set({
        tickets: data.conversations || [],
        totalTickets: data.total || 0,
        isLoadingTickets: false,
      });
    } catch (err) {
      console.error("[useBusinessStore] fetchTickets error:", err);
      set({ isLoadingTickets: false });
    }
  },

  assignTicket: async (ticketId, agentId) => {
    const org = get().currentOrg;
    if (!org?._id) return;

    try {
      const res = await businessApi.assignTicket(org._id, ticketId, agentId);
      const updated = res?.data;
      if (updated) {
        set((state) => ({
          tickets: state.tickets.map((t) => (t._id === ticketId ? updated : t)),
        }));
        toast.success("Ticket assigned successfully");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign ticket");
    }
  },

  updateTicketStatus: async (ticketId, status) => {
    const org = get().currentOrg;
    if (!org?._id) return;

    try {
      const res = await businessApi.updateTicketStatus(org._id, ticketId, status);
      const updated = res?.data;
      if (updated) {
        set((state) => ({
          tickets: state.tickets.map((t) => (t._id === ticketId ? updated : t)),
        }));
        toast.success(`Ticket marked as ${status}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  },

  updateTicketPriority: async (ticketId, priority) => {
    const org = get().currentOrg;
    if (!org?._id) return;

    try {
      const res = await businessApi.updateTicketPriority(org._id, ticketId, priority);
      const updated = res?.data;
      if (updated) {
        set((state) => ({
          tickets: state.tickets.map((t) => (t._id === ticketId ? updated : t)),
        }));
        toast.success(`Priority updated to ${priority}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update priority");
    }
  },

  addInternalNote: async (ticketId, text) => {
    const org = get().currentOrg;
    if (!org?._id) return;

    try {
      const res = await businessApi.addInternalNote(org._id, ticketId, text);
      const newNote = res?.data;
      if (newNote) {
        set((state) => ({
          tickets: state.tickets.map((t) => {
            if (t._id === ticketId) {
              return {
                ...t,
                internalNotes: [...(t.internalNotes || []), newNote],
              };
            }
            return t;
          }),
        }));
        toast.success("Internal note added");
      }
      return newNote;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add internal note");
      return null;
    }
  },

  loadAnalytics: async () => {
    const org = get().currentOrg;
    if (!org?._id) return;

    set({ isLoadingAnalytics: true });
    try {
      const [overviewRes, teamRes] = await Promise.all([
        businessApi.getBusinessOverview(org._id),
        businessApi.getTeamPerformance(org._id),
      ]);

      set({
        overviewAnalytics: overviewRes?.data || null,
        teamPerformance: teamRes?.data || [],
        isLoadingAnalytics: false,
      });
    } catch (err) {
      console.error("[useBusinessStore] loadAnalytics error:", err);
      set({ isLoadingAnalytics: false });
    }
  },

  loadKnowledgeBase: async () => {
    const org = get().currentOrg;
    if (!org?._id) return;

    set({ isLoadingDocs: true });
    try {
      const res = await businessApi.getKnowledgeDocuments(org._id);
      set({ knowledgeDocs: res?.data || [], isLoadingDocs: false });
    } catch (err) {
      console.error("[useBusinessStore] loadKnowledgeBase error:", err);
      set({ isLoadingDocs: false });
    }
  },

  uploadDoc: async (title, content, category) => {
    const org = get().currentOrg;
    if (!org?._id) return;

    try {
      const res = await businessApi.uploadKnowledgeDocument(org._id, {
        title,
        content,
        category,
      });
      toast.success("Document indexed into Knowledge Base!");
      get().loadKnowledgeBase();
      return res?.data;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload document");
      return null;
    }
  },

  deleteDoc: async (docId) => {
    const org = get().currentOrg;
    if (!org?._id) return;

    try {
      await businessApi.deleteKnowledgeDocument(org._id, docId);
      toast.success("Document removed from Knowledge Base");
      set((state) => ({
        knowledgeDocs: state.knowledgeDocs.filter((d) => d._id !== docId),
      }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete document");
    }
  },
}));

export default useBusinessStore;
