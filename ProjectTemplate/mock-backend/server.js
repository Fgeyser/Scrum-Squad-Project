const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;
const POINTS_RULES = {
  upvote: 2,
  like: 1,
  comment: 3
};
const SHOP_ITEMS = [
  { id: 'merch-tshirt', name: 'Scrum Squad T-Shirt', cost: 5, image: '/shopItems/shirt.webp' },
  { id: 'merch-hat', name: 'Scrum Squad Hat', cost: 8, image: '/shopItems/hat.webp' },
  { id: 'merch-shoes', name: 'Team Sneakers', cost: 10, image: '/shopItems/sneaker.jpg' },
  { id: 'home-toaster', name: 'Toaster', cost: 12, image: '/shopItems/Toaster.jpg' },
  { id: 'tech-headphones', name: 'Headphones', cost: 20, image: '/shopItems/Headphones.jpg' },
  { id: 'book-fiction', name: 'Fiction Book Bundle', cost: 7, image: '/shopItems/Books.jpg' },
  { id: 'merch-bottle', name: 'Scrum Squad Bottle', cost: 6, image: '/shopItems/bottle.jpg' },
  { id: 'desk-mousepad', name: 'Desk Mousepad', cost: 4, image: '/shopItems/mousePad.jpeg' }
];

// Serve the ProjectTemplate static files (one level up)
const staticRoot = path.join(__dirname, '..');
app.use(express.static(staticRoot));
app.use('/ProjectTemplate', express.static(staticRoot));

