const API_BASE = window.API_BASE || 'http://localhost:8000';

function setMessage(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || '';
}

function showSignup() {
  document.getElementById('signupSection').style.display = 'block';
  document.getElementById('loginForm').style.display = 'none';
  setMessage('loginMessage', '');
}

function showLogin() {
  document.getElementById('signupSection').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  setMessage('signupMessage', '');
}

function showLoggedInView(user) {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('signupSection').style.display = 'none';
  document.getElementById('alreadyLoggedIn').style.display = 'block';
  document.getElementById('loginSubtitle').textContent = `Logged in as ${user.displayName || user.username || 'User'}`;
  document.getElementById('loggedInAs').textContent = `Logged in as ${user.displayName || user.username || 'User'}`;
}

async function loginSubmit(event) {
  event.preventDefault();
  setMessage('loginMessage', '');

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const resp = await fetch(API_BASE + '/api/employeeLogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      setMessage('loginMessage', (data && data.message) || 'Login failed');
      return;
    }

    showLoggedInView(data.user || {});
  } catch (err) {
    setMessage('loginMessage', 'Unable to reach the login service.');
  }
}

async function signupSubmit(event) {
  event.preventDefault();
  setMessage('signupMessage', '');

  const displayName = document.getElementById('signup_display').value.trim();
  const username = document.getElementById('signup_username').value.trim();
  const password = document.getElementById('signup_password').value;
  const confirm = document.getElementById('signup_password_confirm').value;

  if (password !== confirm) {
    setMessage('signupMessage', 'Passwords do not match.');
    return;
  }

  try {
    const resp = await fetch(API_BASE + '/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, displayName })
    });
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      setMessage('signupMessage', (data && data.message) || 'Signup failed');
      return;
    }

    showLoggedInView(data.user || {});
  } catch (err) {
    setMessage('signupMessage', 'Unable to reach the signup service.');
  }
}

async function checkSession() {
  try {
    const resp = await fetch(API_BASE + '/api/whoami', { credentials: 'include' });
    const data = await resp.json();
    if (data.ok && data.user) showLoggedInView(data.user);
  } catch (err) {
    // Ignore if backend is unavailable.
  }
}

async function logout() {
  try {
    await fetch(API_BASE + '/api/logout', { method: 'POST', credentials: 'include' });
  } finally {
    window.location.reload();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const goToFeedBtn = document.getElementById('goToFeedBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if (goToFeedBtn) goToFeedBtn.addEventListener('click', () => { window.location.href = 'feed.html'; });
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  checkSession();
});
