import axiosInstance from "./url.services";

const api = axiosInstance;

// Helper to pass active organization ID in headers
const orgHeader = (orgId) => ({
  headers: orgId ? { "x-organization-id": orgId } : {},
});

export const getMyOrganizations = async () => {
  const res = await api.get("/api/v1/organizations/my");
  return res.data;
};

export const createOrganization = async (data) => {
  const res = await api.post("/api/v1/organizations/create", data);
  return res.data;
};

export const getOrganizationDetails = async (orgId) => {
  const res = await api.get(`/api/v1/organizations/${orgId}`, orgHeader(orgId));
  return res.data;
};

export const updateOrganizationProfile = async (orgId, data) => {
  const res = await api.put(`/api/v1/organizations/${orgId}/profile`, data, orgHeader(orgId));
  return res.data;
};

export const addMember = async (orgId, data) => {
  const res = await api.post(`/api/v1/organizations/${orgId}/members`, data, orgHeader(orgId));
  return res.data;
};

export const updateMemberRole = async (orgId, memberUserId, data) => {
  const res = await api.put(`/api/v1/organizations/${orgId}/members/${memberUserId}/role`, data, orgHeader(orgId));
  return res.data;
};

export const removeMember = async (orgId, memberUserId) => {
  const res = await api.delete(`/api/v1/organizations/${orgId}/members/${memberUserId}`, orgHeader(orgId));
  return res.data;
};

// Business Support Inbox
export const getSupportInbox = async (orgId, params = {}) => {
  const res = await api.get("/api/v1/business/inbox", {
    ...orgHeader(orgId),
    params,
  });
  return res.data;
};

export const assignTicket = async (orgId, conversationId, agentId) => {
  const res = await api.put(
    `/api/v1/business/tickets/${conversationId}/assign`,
    { agentId },
    orgHeader(orgId)
  );
  return res.data;
};

export const updateTicketStatus = async (orgId, conversationId, status) => {
  const res = await api.put(
    `/api/v1/business/tickets/${conversationId}/status`,
    { status },
    orgHeader(orgId)
  );
  return res.data;
};

export const updateTicketPriority = async (orgId, conversationId, priority) => {
  const res = await api.put(
    `/api/v1/business/tickets/${conversationId}/priority`,
    { priority },
    orgHeader(orgId)
  );
  return res.data;
};

export const addInternalNote = async (orgId, conversationId, text) => {
  const res = await api.post(
    `/api/v1/business/tickets/${conversationId}/notes`,
    { text },
    orgHeader(orgId)
  );
  return res.data;
};

// Analytics
export const getBusinessOverview = async (orgId) => {
  const res = await api.get("/api/v1/business/analytics/overview", orgHeader(orgId));
  return res.data;
};

export const getTeamPerformance = async (orgId) => {
  const res = await api.get("/api/v1/business/analytics/team", orgHeader(orgId));
  return res.data;
};

// Knowledge Base (RAG)
export const getKnowledgeDocuments = async (orgId) => {
  const res = await api.get("/api/v1/knowledge-base/documents", orgHeader(orgId));
  return res.data;
};

export const uploadKnowledgeDocument = async (orgId, data) => {
  const res = await api.post("/api/v1/knowledge-base/documents", data, orgHeader(orgId));
  return res.data;
};

export const deleteKnowledgeDocument = async (orgId, docId) => {
  const res = await api.delete(`/api/v1/knowledge-base/documents/${docId}`, orgHeader(orgId));
  return res.data;
};

export const queryKnowledgeBase = async (orgId, query) => {
  const res = await api.post("/api/v1/knowledge-base/query", { query }, orgHeader(orgId));
  return res.data;
};