app.use(bodyParser.json());
app.use(cors({ origin: true, credentials: true }));
app.use(session({
  secret: 'scrum-squad-demo-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Load users from disk so signups persist across restarts
const usersFile = path.join(__dirname, 'users.json');
let demoUsers = [];
try {
  const raw = fs.readFileSync(usersFile, 'utf8');
  demoUsers = JSON.parse(raw);
} catch (e) {
  // If file missing or invalid, seed defaults and write file
  demoUsers = [
    { username: 'employee1', password: 'password123', displayName: 'Employee One', isAdmin: true },
    { username: 'alice', password: 'alicepass', displayName: 'Alice Example', isAdmin: false }
  ];
  try { fs.writeFileSync(usersFile, JSON.stringify(demoUsers, null, 2)); } catch (e) { /* ignore */ }
}

// Ensure each user has a publicId (non-identifying handle) so UI doesn't expose usernames
function generatePublicId() {
  return 'user-' + Math.random().toString(36).slice(2, 8);
}

let usersChanged = false;
demoUsers.forEach(u => {
  if (!u.publicId) { u.publicId = generatePublicId(); usersChanged = true; }
  if (typeof u.points !== 'number') { u.points = 0; usersChanged = true; }
  if (typeof u.earnedPoints !== 'number') { u.earnedPoints = u.points || 0; usersChanged = true; }
  if (typeof u.spentPoints !== 'number') { u.spentPoints = 0; usersChanged = true; }
});
if (usersChanged) saveUsers();

function saveUsers() {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(demoUsers, null, 2));
  } catch (e) {
    console.error('Failed to save users.json', e);
  }
}

function getStoredUserByUsername(username) {
  return demoUsers.find(u => u.username === username);
}

function getUserDisplayNameByPublicId(publicId) {
  const user = demoUsers.find(u => u.publicId === publicId);
  if (!user) return '';
  return user.displayName || user.username || '';
}

function getCurrentStoredUser(req) {
  if (!req.session || !req.session.user || !req.session.user.username) return null;
  return getStoredUserByUsername(req.session.user.username) || null;
}

function updateSessionFromStoredUser(req, storedUser) {
  if (!req.session || !storedUser) return;
  req.session.user = {
    publicId: storedUser.publicId,
    displayName: storedUser.displayName,
    username: storedUser.username,
    isAdmin: !!(storedUser.isAdmin || storedUser.role === 'admin'),
    points: storedUser.points || 0,
    earnedPoints: storedUser.earnedPoints || 0,
    spentPoints: storedUser.spentPoints || 0
  };
}

function refreshSessionPoints(req) {
  const storedUser = getCurrentStoredUser(req);
  if (storedUser) updateSessionFromStoredUser(req, storedUser);
}

function buildRequestContext(req) {
  const sessionUser = req.session && req.session.user ? req.session.user : null;
  return {
    method: req.method,
    path: req.path,
    user: sessionUser ? sessionUser.username : null,
    publicId: sessionUser ? sessionUser.publicId : null,
    ip: req.ip
  };
}

function logInfo(event, req, details = {}) {
  console.log(JSON.stringify({ level: 'info', event, ...buildRequestContext(req), ...details }));
}

function logWarn(event, req, details = {}) {
  console.warn(JSON.stringify({ level: 'warn', event, ...buildRequestContext(req), ...details }));
}

function logError(event, err, req, details = {}) {
  console.error(JSON.stringify({
    level: 'error',
    event,
    ...buildRequestContext(req),
    ...details,
    message: err && err.message ? err.message : String(err),
    stack: err && err.stack ? err.stack : ''
  }));
}

function requireAuth(req, res, next) {
  const storedUser = getCurrentStoredUser(req);
  if (!storedUser || !storedUser.publicId) {
    logWarn('auth_required', req);
    return res.status(401).json({ ok: false, message: 'Please log in.' });
  }
  updateSessionFromStoredUser(req, storedUser);
  req.storedUser = storedUser;
  next();
}

function requireAdmin(req, res, next) {
  const storedUser = getCurrentStoredUser(req);
  if (!storedUser || !storedUser.publicId) {
    logWarn('admin_auth_required', req);
    return res.status(401).json({ ok: false, message: 'Please log in.' });
  }
  if (!(storedUser.isAdmin || storedUser.role === 'admin')) {
    logWarn('admin_forbidden', req);
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }
  updateSessionFromStoredUser(req, storedUser);
  req.storedUser = storedUser;
  next();
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

// Feedback storage (persist to disk for demo)
const feedbackFile = path.join(__dirname, 'feedback.json');
let feedbackList = [];
try {
  const raw = fs.readFileSync(feedbackFile, 'utf8');
  feedbackList = JSON.parse(raw);
} catch (e) {
  feedbackList = [];
  try { fs.writeFileSync(feedbackFile, JSON.stringify(feedbackList, null, 2)); } catch (e) { /* ignore */ }
}

function saveFeedback() {
  try {
    fs.writeFileSync(feedbackFile, JSON.stringify(feedbackList, null, 2));
  } catch (e) {
    console.error('Failed to save feedback.json', e);
  }
}

// Updates storage (persist to disk for demo)
const updatesFile = path.join(__dirname, 'updates.json');
let updatesList = [];
try {
  const raw = fs.readFileSync(updatesFile, 'utf8');
  updatesList = JSON.parse(raw);
} catch (e) {
  updatesList = [];
  try { fs.writeFileSync(updatesFile, JSON.stringify(updatesList, null, 2)); } catch (e) { /* ignore */ }
}

function saveUpdates() {
  try {
    fs.writeFileSync(updatesFile, JSON.stringify(updatesList, null, 2));
  } catch (e) {
    console.error('Failed to save updates.json', e);
  }
}

// Comments storage (persist to disk for demo)
const commentsFile = path.join(__dirname, 'comments.json');
let commentsList = [];
try {
  const raw = fs.readFileSync(commentsFile, 'utf8');
  commentsList = JSON.parse(raw);
} catch (e) {
  commentsList = [];
  try { fs.writeFileSync(commentsFile, JSON.stringify(commentsList, null, 2)); } catch (e) { /* ignore */ }
}

function saveComments() {
  try {
    fs.writeFileSync(commentsFile, JSON.stringify(commentsList, null, 2));
  } catch (e) {
    console.error('Failed to save comments.json', e);
  }
}

function getPointsBreakdownForUser(publicId) {
  let likesReceived = 0;
  let upvotesReceived = 0;
  let commentsReceived = 0;

  feedbackList.forEach(post => {
    if (post.author !== publicId) return;
    const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
    const upvotedBy = Array.isArray(post.upvotedBy) ? post.upvotedBy : [];
    likesReceived += likedBy.filter(id => id && id !== publicId).length;
    upvotesReceived += upvotedBy.filter(id => id && id !== publicId).length;
  });

  commentsList.forEach(comment => {
    const post = feedbackList.find(p => Number(p.id) === Number(comment.postId));
    if (!post || post.author !== publicId) return;
    if (comment.authorPublicId && comment.authorPublicId !== publicId) commentsReceived += 1;
  });

  const earnedPoints =
    likesReceived * POINTS_RULES.like +
    upvotesReceived * POINTS_RULES.upvote +
    commentsReceived * POINTS_RULES.comment;

  return { earnedPoints, likesReceived, upvotesReceived, commentsReceived };
}

function recalculateAllUserPoints() {
  demoUsers.forEach(user => {
    const breakdown = getPointsBreakdownForUser(user.publicId);
    user.earnedPoints = breakdown.earnedPoints;
    const spent = user.spentPoints || 0;
    user.points = Math.max(0, (user.earnedPoints || 0) - spent);
  });
  saveUsers();
}

// Notifications storage (persist to disk for demo)
const notificationsFile = path.join(__dirname, 'notifications.json');
let notificationsList = [];
try {
  const raw = fs.readFileSync(notificationsFile, 'utf8');
  notificationsList = JSON.parse(raw);
} catch (e) {
  notificationsList = [];
  try { fs.writeFileSync(notificationsFile, JSON.stringify(notificationsList, null, 2)); } catch (e) { /* ignore */ }
}

function saveNotifications() {
  try {
    fs.writeFileSync(notificationsFile, JSON.stringify(notificationsList, null, 2));
  } catch (e) {
    console.error('Failed to save notifications.json', e);
  }
}

// Redemption storage (persist to disk for demo)
const redemptionsFile = path.join(__dirname, 'redemptions.json');
let redemptionsList = [];
try {
  const raw = fs.readFileSync(redemptionsFile, 'utf8');
  redemptionsList = JSON.parse(raw);
} catch (e) {
  redemptionsList = [];
  try { fs.writeFileSync(redemptionsFile, JSON.stringify(redemptionsList, null, 2)); } catch (e) { /* ignore */ }
}

function saveRedemptions() {
  try {
    fs.writeFileSync(redemptionsFile, JSON.stringify(redemptionsList, null, 2));
  } catch (e) {
    console.error('Failed to save redemptions.json', e);
  }
}

// Simple in-memory lock queue keyed by resource (user) for transaction safety.
const lockQueues = new Map();
async function withLock(lockKey, operation) {
  const prev = lockQueues.get(lockKey) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  lockQueues.set(lockKey, prev.then(() => current));
  await prev;
  try {
    return await operation();
  } finally {
    release();
    if (lockQueues.get(lockKey) === current) lockQueues.delete(lockKey);
  }
}

// Idempotency cache for redemption retries/double-clicks.
const redemptionIdempotency = new Map();
function idempotencyKeyFor(req) {
  const token = req.get('x-idempotency-key');
  if (!token || !req.storedUser) return null;
  return `${req.storedUser.publicId}:${token}`;
}

function readIdempotentRedemption(req) {
  const key = idempotencyKeyFor(req);
  if (!key) return null;
  const entry = redemptionIdempotency.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > 10 * 60 * 1000) {
    redemptionIdempotency.delete(key);
    return null;
  }
  return entry.response;
}

function writeIdempotentRedemption(req, response) {
  const key = idempotencyKeyFor(req);
  if (!key) return;
  redemptionIdempotency.set(key, { ts: Date.now(), response });
}

function createInteractionNotification(req, post, kind) {
  if (!req.session || !req.session.user || !post) return;
  const actorPublicId = req.session.user.publicId;
  const actorName = req.session.user.displayName || 'A coworker';
  const targetPublicId = post.author;
  if (!targetPublicId || targetPublicId === 'anonymous') return;
  if (actorPublicId === targetPublicId) return;

  const actionWord = kind === 'comment' ? 'commented on' : (kind === 'upvote' ? 'upvoted' : 'liked');
  const notification = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    userPublicId: targetPublicId,
    postId: post.id,
    type: kind,
    title: 'New interaction',
    message: `${actorName} ${actionWord} your post "${post.issue}".`,
    ts: new Date().toISOString(),
    read: false
  };
  notificationsList.unshift(notification);
  // keep latest 300 notifications max
  notificationsList = notificationsList.slice(0, 300);
  saveNotifications();
}

