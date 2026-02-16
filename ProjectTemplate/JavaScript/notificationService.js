/* JavaScript/notificationService.js
   Frontend-only notification system using localStorage + BroadcastChannel
*/

(function () {
  const STORAGE_KEY = "scrumSquad_notifications_v1";
  const MAX_ITEMS = 50;
  const CHANNEL_NAME = "scrumSquad_notifications_channel";
  const SERVER_PREFIX = "srv_";
  const SERVER_POLL_MS = 10000;

  const bc =
    "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;

  function nowISO() {
    return new Date().toISOString();
  }

  function uid() {
    return (
      "n_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16)
    );
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveAll(items) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_ITEMS)),
    );
  }

  function isServerItem(item) {
    return !!(item && typeof item.id === "string" && item.id.startsWith(SERVER_PREFIX));
  }

  function mergeServerItems(serverItems) {
    const serverMapped = (serverItems || []).map((n) => ({
      id: SERVER_PREFIX + String(n.id),
      serverId: Number(n.id),
      ts: n.ts || nowISO(),
      title: n.title || "Notification",
      message: n.message || "",
      href: "feed.html",
      level: "info",
      read: !!n.read,
    }));
    saveAll(serverMapped.slice(0, MAX_ITEMS));
  }

  async function fetchServerNotifications() {
    try {
      const who = await fetch("/api/whoami", { credentials: "include" });
      const whoData = await who.json();
      if (!whoData.ok || !whoData.user) return;
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return;
      const list = await res.json();
      mergeServerItems(Array.isArray(list) ? list : []);
      renderAll();
    } catch {
      // keep local-only behavior if backend notifications are unavailable
    }
  }

  function add(item) {
    const items = loadAll();
    items.unshift(item);
    saveAll(items);
    broadcast({ type: "added", item });
    renderAll();
    toast(item);
  }

  function broadcast(payload) {
    if (bc) {
      bc.postMessage(payload);
    }
  }

  function countUnread(items) {
    return items.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // --- UI Mount (navbar bell + panel) ---
  function mountNavbar() {
    // One-time cleanup of legacy local notifications so the bell stays user-specific.
    saveAll(loadAll().filter((x) => isServerItem(x)));

    // Find navbar-links container on any page that has the navbar layout
    const links = document.querySelector(".navbar .navbar-links");
    if (!links) return;

    // Avoid double-mount
    if (document.getElementById("notifBellWrap")) return;

    const wrap = document.createElement("div");
    wrap.id = "notifBellWrap";
    wrap.className = "notif-bell-wrap";
    wrap.innerHTML = `
      <button class="notif-bell-btn" id="notifBellBtn" aria-label="Notifications" type="button">
        <span class="notif-bell-icon" aria-hidden="true">🔔</span>
        <span class="notif-badge" id="notifBadge" style="display:none;">0</span>
      </button>

      <div class="notif-panel" id="notifPanel" style="display:none;">
        <div class="notif-panel-header">
          <div class="notif-title">Notifications</div>
          <button class="notif-clear" id="notifClearBtn" type="button">Clear all</button>
        </div>
        <div class="notif-list" id="notifList"></div>
        <div class="notif-panel-footer">
          <button class="notif-markread" id="notifMarkReadBtn" type="button">Mark all read</button>
        </div>
      </div>
    `;

    // Put bell at the end of navbar-links
    links.appendChild(wrap);

    // Toggle panel
    const bellBtn = document.getElementById("notifBellBtn");
    const panel = document.getElementById("notifPanel");
    bellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = panel.style.display !== "none";
      panel.style.display = isOpen ? "none" : "block";
      if (!isOpen) {
        renderAll();
        fetchServerNotifications();
      }
    });

    // Click outside closes panel
    document.addEventListener("click", () => {
      const p = document.getElementById("notifPanel");
      if (p) p.style.display = "none";
    });

    // Prevent inner clicks from closing
    panel.addEventListener("click", (e) => e.stopPropagation());

    // Clear all
    document.getElementById("notifClearBtn").addEventListener("click", async () => {
      saveAll([]);
      try {
        await fetch("/api/notifications", {
          method: "DELETE",
          credentials: "include",
        });
      } catch {}
      broadcast({ type: "cleared" });
      renderAll();
    });

    // Mark all read
    document
      .getElementById("notifMarkReadBtn")
      .addEventListener("click", async () => {
        const items = loadAll().map((n) => ({ ...n, read: true }));
        saveAll(items);        
        try {
          await fetch("/api/notifications/mark-all-read", {
            method: "POST",
            credentials: "include",
          });
        } catch {}
        broadcast({ type: "markAllRead" });
        renderAll();
      });

    renderAll();
    fetchServerNotifications();
    setInterval(fetchServerNotifications, SERVER_POLL_MS);
  }

  function renderAll() {
    const items = loadAll();
    const badge = document.getElementById("notifBadge");
    const list = document.getElementById("notifList");

    if (badge) {
      const unread = countUnread(items);
      if (unread > 0) {
        badge.style.display = "inline-flex";
        badge.textContent = String(unread);
      } else {
        badge.style.display = "none";
      }
    }

    if (list) {
      if (!items.length) {
        list.innerHTML = `<div class="notif-empty">No notifications yet.</div>`;
        return;
      }

      list.innerHTML = items
        .slice(0, MAX_ITEMS)
        .map((n) => {
          const meta = `${new Date(n.ts).toLocaleString()}`;
          const title = escapeHtml(n.title || "Notification");
          const body = escapeHtml(n.message || "");
          const cls = n.read ? "notif-item" : "notif-item unread";
          const link = n.href
            ? `<a class="notif-link" href="${escapeHtml(n.href)}">Open</a>`
            : "";
          return `
            <div class="${cls}" data-id="${escapeHtml(n.id)}">
              <div class="notif-item-top">
                <div class="notif-item-title">${title}</div>
                <button class="notif-item-x" type="button" aria-label="Dismiss">✕</button>
              </div>
              <div class="notif-item-body">${body}</div>
              <div class="notif-item-meta">
                <span>${escapeHtml(meta)}</span>
                <div class="notif-actions">
                  ${link}
                  <button class="notif-readbtn" type="button">${n.read ? "Read" : "Mark read"}</button>
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      // Wire item buttons
      list.querySelectorAll(".notif-item").forEach((el) => {
        const id = el.getAttribute("data-id");

        // Dismiss
        el.querySelector(".notif-item-x").addEventListener("click", async () => {
          const target = loadAll().find((x) => x.id === id);
          if (target && isServerItem(target) && typeof target.serverId === "number") {
            try {
              await fetch(`/api/notifications/${target.serverId}`, {
                method: "DELETE",
                credentials: "include",
              });
            } catch {}
          }
          const items2 = loadAll().filter((x) => x.id !== id);
          saveAll(items2);
          broadcast({ type: "removed", id });
          renderAll();
        });

        // Mark read
        el.querySelector(".notif-readbtn").addEventListener("click", async () => {
          const target = loadAll().find((x) => x.id === id);
          if (target && isServerItem(target) && typeof target.serverId === "number") {
            try {
              await fetch(`/api/notifications/${target.serverId}/read`, {
                method: "POST",
                credentials: "include",
              });
            } catch {}
          }
          const items2 = loadAll().map((x) =>
            x.id === id ? { ...x, read: true } : x,
          );
          saveAll(items2);
          broadcast({ type: "markedRead", id });
          renderAll();
        });
      });
    }
  }

  // --- Toasts ---
  function toast(item) {
    // Don't spam on pages without body ready
    if (!document.body) return;

    // Create container once
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `
      <div class="toast-head">
        <div class="toast-title">${escapeHtml(item.title || "Notification")}</div>
        <button class="toast-x" type="button" aria-label="Dismiss">✕</button>
      </div>
      <div class="toast-msg">${escapeHtml(item.message || "")}</div>
    `;

    const dismiss = () => {
      node.classList.add("hide");
      setTimeout(() => node.remove(), 250);
    };

    const closeBtn = node.querySelector(".toast-x");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dismiss();
      });
    }

    // Click toast -> open link if provided
    if (item.href) {
      node.style.cursor = "pointer";
      node.addEventListener("click", () => {
        window.location.href = item.href;
      });
    }

    container.appendChild(node);

    // Auto-remove
    setTimeout(() => {
      dismiss();
    }, 3000);
  }

  // --- Public API ---
  window.NotificationService = {
    mountNavbar,

    notify({ title, message, href, level, persist } = {}) {
      const item = {
        id: uid(),
        ts: nowISO(),
        title: title || "Notification",
        message: message || "",
        href: href || "",
        level: level || "info",
        read: false,
      };
      if (persist) {
        add(item);
        return;
      }
      toast(item);
    },

    // explicit bell notification (rare; server notifications preferred)
    notifyBell({ title, message, href, level } = {}) {
      add({
        id: uid(),
        ts: nowISO(),
        title: title || "Notification",
        message: message || "",
        href: href || "",
        level: level || "info",
        read: false,
      });
    },

    // convenience helpers
    success(message, href = "") {
      this.notify({ title: "Success", message, href, level: "success" });
    },
    error(message, href = "") {
      this.notify({ title: "Error", message, href, level: "error" });
    },
    info(message, href = "") {
      this.notify({ title: "Update", message, href, level: "info" });
    },
  };

  // Sync between tabs/windows
  if (bc) {
    bc.onmessage = () => {
      renderAll();
    };
  }

  // Render on storage changes (fallback for browsers without BroadcastChannel)
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) renderAll();
  });

  // Auto-mount when DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    mountNavbar();
  });
})();
