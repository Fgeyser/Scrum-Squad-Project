// Data access layer (local + API)
const LOCAL_STORAGE_KEY = "scrum_squad_feedback";
// Use same-origin API so any backend port works.
const API_BASE = (typeof window !== "undefined" && window.API_BASE) ? window.API_BASE : "";

// Local helpers

function loadLocalFeedback() {
  return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
}

function saveLocalFeedback(list) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
}

// Local upvote toggle

function toggleLocalUpvote(id) {
  const list = loadLocalFeedback();
  const post = list.find(p => p.id === id);
  if (!post) return;

  const voteKey = `upvoted_${id}`;

  if (localStorage.getItem(voteKey)) {
    post.upvotes = Math.max(0, post.upvotes - 1);
    localStorage.removeItem(voteKey);
  } else {
    post.upvotes++;
    localStorage.setItem(voteKey, "true");
  }

  saveLocalFeedback(list);
}

// Feedback Service

const FeedbackService = {

  // Get all feedback (API first, local fallback)
  async getAll() {
    try {
      const res = await fetch(API_BASE + "/api/feedback", { credentials: 'include' });
      if (!res.ok) throw new Error("API unavailable");
      return await res.json();
    } catch (err) {
      console.warn('Falling back to local feedback due to:', err && err.message);
      return loadLocalFeedback();
    }
  },

  // Create new feedback
  async create(feedback) {
    try {
      await fetch(API_BASE + "/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(feedback)
      });
    } catch (err) {
      console.warn('POST /api/feedback failed, falling back to local. Error:', err && err.message);
      const list = loadLocalFeedback();

      list.unshift({
        id: Date.now(),
        issue: feedback.issue,
        impact: feedback.impact,
        suggestion: feedback.suggestion,
        theme: feedback.theme || "Other",
        createdAt: new Date().toISOString(),
        upvotes: 0
      });

      saveLocalFeedback(list);
    }
  },

  // Toggle upvote / un-upvote
  async toggleUpvote(id) {
    try {
      const res = await fetch(API_BASE + `/api/feedback/${id}/upvote`, { method: "POST", credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not upvote");
      return data;
    } catch (err) {
      console.warn('Upvote API failed, using local toggle. Error:', err && err.message);
      toggleLocalUpvote(id);
      return { ok: true };
    }
  },

  async toggleLike(id) {
    const res = await fetch(API_BASE + `/api/feedback/${id}/like`, {
      method: "POST",
      credentials: "include"
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not like");
    return data;
  },

  async getComments(id) {
    const res = await fetch(API_BASE + `/api/feedback/${id}/comments`, {
      credentials: "include"
    });
    if (!res.ok) throw new Error("Could not load comments");
    return await res.json();
  },

  async addComment(id, text) {
    const res = await fetch(API_BASE + `/api/feedback/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not add comment");
    return data;
  },

  async getUpdates(id) {
    const res = await fetch(API_BASE + `/api/feedback/${id}/updates`, {
      credentials: "include"
    });
    if (!res.ok) throw new Error("Could not load updates");
    return await res.json();
  },

  async addUpdate(id, content) {
    const res = await fetch(API_BASE + `/api/feedback/${id}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not add update");
    return data;
  }
};