function createCommentThreadNotifications(req, post) {
  if (!req.session || !req.session.user || !post) return;
  const actorPublicId = req.session.user.publicId;
  const actorName = req.session.user.displayName || 'A coworker';
  const postId = Number(post.id);

  const participantIds = new Set(
    commentsList
      .filter(c => Number(c.postId) === postId)
      .map(c => c.authorPublicId)
      .filter(Boolean)
  );

  participantIds.forEach(userPublicId => {
    if (userPublicId === actorPublicId) return;
    // Post owner already gets "your post" notification.
    if (userPublicId === post.author) return;
    notificationsList.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      userPublicId,
      postId: post.id,
      type: 'comment-reply',
      title: 'New reply',
      message: `${actorName} replied on a post you commented on: "${post.issue}".`,
      ts: new Date().toISOString(),
      read: false
    });
  });

  notificationsList = notificationsList.slice(0, 300);
  saveNotifications();
}

// Keep persisted user points aligned with received interactions on their posts.
recalculateAllUserPoints();

function mapFeedbackItemForViewer(item, req) {
  const viewerPublicId = req.session && req.session.user ? req.session.user.publicId : null;
  const upvotedBy = Array.isArray(item.upvotedBy) ? item.upvotedBy : [];
  const likedBy = Array.isArray(item.likedBy) ? item.likedBy : [];
  const postComments = commentsList
    .filter(c => Number(c.postId) === Number(item.id))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const commentsCount = postComments.length;
  const latestComment = commentsCount ? postComments[commentsCount - 1] : null;
  return {
    ...item,
    authorDisplayName: getUserDisplayNameByPublicId(item.author),
    upvotes: item.upvotes || 0,
    likes: item.likes || 0,
    commentsCount,
    latestCommentAuthor: latestComment ? latestComment.author : '',
    latestCommentText: latestComment ? latestComment.text : '',
    viewerHasUpvoted: !!(viewerPublicId && upvotedBy.includes(viewerPublicId)),
    viewerHasLiked: !!(viewerPublicId && likedBy.includes(viewerPublicId)),
    upvotedBy: undefined,
    likedBy: undefined
  };
}

