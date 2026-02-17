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
      statusEl.textContent = 'Log in to redeem items.';
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
          <button class="primary-btn redeem-btn" type="button" ${!meData || points < item.cost ? 'disabled' : ''}>Redeem</button>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('.shop-item').forEach((card) => {
      const id = card.getAttribute('data-id');
      const cost = Number(card.getAttribute('data-cost')) || 0;
      const btn = card.querySelector('.redeem-btn');
      btn.addEventListener('click', async () => {
        if (!meData) {
          statusEl.textContent = 'Please log in to redeem.';
          return;
        }
        const available = Number(pointsEl.textContent) || 0;
        if (available < cost) {
          statusEl.textContent = "Can't redeem. Not enough points.";
          return;
        }

        btn.disabled = true;
        statusEl.textContent = '';
        try {
          const result = await FeedbackService.redeem(id);
          pointsEl.textContent = String(result.points || 0);
          statusEl.textContent = `Redeemed ${result.redemption.itemName} for ${result.redemption.cost} points.`;
          if (window.NotificationService) NotificationService.success(statusEl.textContent);
          await loadShop();
        } catch (err) {
          const msg = (err && err.message) ? err.message : '';
          statusEl.textContent = /enough points/i.test(msg)
            ? "Can't redeem. Not enough points."
            : (msg || 'Could not redeem this item.');
          btn.disabled = false;
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
