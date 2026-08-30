import axiosInstance from "./url.services";

export const sendOtp = async (phoneNumber, phoneSuffix, email) => {
  try {
    const response = await axiosInstance.post("/auth/send-otp", {
      phoneNumber,
      phoneSuffix,
      email,
    });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const verifyOtp = async (phoneNumber, phoneSuffix, otp, email) => {
  try {
    const response = await axiosInstance.post("/auth/verify-otp", {
      phoneNumber,
      phoneSuffix,
      otp,
      email,
    });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const googleSignIn = async (authPayload) => {
  try {
    const response = await axiosInstance.post("/auth/google", authPayload);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const createProfile = async (formDataOrData) => {
  try {
    const isFormData = formDataOrData instanceof FormData;
    const response = await axiosInstance.post("/auth/create-profile", formDataOrData, {
      headers: isFormData ? { "Content-Type": "multipart/form-data" } : undefined,
    });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const searchContactApi = async (query) => {
  try {
    const response = await axiosInstance.get(`/contacts/search?query=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

// ✅ Supports both plain JSON updates (name/about) and a profile-picture
// upload (FormData) — previously every caller had to build the right
// payload shape themselves and there was no way to send a File at all.
export const updateUserProfile = async (updateData) => {
  try {
    const isFormData = updateData instanceof FormData;
    const response = await axiosInstance.put("/auth/update-profile", updateData, {
      headers: isFormData ? { "Content-Type": "multipart/form-data" } : undefined,
    });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};


export const checkUserAuth = async () => {
  try {
    const response = await axiosInstance.get("/auth/check-auth");
    const authData = response.data?.data;
    if (authData && authData.isAuthenticated) {
      return { isAuthenticated: true, user: authData.user };
    }
    return { isAuthenticated: false };
  } catch (error) {
    // Anything (network down, 500, etc.) is a real error the
    // caller should know about.
    throw error.response ? error.response.data : error.message;
  }
};

export const logoutUser = async () => {
  try {
    // ✅ Logout mutates server state (clears the session) — it should be
    // a POST, not a GET. GET requests can be cached or prefetched by the
    // browser/proxies, which risks accidentally logging someone out.
    const response = await axiosInstance.post("/auth/logout");
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const getAllUser = async () => {
  try {
    const response = await axiosInstance.get("/auth/users");
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const blockUser = async (userId) => {
  try {
    const response = await axiosInstance.post(`/auth/block/${userId}`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const unblockUser = async (userId) => {
  try {
    const response = await axiosInstance.post(`/auth/unblock/${userId}`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};

export const updatePrivacySettings = async (settings) => {
  try {
    const response = await axiosInstance.put(`/auth/privacy-settings`, settings);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
};