app.post('/api/employeeLogin', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'Missing username or password' });
  }

  const user = demoUsers.find(u => u.username === username && u.password === password);
  if (!user) {
    logWarn('login_failed', req, { attemptedUser: username });
    return res.status(401).json({ ok: false, message: 'Invalid credentials' });
  }

  // Recalculate user points based on current feedback/comments before login
  recalculateAllUserPoints();
  
  // Get fresh user data after recalculation
  const freshUser = demoUsers.find(u => u.username === username);
  
  // store minimal user in session
  // do NOT expose internal username to the frontend; use a publicId and a display name
  req.session.user = {
    publicId: freshUser.publicId,
    displayName: freshUser.displayName,
    username: freshUser.username,
    isAdmin: !!(freshUser.isAdmin || freshUser.role === 'admin'),
    points: freshUser.points || 0,
    earnedPoints: freshUser.earnedPoints || 0,
    spentPoints: freshUser.spentPoints || 0
  };
  logInfo('login_success', req, { username: freshUser.username });
  res.json({ ok: true, user: req.session.user });
});

// Sign up new user (persists to users.json)
app.post('/api/signup', (req, res) => {
  const { username, password, displayName } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, message: 'Missing username or password' });
  if (typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ ok: false, message: 'Invalid input' });
  if (password.length < 6) return res.status(400).json({ ok: false, message: 'Password must be at least 6 characters' });

  // check uniqueness
  const exists = demoUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    logWarn('signup_conflict', req, { attemptedUser: username });
    return res.status(409).json({ ok: false, message: 'Username already taken' });
  }

  const user = { username: username, password: password, displayName: displayName || username, publicId: generatePublicId(), isAdmin: false, points: 0, earnedPoints: 0, spentPoints: 0 };
  demoUsers.push(user);
  saveUsers();

  // set session to a non-identifying profile
  req.session.user = { publicId: user.publicId, displayName: user.displayName, username: user.username, isAdmin: false, points: 0, earnedPoints: 0, spentPoints: 0 };
  logInfo('signup_success', req, { username: user.username });
  res.json({ ok: true, user: req.session.user });
});

