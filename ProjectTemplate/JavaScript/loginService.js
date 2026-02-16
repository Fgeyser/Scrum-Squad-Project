const API_BASE = 'http://localhost:8001';

async function loginSubmit(event) {
  event.preventDefault();
  const msgEl = document.getElementById('loginMessage');
  msgEl.textContent = '';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const resp = await fetch(API_BASE + '/api/employeeLogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });

    const data = await resp.json();
    if (!resp.ok) {
      msgEl.textContent = data && data.message ? data.message : 'Login failed';
      return;
    }

    if (data.ok) {
      // redirect to feed after successful login
      window.location.href = 'feed.html';
    } else {
      msgEl.textContent = data.message || 'Login failed';
    }
  } catch (err) {
    console.error('Login error', err);
    msgEl.textContent = 'Unable to reach the login service.';
  }
}

function showSignup() {
  document.getElementById('signupSection').style.display = 'block';
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('loginMessage').textContent = '';
}

function showLogin() {
  document.getElementById('signupSection').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('signupMessage').textContent = '';
}

async function signupSubmit(event) {
  event.preventDefault();
  const msgEl = document.getElementById('signupMessage');
  msgEl.textContent = '';

  const display = document.getElementById('signup_display').value.trim();
  const username = document.getElementById('signup_username').value.trim();
  const password = document.getElementById('signup_password').value;
  const confirm = document.getElementById('signup_password_confirm').value;

  if (!username || !password) {
    msgEl.textContent = 'Please provide username and password';
    return;
  }
  if (password !== confirm) {
    msgEl.textContent = 'Passwords do not match';
    return;
  }

  try {
    const resp = await fetch(API_BASE + '/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName: display }),
      credentials: 'include'
    });
    const data = await resp.json();
    if (!resp.ok) {
      msgEl.textContent = data && data.message ? data.message : 'Signup failed';
      return;
    }
    if (data.ok) {
      // After signup, redirect to feed
      window.location.href = 'feed.html';
    } else {
      msgEl.textContent = data.message || 'Signup failed';
    }
  } catch (err) {
    console.error('Signup error', err);
    msgEl.textContent = 'Unable to reach the signup service.';
  }
}
