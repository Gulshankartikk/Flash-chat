import { create } from 'zustand';
import api from '../../services/api';

export const useSupportStore = create((set, get) => ({
  faqs: [],
  categories: [],
  policy: null,
  tickets: [],
  activeTicket: null,
  adminTickets: [],
  cannedReplies: [],
  isLoading: false,
  error: null,

  fetchFaqs: async (category = '') => {
    try {
      const res = await api.get(`/support/faq${category ? `?category=${category}` : ''}`);
      set({
        faqs: res.data.faqs || [],
        categories: res.data.categories || []
      });
    } catch (err) {
      console.error('Failed to fetch FAQs', err);
    }
  },

  fetchPolicy: async () => {
    try {
      const res = await api.get('/support/policy');
      set({ policy: res.data.policy });
    } catch (err) {
      console.error('Failed to fetch support policy', err);
    }
  },

  fetchTickets: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/support/tickets');
      set({ tickets: res.data.tickets || [], isLoading: false });
    } catch (err) {
      set({
        error: err.response?.data?.message || 'Failed to fetch tickets',
        isLoading: false
      });
    }
  },

  createTicket: async ({ category, subject, message, screenshot, diagnosticInfo }) => {
    try {
      const res = await api.post('/support/tickets', {
        category,
        subject,
        message,
        screenshot,
        diagnosticInfo
      });
      const ticket = res.data.ticket;
      set((state) => ({
        tickets: [ticket, ...state.tickets],
        activeTicket: ticket
      }));
      return res.data;
    } catch (err) {
      throw err;
    }
  },

  rateTicket: async (ticketId, rating, comment = '') => {
    try {
      const res = await api.post(`/support/tickets/${ticketId}/rate`, { rating, comment });
      const updated = res.data.ticket;
      set((state) => ({
        tickets: state.tickets.map((t) => (t._id === ticketId ? updated : t)),
        activeTicket: state.activeTicket?._id === ticketId ? updated : state.activeTicket
      }));
      return updated;
    } catch (err) {
      throw err;
    }
  },

  closeTicket: async (ticketId) => {
    try {
      const res = await api.post(`/support/tickets/${ticketId}/close`);
      const updated = res.data.ticket;
      set((state) => ({
        tickets: state.tickets.map((t) => (t._id === ticketId ? updated : t)),
        activeTicket: state.activeTicket?._id === ticketId ? updated : state.activeTicket
      }));
      return updated;
    } catch (err) {
      throw err;
    }
  },

  reopenTicket: async (ticketId) => {
    try {
      const res = await api.post(`/support/tickets/${ticketId}/reopen`);
      const updated = res.data.ticket;
      set((state) => ({
        tickets: state.tickets.map((t) => (t._id === ticketId ? updated : t)),
        activeTicket: state.activeTicket?._id === ticketId ? updated : state.activeTicket
      }));
      return updated;
    } catch (err) {
      throw err;
    }
  },

  requestHumanHandoff: async (ticketId) => {
    try {
      const res = await api.post(`/support/tickets/${ticketId}/handoff`);
      const updated = res.data.ticket;
      set((state) => ({
        tickets: state.tickets.map((t) => (t._id === ticketId ? updated : t)),
        activeTicket: state.activeTicket?._id === ticketId ? updated : state.activeTicket
      }));
      return updated;
    } catch (err) {
      throw err;
    }
  },

  // Admin / Agent actions
  fetchAdminTickets: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const res = await api.get(`/admin/support/tickets?${params}`);
      set({ adminTickets: res.data.tickets || [] });
    } catch (err) {
      console.error('Failed to fetch admin tickets', err);
    }
  },

  fetchCannedReplies: async () => {
    try {
      const res = await api.get('/admin/support/canned-replies');
      set({ cannedReplies: res.data.replies || [] });
    } catch (err) {
      console.error('Failed to fetch canned replies', err);
    }
  },

  assignTicketToMe: async (ticketId) => {
    try {
      const res = await api.patch(`/admin/support/tickets/${ticketId}/assign`);
      const updated = res.data.ticket;
      set((state) => ({
        adminTickets: state.adminTickets.map((t) => (t._id === ticketId ? updated : t))
      }));
      return updated;
    } catch (err) {
      throw err;
    }
  },

  updateTicketStatus: async (ticketId, status) => {
    try {
      const res = await api.patch(`/admin/support/tickets/${ticketId}/status`, { status });
      const updated = res.data.ticket;
      set((state) => ({
        adminTickets: state.adminTickets.map((t) => (t._id === ticketId ? updated : t))
      }));
      return updated;
    } catch (err) {
      throw err;
    }
  },

  sendAgentReply: async (ticketId, text) => {
    try {
      const res = await api.post(`/admin/support/tickets/${ticketId}/reply`, { text });
      return res.data;
    } catch (err) {
      throw err;
    }
  }
}));