// Feedback API
// GET /api/feedback - returns all feedback
app.get('/api/feedback', (req, res) => {
  // return newest-first like the UI expects
  const sorted = feedbackList.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sorted.map(item => mapFeedbackItemForViewer(item, req)));
});

// POST /api/feedback - create new feedback
app.post('/api/feedback', (req, res) => {
  const { issue, impact, suggestion, theme } = req.body || {};
  if (!issue || !impact) return res.status(400).json({ ok: false, message: 'Missing fields' });

  const id = Date.now();
  const createdAt = new Date().toISOString();
  // Use the publicId stored in session (non-identifying) as the author
  const author = (req.session && req.session.user && req.session.user.publicId) || 'anonymous';

  const item = {
    id,
    issue,
    impact,
    suggestion: suggestion || '',
    theme: theme || 'Other',
    createdAt,
    upvotes: 0,
    likes: 0,
    upvotedBy: [],
    likedBy: [],
    author
  };

  feedbackList.unshift(item);
  saveFeedback();
  res.json({ ok: true, item });
});

// POST /api/feedback/:id/upvote - toggle upvote
app.post('/api/feedback/:id/upvote', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const viewerPublicId = req.session.user.publicId;
  const idx = feedbackList.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, message: 'Not found' });

  feedbackList[idx].upvotedBy = Array.isArray(feedbackList[idx].upvotedBy) ? feedbackList[idx].upvotedBy : [];
  const existing = feedbackList[idx].upvotedBy.indexOf(viewerPublicId);

  let active = false;
  if (existing >= 0) {
    feedbackList[idx].upvotedBy.splice(existing, 1);
    feedbackList[idx].upvotes = Math.max(0, (feedbackList[idx].upvotes || 0) - 1);
  } else {
    feedbackList[idx].upvotedBy.push(viewerPublicId);
    feedbackList[idx].upvotes = (feedbackList[idx].upvotes || 0) + 1;
    createInteractionNotification(req, feedbackList[idx], 'upvote');
    active = true;
  }

  saveFeedback();
  recalculateAllUserPoints();
  refreshSessionPoints(req);
  const storedUser = getCurrentStoredUser(req);
  logInfo('upvote_toggled', req, { postId: id, active, upvotes: feedbackList[idx].upvotes });
  res.json({ ok: true, upvotes: feedbackList[idx].upvotes, active, points: storedUser ? (storedUser.points || 0) : 0 });
});

// POST /api/feedback/:id/like - toggle like
app.post('/api/feedback/:id/like', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const viewerPublicId = req.session.user.publicId;
  const idx = feedbackList.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, message: 'Not found' });

  feedbackList[idx].likedBy = Array.isArray(feedbackList[idx].likedBy) ? feedbackList[idx].likedBy : [];
  const existing = feedbackList[idx].likedBy.indexOf(viewerPublicId);

  let active = false;
  if (existing >= 0) {
    feedbackList[idx].likedBy.splice(existing, 1);
    feedbackList[idx].likes = Math.max(0, (feedbackList[idx].likes || 0) - 1);
  } else {
    feedbackList[idx].likedBy.push(viewerPublicId);
    feedbackList[idx].likes = (feedbackList[idx].likes || 0) + 1;
    createInteractionNotification(req, feedbackList[idx], 'like');
    active = true;
  }

  saveFeedback();
  recalculateAllUserPoints();
  refreshSessionPoints(req);
  const storedUser = getCurrentStoredUser(req);
  logInfo('like_toggled', req, { postId: id, active, likes: feedbackList[idx].likes });
  res.json({ ok: true, likes: feedbackList[idx].likes, active, points: storedUser ? (storedUser.points || 0) : 0 });
});

