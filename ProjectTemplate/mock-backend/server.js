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
    points: storedUser.points || 0
  };
}

function awardPoints(req, type) {
  const storedUser = getCurrentStoredUser(req);
  const delta = POINTS_RULES[type] || 0;
  if (!storedUser || !delta) return null;
  storedUser.points = (storedUser.points || 0) + delta;
  saveUsers();
  updateSessionFromStoredUser(req, storedUser);
  return storedUser.points;
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

function mapFeedbackItemForViewer(item, req) {
  const viewerPublicId = req.session && req.session.user ? req.session.user.publicId : null;
  const upvotedBy = Array.isArray(item.upvotedBy) ? item.upvotedBy : [];
  const likedBy = Array.isArray(item.likedBy) ? item.likedBy : [];
  const commentsCount = commentsList.filter(c => Number(c.postId) === Number(item.id)).length;
  return {
    ...item,
    upvotes: item.upvotes || 0,
    likes: item.likes || 0,
    commentsCount,
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
    return res.status(401).json({ ok: false, message: 'Invalid credentials' });
  }

  // store minimal user in session
  // do NOT expose internal username to the frontend; use a publicId and a display name
  req.session.user = {
    publicId: user.publicId,
    displayName: user.displayName,
    username: user.username,
    isAdmin: !!(user.isAdmin || user.role === 'admin'),
    points: user.points || 0
  };
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
  if (exists) return res.status(409).json({ ok: false, message: 'Username already taken' });

  const user = { username: username, password: password, displayName: displayName || username, publicId: generatePublicId(), isAdmin: false, points: 0 };
  demoUsers.push(user);
  saveUsers();

  // set session to a non-identifying profile
  req.session.user = { publicId: user.publicId, displayName: user.displayName, username: user.username, isAdmin: false, points: 0 };
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
app.post('/api/feedback/:id/upvote', (req, res) => {
  if (!req.session || !req.session.user || !req.session.user.publicId) {
    return res.status(401).json({ ok: false, message: 'Please log in to upvote.' });
  }
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
    awardPoints(req, 'upvote');
    active = true;
  }

  const storedUser = getCurrentStoredUser(req);
  saveFeedback();
  res.json({ ok: true, upvotes: feedbackList[idx].upvotes, active, points: storedUser ? (storedUser.points || 0) : 0 });
});

// POST /api/feedback/:id/like - toggle like
app.post('/api/feedback/:id/like', (req, res) => {
  if (!req.session || !req.session.user || !req.session.user.publicId) {
    return res.status(401).json({ ok: false, message: 'Please log in to like.' });
  }
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
    awardPoints(req, 'like');
    active = true;
  }

  const storedUser = getCurrentStoredUser(req);
  saveFeedback();
  res.json({ ok: true, likes: feedbackList[idx].likes, active, points: storedUser ? (storedUser.points || 0) : 0 });
});

app.get('/api/feedback/:id/comments', (req, res) => {
  const id = Number(req.params.id);
  const results = commentsList
    .filter(c => Number(c.postId) === id)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(results);
});

app.post('/api/feedback/:id/comments', (req, res) => {
  if (!req.session || !req.session.user || !req.session.user.publicId) {
    return res.status(401).json({ ok: false, message: 'Please log in to comment.' });
  }
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
  awardPoints(req, 'comment');
  const storedUser = getCurrentStoredUser(req);
  res.json({ ok: true, comment, points: storedUser ? (storedUser.points || 0) : 0 });
});

app.get('/api/whoami', (req, res) => {
  if (req.session && req.session.user) {
    // find stored user to expose admin flag
    const stored = demoUsers.find(u => u.username === req.session.user.username);
    const isAdmin = !!(stored && (stored.isAdmin || stored.role === 'admin'));
    const points = stored ? (stored.points || 0) : (req.session.user.points || 0);
    return res.json({ ok: true, user: { ...req.session.user, isAdmin, points } });
  }
  res.json({ ok: false });
});

// Aggregated report endpoint (admin-only)
app.get('/api/aggregated-report', (req, res) => {
  if (!req.session || !req.session.user || !req.session.user.isAdmin) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

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
  app.post('/api/feedback/:id/update', (req, res) => {
    const id = Number(req.params.id);
    const { text, content } = req.body || {};
    const bodyContent = text || content;
    if (!bodyContent) return res.status(400).json({ ok: false, message: 'Missing content' });

    // check admin
    if (!req.session || !req.session.user || !req.session.user.isAdmin) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

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
    if (err) return res.status(500).json({ ok: false, message: 'Failed to logout' });
    res.json({ ok: true });
  });
});

app.listen(PORT, () => {
  console.log(`Mock backend running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}/login.html (also works: /ProjectTemplate/login.html)`);
});
