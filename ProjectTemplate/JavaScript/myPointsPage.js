async function loadMyPointsPage() {
  const errEl = document.getElementById('pointsError');
  errEl.textContent = '';
  try {
    const data = await FeedbackService.getMyPoints();
    const rules = data.rules || { comment: 3, upvote: 2, like: 1 };
    const breakdown = data.breakdown || {};

    document.getElementById('pointsTotal').textContent = String(data.points || 0);
    document.getElementById('commentsPoints').textContent = String((breakdown.commentsReceived || 0) * rules.comment);
    document.getElementById('upvotesPoints').textContent = String((breakdown.upvotesReceived || 0) * rules.upvote);
    document.getElementById('likesPoints').textContent = String((breakdown.likesReceived || 0) * rules.like);
    document.getElementById('pointsRulesText').textContent = `Rules: +${rules.comment} comment, +${rules.upvote} upvote, +${rules.like} like (on your posts).`;
  } catch (err) {
    errEl.textContent = err.message || 'Please log in to view your points.';
  }
}

document.addEventListener('DOMContentLoaded', loadMyPointsPage);