app.get('/api/feedback/:id/comments', (req, res) => {
  const id = Number(req.params.id);
  const results = commentsList
    .filter(c => Number(c.postId) === id)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(results);
});

app.post('/api/feedback/:id/comments', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { text } = req.body || {};
  const content = typeof text === 'string' ? text.trim() : '';
  if (!content) return res.status(400).json({ ok: false, message: 'Comment cannot be empty.' });
  const exists = feedbackList.some(f => Number(f.id) === id);
  if (!exists) return res.status(404).json({ ok: false, message: 'Feedback post not found.' });

  const comment = {
    id: Date.now(),
    postId: id,
    text: content,
    author: req.session.user.displayName || 'User',
    authorPublicId: req.session.user.publicId,
    timestamp: new Date().toISOString()
  };
  commentsList.push(comment);
  saveComments();
  const post = feedbackList.find(f => Number(f.id) === id);
  createInteractionNotification(req, post, 'comment');
  createCommentThreadNotifications(req, post);
  recalculateAllUserPoints();
  refreshSessionPoints(req);
  const storedUser = getCurrentStoredUser(req);
  logInfo('comment_created', req, { postId: id, commentId: comment.id });
  res.json({ ok: true, comment, points: storedUser ? (storedUser.points || 0) : 0 });
});

app.get('/api/notifications', requireAuth, (req, res) => {
  const me = req.session.user.publicId;
  const items = notificationsList
    .filter(n => n.userPublicId === me)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, 100);
  res.json(items);
});

app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const me = req.session.user.publicId;
  const idx = notificationsList.findIndex(n => Number(n.id) === id && n.userPublicId === me);
  if (idx === -1) return res.status(404).json({ ok: false, message: 'Notification not found' });
  notificationsList[idx].read = true;
  saveNotifications();
  res.json({ ok: true });
});

app.delete('/api/notifications/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const me = req.session.user.publicId;
  const before = notificationsList.length;
  notificationsList = notificationsList.filter(n => !(Number(n.id) === id && n.userPublicId === me));
  if (notificationsList.length === before) {
    return res.status(404).json({ ok: false, message: 'Notification not found' });
  }
  saveNotifications();
  res.json({ ok: true });
});

app.post('/api/notifications/mark-all-read', requireAuth, (req, res) => {
  const me = req.session.user.publicId;
  notificationsList = notificationsList.map(n => (n.userPublicId === me ? { ...n, read: true } : n));
  saveNotifications();
  res.json({ ok: true });
});

app.delete('/api/notifications', requireAuth, (req, res) => {
  const me = req.session.user.publicId;
  notificationsList = notificationsList.filter(n => n.userPublicId !== me);
  saveNotifications();
  res.json({ ok: true });
});

app.get('/api/whoami', (req, res) => {
  if (req.session && req.session.user) {
    // Recalculate all user points to ensure they're up-to-date
    recalculateAllUserPoints();
    
    // find stored user to expose admin flag and get fresh points
    const stored = demoUsers.find(u => u.username === req.session.user.username);
    const isAdmin = !!(stored && (stored.isAdmin || stored.role === 'admin'));
    const points = stored ? (stored.points || 0) : (req.session.user.points || 0);
    const earnedPoints = stored ? (stored.earnedPoints || 0) : (req.session.user.earnedPoints || 0);
    const spentPoints = stored ? (stored.spentPoints || 0) : (req.session.user.spentPoints || 0);
    
    // Update session with fresh values
    req.session.user = { ...req.session.user, isAdmin, points, earnedPoints, spentPoints };
    
    return res.json({ ok: true, user: { ...req.session.user, isAdmin, points, earnedPoints, spentPoints } });
  }
  res.json({ ok: false });
});

