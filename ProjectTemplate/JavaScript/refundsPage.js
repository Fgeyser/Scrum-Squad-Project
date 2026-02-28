function renderRefundHistory(redemptions) {
  const hintEl = document.getElementById('refundHistoryHint');
  const listEl = document.getElementById('refundHistoryList');

  if (!Array.isArray(redemptions)) {
    hintEl.textContent = 'Log in to view your products.';
    listEl.innerHTML = '';
    return;
  }

  if (redemptions.length === 0) {
    hintEl.textContent = 'No redeemed products available for refund.';
    listEl.innerHTML = '';
    return;
  }

  hintEl.textContent = '';
  listEl.innerHTML = redemptions.map((redemption) => {
    const refunded = !!redemption.refunded;
    const ts = new Date(redemption.ts).toLocaleString();
    const refundedTs = redemption.refundedTs ? new Date(redemption.refundedTs).toLocaleString() : '';
    const refundNote = refunded ? `<div class="history-refunded">Refunded${refundedTs ? ' ' + refundedTs : ''}</div>` : '';
    const refundButton = refunded ? '' : `<button class="refund-btn" data-id="${redemption.id}" type="button">Refund</button>`;

    return `
      <article class="history-item${refunded ? ' history-item-refunded' : ''}">
        <div>
          <strong>${redemption.itemName}</strong>
          <div class="history-meta">${ts}${refundNote ? '<br/>' + refundNote : ''}</div>
        </div>
        <div class="history-cost">${redemption.cost} pts${refunded ? ' (refunded)' : ''}</div>
        ${refundButton}
      </article>
    `;
  }).join('');

  listEl.querySelectorAll('.refund-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const redemptionId = button.getAttribute('data-id');
      const statusEl = document.getElementById('refundStatus');

      try {
        const response = await FeedbackService.refund(redemptionId);
        await loadRefundsPage();
        if (window.SettingsPanel && window.SettingsPanel.render) {
          await window.SettingsPanel.render();
        }
        statusEl.textContent = `Refunded ${response.redemption.itemName}.`;
        if (window.NotificationService) {
          NotificationService.success(`Refunded ${response.redemption.itemName}.`);
        }
      } catch (err) {
        statusEl.textContent = err.message || 'Refund failed.';
        if (window.NotificationService) {
          NotificationService.error(err.message || 'Refund failed.');
        }
      }
    });
  });
}

async function loadRefundsPage() {
  const pointsEl = document.getElementById('refundPoints');
  const statusEl = document.getElementById('refundStatus');
  statusEl.textContent = '';

  try {
    const meData = await FeedbackService.getShopMe();
    pointsEl.textContent = String(meData.points || 0);
    renderRefundHistory(meData.redemptions || []);
  } catch (err) {
    pointsEl.textContent = '0';
    renderRefundHistory(null);
    statusEl.textContent = err.message || 'Unable to load your refunded products.';
  }
}

document.addEventListener('DOMContentLoaded', loadRefundsPage);
window.loadRefundsPage = loadRefundsPage;
