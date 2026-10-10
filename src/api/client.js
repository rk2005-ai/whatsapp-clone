const TOKEN_KEY = 'whatsapp_token';
const USER_KEY = 'whatsapp_user';

export const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setStoredAuth = (token, user) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch (e) {
    console.error('Failed to save auth to localStorage', e);
  }
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearStoredAuth = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (e) {
    console.error('Failed to clear auth', e);
  }
};

async function request(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  async requestOtp(phone, name) {
    return request('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, name })
    });
  },

  async verifyOtp(phone, otp) {
    const res = await request('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp })
    });
    if (res.token && res.user) {
      setStoredAuth(res.token, res.user);
    }
    return res;
  },

  async getMe() {
    return request('/api/auth/me');
  },

  async searchUsers(query) {
    if (!query || query.trim().length < 2) return [];
    const res = await request(`/api/users?q=${encodeURIComponent(query.trim())}`);
    return res.users || [];
  },

  async getConversations() {
    const res = await request('/api/conversations');
    return res.conversations || [];
  },

  async createConversation({ participantIds, isGroup = false, name = '' }) {
    const res = await request('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ participantIds, isGroup, name })
    });
    return res.conversation;
  },

  async getMessages(conversationId, { limit = 50, before = null } = {}) {
    let url = `/api/conversations/${conversationId}/messages?limit=${limit}`;
    if (before) url += `&before=${encodeURIComponent(before)}`;
    const res = await request(url);
    return res.messages || [];
  },

  async sendMessage(conversationId, { text = '', type = 'text', attachmentUrl = '', replyTo = null }) {
    const res = await request(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, type, attachmentUrl: attachmentUrl || undefined, replyTo: replyTo || undefined })
    });
    return res.message;
  },

  async editMessage(conversationId, messageId, text) {
    const res = await request(`/api/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ text })
    });
    return res.message;
  },

  async deleteMessage(conversationId, messageId) {
    const res = await request(`/api/conversations/${conversationId}/messages/${messageId}`, {
      method: 'DELETE'
    });
    return res.message;
  }
};