app.get('/api/my-points', requireAuth, (req, res) => {
  // Recalculate points to ensure fresh data
  recalculateAllUserPoints();
  refreshSessionPoints(req);
  
  const breakdown = getPointsBreakdownForUser(req.session.user.publicId);
  const stored = getCurrentStoredUser(req);
  const spentPoints = stored ? (stored.spentPoints || 0) : 0;
  const availablePoints = Math.max(0, (breakdown.earnedPoints || 0) - spentPoints);
  const rules = {
    like: POINTS_RULES.like,
    upvote: POINTS_RULES.upvote,
    comment: POINTS_RULES.comment
  };
  res.json({ ok: true, points: availablePoints, earnedPoints: breakdown.earnedPoints || 0, spentPoints, breakdown: { ...breakdown, points: availablePoints }, rules });
});

app.get('/api/shop/items', (req, res) => {
  res.json({ ok: true, items: SHOP_ITEMS });
});

app.get('/api/shop/me', requireAuth, (req, res) => {
  recalculateAllUserPoints();
  refreshSessionPoints(req);
  const stored = getCurrentStoredUser(req);
  const mine = redemptionsList
    .filter(r => r.userPublicId === req.session.user.publicId)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, 100)
    .map(r => ({
      ...r,
      refunded: !!r.refunded,
      refundedTs: r.refundedTs || null
    }));
  res.json({
    ok: true,
    points: stored ? (stored.points || 0) : 0,
    earnedPoints: stored ? (stored.earnedPoints || 0) : 0,
    spentPoints: stored ? (stored.spentPoints || 0) : 0,
    redemptions: mine
  });
});

app.post('/api/shop/redeem', requireAuth, asyncRoute(async (req, res) => {
  const prior = readIdempotentRedemption(req);
  if (prior) {
    logInfo('shop_redeem_idempotent_replay', req, { itemId: prior.redemption ? prior.redemption.itemId : null });
    return res.json(prior);
  }

  const { itemId } = req.body || {};
  const item = SHOP_ITEMS.find(x => x.id === itemId);
  if (!item) return res.status(404).json({ ok: false, message: 'Item not found.' });

  const lockKey = `redeem:${req.storedUser.publicId}`;
  const response = await withLock(lockKey, async () => {
    recalculateAllUserPoints();
    const stored = getCurrentStoredUser(req);
    if (!stored) return { status: 401, body: { ok: false, message: 'User not found.' } };
    if ((stored.points || 0) < item.cost) {
      logWarn('shop_redeem_insufficient_points', req, { itemId: item.id, cost: item.cost, points: stored.points || 0 });
      return { status: 400, body: { ok: false, message: 'Not enough points for this item.', points: stored.points || 0 } };
    }

    stored.spentPoints = (stored.spentPoints || 0) + item.cost;
    recalculateAllUserPoints();
    saveUsers();
    updateSessionFromStoredUser(req, stored);

    const redemption = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      userPublicId: stored.publicId,
      itemId: item.id,
      itemName: item.name,
      cost: item.cost,
      ts: new Date().toISOString(),
      refunded: false
    };
    redemptionsList.unshift(redemption);
    redemptionsList = redemptionsList.slice(0, 1000);
    saveRedemptions();
    logInfo('shop_redeem_success', req, { itemId: item.id, cost: item.cost, pointsAfter: stored.points || 0 });
    return {
      status: 200,
      body: {
        ok: true,
        redemption,
        points: stored.points || 0,
        spentPoints: stored.spentPoints || 0,
        earnedPoints: stored.earnedPoints || 0
      }
    };
  });

  if (response.body && response.body.ok) writeIdempotentRedemption(req, response.body);
  return res.status(response.status).json(response.body);
}));


