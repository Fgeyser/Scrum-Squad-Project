let feedbackList = [];
let currentSort = 'recent';
let currentUser = null;

function setPointsHeader(pointsData) {
  const pointsEl = document.getElementById('pointsValue');
  const pointsRulesEl = document.getElementById('pointsRules');
  if (!pointsEl || !pointsRulesEl) return;

  if (!pointsData) {
    pointsEl.textContent = '0';
    pointsRulesEl.textContent = `On your posts: +3 comment, +2 upvote, +1 like`;
    return;
  }

  pointsEl.textContent = String(pointsData.points || 0);
  const rules = pointsData.rules || { comment: 3, upvote: 2, like: 1 };
  pointsRulesEl.textContent = `On your posts: +${rules.comment} comment, +${rules.upvote} upvote, +${rules.like} like`;
}

function getSortedFeedback() {
  const list = [...feedbackList];
  if (currentSort === 'upvotes') return list.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
  if (currentSort === 'date') return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function render() {
  const feed = document.getElementById('feedList');
  renderFeed(feed, getSortedFeedback(), {
    onUpvote: handleUpvote,
    onLike: handleLike,
    onComment: handleComment,
    onLoadComments: loadComments,
    onLoadUpdates: loadUpdates
  }, currentUser);
}

function changeSort() {
  currentSort = document.getElementById('sortSelect').value;
  render();
}

async function refreshPoints() {
  if (!currentUser) {
    setPointsHeader(null);
    return;
  }
  try {
    const points = await FeedbackService.getMyPoints();
    setPointsHeader(points);
  } catch (err) {
    setPointsHeader(null);
  }
}

async function loadFeed() {
  feedbackList = await FeedbackService.getAll();
  render();
}

async function handleUpvote(id) {
  try {
    await FeedbackService.toggleUpvote(id);
    await Promise.all([loadFeed(), refreshPoints()]);
    if (window.NotificationService) NotificationService.success('Upvote saved!');
  } catch (err) {
    if (window.NotificationService) NotificationService.error(err.message || 'Could not save upvote.');
  }
}

async function handleLike(id) {
  try {
    await FeedbackService.toggleLike(id);
    await Promise.all([loadFeed(), refreshPoints()]);
    if (window.NotificationService) NotificationService.success('Like saved!');
  } catch (err) {
    if (window.NotificationService) NotificationService.error(err.message || 'Could not save like.');
  }
}

async function loadComments(id) {
  try {
    return await FeedbackService.getComments(id);
  } catch (err) {
    return [];
  }
}

async function handleComment(id, text) {
  try {
    await FeedbackService.addComment(id, text);
    await Promise.all([loadFeed(), refreshPoints()]);
    if (window.NotificationService) NotificationService.success('Comment posted!');
  } catch (err) {
    if (window.NotificationService) NotificationService.error(err.message || 'Could not post comment.');
  }
}

async function loadUpdates(id) {
  try {
    return await FeedbackService.getUpdates(id);
  } catch (err) {
    return [];
  }
}

async function submitFeedback() {
  const issue = document.getElementById('issue').value.trim();
  const impact = document.getElementById('impact').value.trim();
  const suggestion = document.getElementById('suggestion').value.trim();
  const theme = document.getElementById('theme').value;

  if (!issue || !impact || !suggestion) {
    if (window.NotificationService) NotificationService.error('Please fill issue, impact and suggestion.');
    return;
  }

  try {
    await FeedbackService.create({ issue, impact, suggestion, theme });
    closeModal();
    document.getElementById('issue').value = '';
    document.getElementById('impact').value = '';
    document.getElementById('suggestion').value = '';
    await Promise.all([loadFeed(), refreshPoints()]);
    if (window.NotificationService) NotificationService.success('Feedback posted!');
  } catch (err) {
    if (window.NotificationService) NotificationService.error(err.message || 'Could not post feedback.');
  }
}

function openModal() {
  document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

async function initFeed() {
  try {
    const who = await FeedbackService.whoami();
    currentUser = who.ok ? who.user : null;
  } catch (err) {
    currentUser = null;
  }

  if (window.NotificationService) {
    if (currentUser) {
      NotificationService.info(`Welcome back, ${currentUser.displayName || currentUser.username || 'User'}.`);
    } else {
      NotificationService.info('Viewing feed as guest. Log in to interact more.');
    }
  }

  await Promise.all([loadFeed(), refreshPoints()]);
  if (window.NotificationService) NotificationService.render();
}

document.addEventListener('DOMContentLoaded', initFeed);
window.changeSort = changeSort;
window.openModal = openModal;
window.closeModal = closeModal;
window.submitFeedback = submitFeedback;
