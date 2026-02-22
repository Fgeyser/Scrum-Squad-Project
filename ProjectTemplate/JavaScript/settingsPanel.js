// Settings Panel Service - Manages the cog wheel menu with My Points, Shopping Cart, and Theme toggle
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

  async function fetchMyPoints() {
    if (!window.FeedbackService) return null;
    try {
      const data = await FeedbackService.getMyPoints();
      return data;
    } catch (err) {
      return null;
    }
  }

  function ensureSettingsPanel() {
    const links = document.querySelector('.navbar .navbar-links');
    if (!links || document.getElementById('settingsCogWrap')) return;

    const wrap = document.createElement('div');
    wrap.id = 'settingsCogWrap';
    wrap.className = 'settings-cog-wrap';
    wrap.innerHTML = `
      <button class="settings-cog-btn" id="settingsCogBtn" aria-label="Settings" type="button">
        <span class="settings-cog-icon" aria-hidden="true">⚙️</span>
        <span class="cart-badge" id="cartBadge" style="display:none;">0</span>
      </button>
      <div class="settings-panel" id="settingsPanel" style="display:none;">
        <div class="settings-panel-header">
          <div class="settings-title">Settings</div>
        </div>
        <div class="settings-panel-content">
          <!-- My Points Section -->
          <div class="settings-section">
            <div class="settings-section-title">My Points</div>
            <div class="my-points-display" id="myPointsDisplay">
              <div class="points-info">
                <span class="points-label">Available:</span>
                <span class="points-value" id="settingsPointsValue">0</span>
              </div>
              <a href="myPoints.html" class="settings-link-btn">View Details</a>
            </div>
          </div>

          <!-- Shopping Cart Section -->
          <div class="settings-section">
            <div class="settings-section-title">Shopping Cart</div>
            <div class="shopping-cart-mini" id="shoppingCartMini">
              <div class="cart-list-mini" id="cartListMini"></div>
              <div class="cart-total-mini" id="cartTotalMini" style="display:none;">
                <div class="cart-total-label">Total Cost:</div>
                <div class="cart-total-value" id="cartTotalValue">0</div>
                <button class="cart-redeem-all-btn primary-btn" id="cartRedeemAllBtn" type="button">Redeem All</button>
              </div>
              <div class="cart-empty-mini" id="cartEmptyMini">Cart is empty</div>
            </div>
          </div>

          <!-- Theme Toggle Section -->
          <div class="settings-section">
            <div class="settings-section-title">Theme</div>
            <div class="theme-toggle-container">
              <button class="theme-toggle-btn" id="themeToggleBtn" type="button">
                <span class="theme-toggle-text" id="themeToggleText">Dark Mode</span>
                <span class="theme-toggle-switch" id="themeToggleSwitch">🌙</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    links.appendChild(wrap);

    const cog = document.getElementById('settingsCogBtn');
    const panel = document.getElementById('settingsPanel');
    const themeBtn = document.getElementById('themeToggleBtn');
    const redeemAllBtn = document.getElementById('cartRedeemAllBtn');

    // Toggle panel visibility
    cog.addEventListener('click', async (e) => {
      e.stopPropagation();
      const hidden = panel.style.display === 'none';
      panel.style.display = hidden ? 'block' : 'none';
      if (hidden) await renderSettingsPanel();
    });

    // Close panel when clicking outside
    panel.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Theme toggle
    themeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const newTheme = ThemeService.toggleTheme();
      updateThemeToggleUI(newTheme);
    });

    // Redeem all items
    redeemAllBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await redeemAllItems();
    });

    mounted = true;
  }

  function updateThemeToggleUI(theme) {
    const toggleIcon = document.getElementById('themeToggleSwitch');
    const toggleText = document.getElementById('themeToggleText');
    if (theme === 'light') {
      toggleIcon.textContent = '☀️';
      toggleText.textContent = 'Light Mode';
    } else {
      toggleIcon.textContent = '🌙';
      toggleText.textContent = 'Dark Mode';
    }
  }

  function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const count = CartService.getItemCount();
    if (count > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = String(count);
    } else {
      badge.style.display = 'none';
    }
  }

  async function renderCart() {
    const cartListMini = document.getElementById('cartListMini');
    const cartTotalMini = document.getElementById('cartTotalMini');
    const cartEmptyMini = document.getElementById('cartEmptyMini');
    const cartTotalValue = document.getElementById('cartTotalValue');

    const cart = CartService.getCart();
    const totalCost = CartService.getTotalCost();

    if (!cart.length) {
      cartListMini.innerHTML = '';
      cartEmptyMini.style.display = 'block';
      cartTotalMini.style.display = 'none';
      return;
    }

    cartEmptyMini.style.display = 'none';
    cartTotalMini.style.display = 'flex';
    cartTotalValue.textContent = String(totalCost);

    cartListMini.innerHTML = cart.map((item) => `
      <div class="cart-item-mini" data-id="${escapeHtml(item.id)}">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-price">${item.cost} pts each</div>
        </div>
        <div class="cart-item-controls">
          <input type="number" class="cart-qty-input" value="${item.quantity || 1}" min="1" data-id="${escapeHtml(item.id)}" />
          <button class="cart-remove-btn" data-id="${escapeHtml(item.id)}" type="button">✕</button>
        </div>
      </div>
    `).join('');

    // Add event listeners for quantity changes
    cartListMini.querySelectorAll('.cart-qty-input').forEach((input) => {
      input.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const qty = Math.max(1, parseInt(e.target.value) || 1);
        CartService.updateQuantity(id, qty);
      });
    });

    // Add event listeners for remove buttons
    cartListMini.querySelectorAll('.cart-remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-id');
        CartService.removeItem(id);
      });
    });
  }

  async function renderSettingsPanel() {
    // Update My Points
    const pointsDisplay = document.getElementById('myPointsDisplay');
    if (pointsDisplay) {
      try {
        const pointsData = await fetchMyPoints();
        if (pointsData) {
          const pointsValue = document.getElementById('settingsPointsValue');
          pointsValue.textContent = String(pointsData.points || 0);
        }
      } catch (err) {
        // Silently fail
      }
    }

    // Update Cart
    await renderCart();

    // Update theme toggle UI
    const currentTheme = ThemeService.getCurrentTheme();
    updateThemeToggleUI(currentTheme);
  }

  async function redeemAllItems() {
    const cart = CartService.getCart();
    if (!cart.length) return;

    const redeemBtn = document.getElementById('cartRedeemAllBtn');
    redeemBtn.disabled = true;

    try {
      // Get current user points
      const pointsData = await fetchMyPoints();
      const availablePoints = pointsData ? (pointsData.points || 0) : 0;
      const totalCost = CartService.getTotalCost();

      if (availablePoints < totalCost) {
        if (window.NotificationService) {
          NotificationService.error(`Not enough points. Need ${totalCost}, have ${availablePoints}.`);
        }
        redeemBtn.disabled = false;
        return;
      }

      // Redeem each item
      let failedItems = [];
      for (const item of cart) {
        for (let i = 0; i < (item.quantity || 1); i++) {
          try {
            await FeedbackService.redeem(item.id);
          } catch (err) {
            failedItems.push(item.name);
          }
        }
      }

      if (failedItems.length === 0) {
        CartService.clearCart();
        updateCartBadge();
        
        // Refresh points display
        try {
          const freshPoints = await fetchMyPoints();
          if (freshPoints) {
            const pointsValue = document.getElementById('settingsPointsValue');
            if (pointsValue) {
              pointsValue.textContent = String(freshPoints.points || 0);
            }
          }
        } catch (err) {
          // Silently fail
        }
        
        await renderSettingsPanel();
        if (window.NotificationService) {
          NotificationService.success('All items redeemed successfully!');
        }
        // Update shop page if it's loaded
        if (window.loadShop) {
          window.loadShop();
        }
      } else {
        if (window.NotificationService) {
          NotificationService.error(`Failed to redeem: ${failedItems.join(', ')}`);
        }
        redeemBtn.disabled = false;
      }
    } catch (err) {
      if (window.NotificationService) {
        NotificationService.error(err.message || 'Failed to redeem items');
      }
      redeemBtn.disabled = false;
    }
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    ensureSettingsPanel();
    updateCartBadge();
  });

  // Listen for cart updates
  window.addEventListener('cartUpdated', () => {
    updateCartBadge();
  });

  // Listen for theme changes and update UI
  window.addEventListener('themeChanged', (e) => {
    updateThemeToggleUI(e.detail.theme);
  });

  // Expose functions globally
  window.SettingsPanel = {
    render: renderSettingsPanel,
    redeemAll: redeemAllItems
  };
})();
