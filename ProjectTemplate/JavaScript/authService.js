// Handles login, signup, session, and logout
const AuthService = {
  async login(username, password) {
    const res = await fetch("http://localhost:8001/api/employeeLogin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password })
    });
    return await res.json();
  },
  async signup(username, password, displayName) {
    const res = await fetch("http://localhost:8001/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password, displayName })
    });
    return await res.json();
  },
  async whoami() {
    const res = await fetch("http://localhost:8001/api/whoami", {
      credentials: "include"
    });
    return await res.json();
  },
  async logout() {
    const res = await fetch("http://localhost:8001/api/logout", {
      method: "POST",
      credentials: "include"
    });
    return await res.json();
  }
};
