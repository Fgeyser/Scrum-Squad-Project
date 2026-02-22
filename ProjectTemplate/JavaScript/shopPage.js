function renderHistory(redemptions) {
  const hintEl = document.getElementById('shopHistoryHint');
  const listEl = document.getElementById('shopHistoryList');

  if (!Array.isArray(redemptions)) {
    hintEl.textContent = 'Log in to view redemption history.';
    listEl.innerHTML = '';
    return;
  }

  if (redemptions.length === 0) {
    hintEl.textContent = 'No products redeemed yet.';
    listEl.innerHTML = '';
    return;
  }

  hintEl.textContent = '';
  listEl.innerHTML = redemptions.map((r) => `
    <article class="history-item">
      <div>
        <strong>${r.itemName}</strong>
        <div class="history-meta">${new Date(r.ts).toLocaleString()}</div>
      </div>
      <div class="history-cost">${r.cost} pts</div>
    </article>
  `).join('');
}

async function loadShop() {
  const grid = document.getElementById('shopGrid');
  const pointsEl = document.getElementById('shopPoints');
  const statusEl = document.getElementById('shopStatus');

  statusEl.textContent = '';

  try {
    const itemsData = await FeedbackService.getShopItems();
    let meData = null;
    try {
      meData = await FeedbackService.getShopMe();
    } catch (err) {
      statusEl.textContent = 'Log in to add items to cart.';
      renderHistory(null);
    }

    const items = itemsData.items || [];
    const points = meData ? (meData.points || 0) : 0;
    pointsEl.textContent = String(points);
    if (meData) renderHistory(meData.redemptions || []);

    grid.innerHTML = items.map((item) => `
      <article class="shop-item" data-id="${item.id}" data-cost="${item.cost}">
        <img src="${item.image}" alt="${item.name}" class="shop-item-image" loading="lazy" />
        <div class="shop-item-body">
          <h3>${item.name}</h3>
          <p>${item.cost} points</p>
          <button class="primary-btn cart-add-btn" type="button">Add to Cart</button>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('.shop-item').forEach((card) => {
      const id = card.getAttribute('data-id');
      const cost = Number(card.getAttribute('data-cost')) || 0;
      const name = card.querySelector('h3').textContent;
      const btn = card.querySelector('.cart-add-btn');
      
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!meData) {
          statusEl.textContent = 'Please log in to add items to cart.';
          return;
        }

        // Add item to cart
        CartService.addItem(id, name, cost);
        statusEl.textContent = `Added ${name} to cart!`;
        if (window.NotificationService) {
          NotificationService.success(`Added ${name} to cart!`);
        }

        // Open the settings panel with cart visible
        const settingsCog = document.getElementById('settingsCogBtn');
        const settingsPanel = document.getElementById('settingsPanel');
        if (settingsCog && settingsPanel) {
          settingsPanel.style.display = 'block';
          if (window.SettingsPanel && window.SettingsPanel.render) {
            await window.SettingsPanel.render();
          }
        }
      });
    });
  } catch (err) {
    grid.innerHTML = '';
    renderHistory(null);
    statusEl.textContent = err.message || 'Unable to load shop items.';
  }
}

document.addEventListener('DOMContentLoaded', loadShop);
window.loadShop = loadShop;
