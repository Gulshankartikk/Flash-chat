import axiosInstance from "./url.services";

export const searchUsers = async (q) => {
  try {
    const response = await axiosInstance.get(`/contacts/search?q=${encodeURIComponent(q)}`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const sendContactRequest = async (userId) => {
  try {
    const response = await axiosInstance.post("/contacts/request", { userId });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const getContacts = async () => {
  try {
    const response = await axiosInstance.get("/contacts");
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const getPendingRequests = async () => {
  try {
    const response = await axiosInstance.get("/contacts/requests");
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const acceptContactRequest = async (contactId) => {
  try {
    const response = await axiosInstance.patch(`/contacts/${contactId}/accept`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const rejectContactRequest = async (contactId) => {
  try {
    const response = await axiosInstance.patch(`/contacts/${contactId}/reject`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const blockContact = async (contactId) => {
  try {
    const response = await axiosInstance.patch(`/contacts/${contactId}/block`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const unblockContact = async (contactId) => {
  try {
    const response = await axiosInstance.patch(`/contacts/${contactId}/unblock`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const deleteContact = async (contactId) => {
  try {
    const response = await axiosInstance.delete(`/contacts/${contactId}`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const startDirectConversation = async (userId) => {
  try {
    const response = await axiosInstance.post("/conversations/direct", { userId });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

