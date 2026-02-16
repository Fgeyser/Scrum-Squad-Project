(function () {
  function escapeHtml(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  let mounted = false;

  async function fetchItems() {
    if (!window.FeedbackService) return [];
    try {
      const data = await FeedbackService.getNotifications();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  }

  function ensurePanel() {
    const links = document.querySelector('.navbar .navbar-links');
    if (!links || document.getElementById('notifBellWrap')) return;

    const wrap = document.createElement('div');
    wrap.id = 'notifBellWrap';
    wrap.className = 'notif-bell-wrap';
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

    links.appendChild(wrap);

    const bell = document.getElementById('notifBellBtn');
    const panel = document.getElementById('notifPanel');

    bell.addEventListener('click', async (e) => {
      e.stopPropagation();
      const hidden = panel.style.display === 'none';
      panel.style.display = hidden ? 'block' : 'none';
      if (hidden) await render();
    });

    panel.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    document.getElementById('notifClearBtn').addEventListener('click', async () => {
      try {
        await FeedbackService.clearAllNotifications();
      } catch (err) {}
      await render();
    });

    document.getElementById('notifMarkReadBtn').addEventListener('click', async () => {
      try {
        await FeedbackService.markAllNotificationsRead();
      } catch (err) {}
      await render();
    });
  }

  async function render() {
    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');
    if (!badge || !list) return;

    const items = await fetchItems();
    const unread = items.filter(n => !n.read).length;

    if (unread > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = String(unread);
    } else {
      badge.style.display = 'none';
    }

    if (!items.length) {
      list.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
      return;
    }

    list.innerHTML = items.map((n) => `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${escapeHtml(n.id)}">
        <div class="notif-item-top">
          <div class="notif-item-title">${escapeHtml(n.title || 'Notification')}</div>
          <button class="notif-item-x" type="button" aria-label="Dismiss">✕</button>
        </div>
        <div class="notif-item-body">${escapeHtml(n.message || '')}</div>
        <div class="notif-item-meta">
          <span>${escapeHtml(new Date(n.ts).toLocaleString())}</span>
          <button class="notif-readbtn" type="button">${n.read ? 'Read' : 'Mark read'}</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.notif-item').forEach((node) => {
      const id = node.getAttribute('data-id');
      const close = node.querySelector('.notif-item-x');
      const mark = node.querySelector('.notif-readbtn');

      close.addEventListener('click', async () => {
        try {
          await FeedbackService.deleteNotification(id);
        } catch (err) {}
        await render();
      });

      mark.addEventListener('click', async () => {
        try {
          await FeedbackService.markNotificationRead(id);
        } catch (err) {}
        await render();
      });
    });
  }

  function info(message) {
    showToast('Update', message);
  }

  function success(message) {
    showToast('Success', message);
  }

  function error(message) {
    showToast('Error', message);
  }

  function showToast(title, message) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <button class="toast-close-btn" type="button" aria-label="Dismiss">✕</button>
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    `;
    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 200);
      });
    }

    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 250);
    }, 2600);
  }

  function mountNavbar() {
    if (mounted) return;
    mounted = true;
    ensurePanel();
    render();
    setInterval(render, 10000);
  }

  window.NotificationService = {
    mountNavbar,
    render,
    info,
    success,
    error
  };

  document.addEventListener('DOMContentLoaded', () => {
    mountNavbar();
  });
})();
