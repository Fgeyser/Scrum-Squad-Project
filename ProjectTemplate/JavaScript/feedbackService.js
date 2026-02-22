const API_BASE = window.API_BASE || 'http://localhost:8000';

async function parseJsonResponse(resp) {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data && data.message ? data.message : 'Request failed';
    throw new Error(msg);
  }
  return data;
}

const FeedbackService = {
  async whoami() {
    const resp = await fetch(API_BASE + '/api/whoami', { credentials: 'include' });
    return parseJsonResponse(resp);
  },

  async getAll() {
    const resp = await fetch(API_BASE + '/api/feedback', { credentials: 'include' });
    return parseJsonResponse(resp);
  },

  async create(feedback) {
    const resp = await fetch(API_BASE + '/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(feedback)
    });
    return parseJsonResponse(resp);
  },

  async toggleUpvote(id) {
    const resp = await fetch(API_BASE + `/api/feedback/${id}/upvote`, {
      method: 'POST',
      credentials: 'include'
    });
    return parseJsonResponse(resp);
  },

  async toggleLike(id) {
    const resp = await fetch(API_BASE + `/api/feedback/${id}/like`, {
      method: 'POST',
      credentials: 'include'
    });
    return parseJsonResponse(resp);
  },

  async getComments(postId) {
    const resp = await fetch(API_BASE + `/api/feedback/${postId}/comments`, {
      credentials: 'include'
    });
    return parseJsonResponse(resp);
  },

  async addComment(postId, text) {
    const resp = await fetch(API_BASE + `/api/feedback/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text })
    });
    return parseJsonResponse(resp);
  },

  async getMyPoints() {
    const resp = await fetch(API_BASE + '/api/my-points', { credentials: 'include' });
    return parseJsonResponse(resp);
  },

  async getUpdates(postId) {
    const resp = await fetch(API_BASE + `/api/feedback/${postId}/updates`, {
      credentials: 'include'
    });
    return parseJsonResponse(resp);
  },

  async addUpdate(postId, text) {
    const resp = await fetch(API_BASE + `/api/feedback/${postId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text })
    });
    return parseJsonResponse(resp);
  },

  async getNotifications() {
    const resp = await fetch(API_BASE + '/api/notifications', { credentials: 'include' });
    return parseJsonResponse(resp);
  },

  async markNotificationRead(id) {
    const resp = await fetch(API_BASE + `/api/notifications/${id}/read`, {
      method: 'POST',
      credentials: 'include'
    });
    return parseJsonResponse(resp);
  },

  async deleteNotification(id) {
    const resp = await fetch(API_BASE + `/api/notifications/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    return parseJsonResponse(resp);
  },

  async clearAllNotifications() {
    const resp = await fetch(API_BASE + '/api/notifications', {
      method: 'DELETE',
      credentials: 'include'
    });
    return parseJsonResponse(resp);
  },

  async markAllNotificationsRead() {
    const resp = await fetch(API_BASE + '/api/notifications/mark-all-read', {
      method: 'POST',
      credentials: 'include'
    });
    return parseJsonResponse(resp);
  },

  async getShopItems() {
    const resp = await fetch(API_BASE + '/api/shop/items', { credentials: 'include' });
    return parseJsonResponse(resp);
  },

  async getShopMe() {
    const resp = await fetch(API_BASE + '/api/shop/me', { credentials: 'include' });
    return parseJsonResponse(resp);
  },

  async redeem(itemId) {
    const idempotencyKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const resp = await fetch(API_BASE + '/api/shop/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': idempotencyKey
      },
      credentials: 'include',
      body: JSON.stringify({ itemId })
    });
    return parseJsonResponse(resp);
  }
};
