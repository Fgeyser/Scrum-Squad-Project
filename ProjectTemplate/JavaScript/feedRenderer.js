function renderEmptyState(container) {
  container.innerHTML = `
    <div class="feed-empty">
      <h2>No feedback yet</h2>
      <p>Be the first to share feedback.</p>
    </div>
  `;
}

function displayAuthor(post) {
  return post.authorDisplayName || 'Anonymous';
}

function renderComments(container, comments) {
  if (!comments.length) {
    container.innerHTML = '<div class="comment-empty">No comments yet.</div>';
    return;
  }

  container.innerHTML = comments.map((c) => `
    <div class="comment-item">
      <div class="comment-meta"><strong>${c.author || 'User'}</strong> ${new Date(c.timestamp).toLocaleString()}</div>
      <div class="comment-text">${c.text}</div>
    </div>
  `).join('');
}

function renderFeed(container, posts, handlers, currentUser) {
  container.innerHTML = '';

  if (!posts.length) {
    renderEmptyState(container);
    return;
  }

  posts.forEach((post) => {
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.dataset.id = post.id;

    item.innerHTML = `
      <div class="post-owner">${displayAuthor(post)}</div>
      <div class="feed-subject">${post.issue}</div>
      <div class="feed-text">
        <strong>Impact:</strong><br>${post.impact}<br><br>
        <strong>Suggestion:</strong><br>${post.suggestion || ''}
      </div>
      <div class="post-meta">
        ${post.theme || 'Other'} • ${new Date(post.createdAt).toLocaleDateString()} • Posted by ${displayAuthor(post)}
      </div>

      <div class="post-actions-row">
        <button class="upvote-btn ${post.viewerHasUpvoted ? 'active' : ''}" type="button">👍 ${post.upvotes || 0}</button>
        <button class="upvote-btn ${post.viewerHasLiked ? 'active' : ''}" type="button">❤️ ${post.likes || 0}</button>
        <button class="primary-btn comment-toggle" type="button">${post.commentsCount || 0} Comments</button>
        <button class="primary-btn updates-toggle" type="button">View Updates</button>
      </div>

      <div class="comments-wrap" style="display:none;">
        <div class="comments-list"></div>
        <form class="comment-form">
          <input class="comment-input" type="text" placeholder="Write a comment" ${currentUser ? '' : 'disabled'} />
          <button class="primary-btn" type="submit" ${currentUser ? '' : 'disabled'}>Post</button>
        </form>
      </div>

      <div class="updates-list" style="display:none;"></div>
    `;

    const [upvoteBtn, likeBtn] = item.querySelectorAll('.upvote-btn');
    const commentToggle = item.querySelector('.comment-toggle');
    const commentsWrap = item.querySelector('.comments-wrap');
    const commentsList = item.querySelector('.comments-list');
    const commentForm = item.querySelector('.comment-form');
    const commentInput = item.querySelector('.comment-input');
    const updatesToggle = item.querySelector('.updates-toggle');
    const updatesList = item.querySelector('.updates-list');

    upvoteBtn.addEventListener('click', () => handlers.onUpvote(post.id));
    likeBtn.addEventListener('click', () => handlers.onLike(post.id));

    commentToggle.addEventListener('click', async () => {
      const opening = commentsWrap.style.display === 'none';
      commentsWrap.style.display = opening ? 'block' : 'none';
      commentToggle.textContent = opening ? 'Hide Comments' : `${post.commentsCount || 0} Comments`;
      if (!opening) return;
      const comments = await handlers.onLoadComments(post.id);
      renderComments(commentsList, comments);
    });

    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = commentInput.value.trim();
      if (!text) return;
      await handlers.onComment(post.id, text);
      commentInput.value = '';
      const comments = await handlers.onLoadComments(post.id);
      renderComments(commentsList, comments);
    });

    updatesToggle.addEventListener('click', async () => {
      const opening = updatesList.style.display === 'none';
      updatesList.style.display = opening ? 'block' : 'none';
      updatesToggle.textContent = opening ? 'Hide Updates' : 'View Updates';
      if (!opening) return;
      updatesList.innerHTML = '<div class="comment-empty">Loading updates...</div>';
      try {
        const updates = await handlers.onLoadUpdates(post.id);
        if (!updates.length) {
          updatesList.innerHTML = '<div class="comment-empty">No updates yet.</div>';
          return;
        }
        updatesList.innerHTML = updates.map((u) => `
          <div class="feedback-update">
            <div class="update-meta"><strong>${u.authorRole || 'admin'}</strong> ${new Date(u.timestamp).toLocaleString()}</div>
            <div class="update-text">${u.content}</div>
          </div>
        `).join('');
      } catch (err) {
        updatesList.innerHTML = '<div class="comment-empty">Failed to load updates.</div>';
      }
    });

    container.appendChild(item);
  });
}