// Refund endpoint for shop purchases
app.post('/api/shop/refund', requireAuth, asyncRoute(async (req, res) => {
  const { redemptionId } = req.body || {};
  if (!redemptionId) {
    return res.status(400).json({ ok: false, message: 'Missing redemptionId.' });
  }
  const normalizedRedemptionId = String(redemptionId);

  const lockKey = `refund:${req.storedUser.publicId}`;
  const response = await withLock(lockKey, async () => {
    recalculateAllUserPoints();
    const stored = getCurrentStoredUser(req);
    if (!stored) return { status: 401, body: { ok: false, message: 'User not found.' } };

    const idx = redemptionsList.findIndex(r => String(r.id) === normalizedRedemptionId && r.userPublicId === stored.publicId);
    if (idx === -1) {
      return { status: 404, body: { ok: false, message: 'Redemption not found.' } };
    }

    const redemption = redemptionsList[idx];
    if (redemption.refunded) {
      return { status: 400, body: { ok: false, message: 'Already refunded.' } };
    }

    // return spent points
    stored.spentPoints = Math.max(0, (stored.spentPoints || 0) - redemption.cost);
    recalculateAllUserPoints();
    saveUsers();
    updateSessionFromStoredUser(req, stored);

    redemption.refunded = true;
    redemption.refundedTs = new Date().toISOString();
    saveRedemptions();

    // create notification for user
    notificationsList.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      userPublicId: stored.publicId,
      type: 'refund',
      title: 'Shop refund',
      message: `Your purchase of "${redemption.itemName}" was refunded.`,
      ts: new Date().toISOString(),
      read: false
    });
    notificationsList = notificationsList.slice(0, 300);
    saveNotifications();

    logInfo('shop_refund_success', req, { redemptionId: redemption.id, cost: redemption.cost, pointsAfter: stored.points || 0 });

    return {
      status: 200,
      body: {
        ok: true,
        redemption,
        points: stored.points || 0,
        spentPoints: stored.spentPoints || 0,
        earnedPoints: stored.earnedPoints || 0
      }
    };
  });
  return res.status(response.status).json(response.body);
}));

// Aggregated report endpoint (admin-only)
app.get('/api/aggregated-report', requireAdmin, (req, res) => {

  const totalCount = feedbackList.length;

  const countsPerTheme = {};
  const countsPerDay = {};

  feedbackList.forEach(fb => {
    // Theme
    const theme = fb.theme || 'Other';
    countsPerTheme[theme] = (countsPerTheme[theme] || 0) + 1;

    // Day
    const day = new Date(fb.createdAt).toISOString().split('T')[0];
    countsPerDay[day] = (countsPerDay[day] || 0) + 1;
  });

  const countsPerThemeArray = Object.keys(countsPerTheme).map(key => ({ Key: key, Count: countsPerTheme[key] }));
  const countsPerDayArray = Object.keys(countsPerDay).map(key => ({ Key: key, Count: countsPerDay[key] }));

  res.json({
    TotalCount: totalCount,
    CountsPerTheme: countsPerThemeArray,
    CountsPerDay: countsPerDayArray
  });
});

  // Get updates for a specific feedback post
  app.get('/api/feedback/:id/updates', (req, res) => {
    const id = Number(req.params.id);
    // Re-read from disk to ensure we have latest data
    try {
      const raw = fs.readFileSync(updatesFile, 'utf8');
      const fresh = JSON.parse(raw);
      const results = fresh.filter(u => Number(u.postId) === id).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      res.json(results);
    } catch (e) {
      res.json([]);
    }
  });

  // Post an update to a feedback item (admin-only)
  app.post('/api/feedback/:id/update', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const { text, content } = req.body || {};
    const bodyContent = text || content;
    if (!bodyContent) return res.status(400).json({ ok: false, message: 'Missing content' });

    const update = {
      id: Date.now(),
      postId: id,
      content: bodyContent,
      authorRole: 'admin',
      timestamp: new Date().toISOString()
    };
    updatesList.unshift(update);
    saveUpdates();
    res.json({ ok: true, update });
  });

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      logError('logout_failed', err, req);
      return res.status(500).json({ ok: false, message: 'Failed to logout' });
    }
    logInfo('logout_success', req);
    res.json({ ok: true });
  });
});

app.use((err, req, res, next) => {
  logError('unhandled_route_error', err, req);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Mock backend running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}/login.html (also works: /ProjectTemplate/login.html)`);
});
