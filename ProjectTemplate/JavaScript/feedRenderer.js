function renderEmptyState(container) {
  container.innerHTML = `
    <div class="feed-empty">
      <h2>No feedback yet</h2>
      <p>Be the first to share feedback.</p>
    </div>
  `;
}


// Helper to anonymize author for display
function getAuthorLabel(post) {
  if (!post.author || post.author === 'anonymous') return 'Anonymous';
  // Show only last 3 chars of publicId for extra privacy
  if (post.author.startsWith('user-')) return 'User ' + post.author.slice(-3);
  return 'User';
}

function renderFeed(container, posts, handlers, user) {
  container.innerHTML = "";

  if (!posts.length) {
    renderEmptyState(container);
    return;
  }

  posts.forEach(post => {
    container.appendChild(createPostElement(post, handlers, user));
  });
}

function createPostElement(post, handlers, user) {
  const item = document.createElement("div");
  item.className = "feed-item";

  const hasUpvoted = post.viewerHasUpvoted || localStorage.getItem(`upvoted_${post.id}`);
  const hasLiked = post.viewerHasLiked || false;
  const isAdmin = user && user.isAdmin;

  item.innerHTML = `
    <div style="font-weight:700; margin-bottom:0.25rem;">${post.authorDisplayName || getAuthorLabel(post)}</div>
    <div class="feed-subject">${post.issue}</div>

    <div class="feed-text">
      <strong>Impact:</strong><br>${post.impact}<br><br>
      <strong>Suggestion:</strong><br>${post.suggestion}
    </div>

    <div class="post-meta">
      ${post.theme} • ${new Date(post.createdAt).toLocaleDateString()}
    </div>
    ${post.commentsCount > 0 ? `<div class="post-meta" style="margin-top:0.3rem;">Latest comment by <strong>${post.latestCommentAuthor || "User"}</strong>: ${post.latestCommentText || ""}</div>` : ""}

    <button class="upvote-btn action-upvote ${hasUpvoted ? "active" : ""}">
      👍 ${post.upvotes}
    </button>
    <button class="upvote-btn action-like ${hasLiked ? "active" : ""}" style="margin-left:0.5rem;">
      ❤️ ${post.likes || 0}
    </button>
    <button class="secondary-btn comment-toggle-btn" style="margin-left:0.5rem;">
      💬 ${post.commentsCount || 0}
    </button>

    <button class="toggle-updates-btn" style="margin-left:1rem;">View Updates</button>
    <div class="updates-list" style="display:none;"></div>
    <div class="comments-list" style="display:none; margin-top:0.75rem;"></div>
    <div class="comment-form" style="display:none; margin-top:0.5rem;">
      <textarea class="comment-textarea" placeholder="Add a comment..." rows="2" style="width:100%;"></textarea>
      <button class="primary-btn submit-comment-btn" style="margin-top:0.4rem;">Post Comment</button>
    </div>
    ${isAdmin ? `
    <button class="add-update-btn secondary-btn" style="margin-left:1rem;">Add Update</button>
    <div class="add-update-form" style="display:none; margin-top:1rem;">
      <textarea class="update-textarea" placeholder="Enter update content" rows="3"></textarea><br>
      <button class="submit-update-btn primary-btn" style="margin-top:0.5rem;">Submit</button>
      <button class="cancel-update-btn secondary-btn" style="margin-left:0.5rem;">Cancel</button>
    </div>
    ` : ''}
  `;

  const upvoteBtn = item.querySelector(".action-upvote");
  const likeBtn = item.querySelector(".action-like");
  upvoteBtn.onclick = () => handlers.onUpvote(post.id);
  likeBtn.onclick = () => handlers.onLike(post.id);

  const commentsToggleBtn = item.querySelector(".comment-toggle-btn");
  const commentsList = item.querySelector(".comments-list");
  const commentForm = item.querySelector(".comment-form");
  const commentTextarea = item.querySelector(".comment-textarea");
  const submitCommentBtn = item.querySelector(".submit-comment-btn");
  let commentsLoaded = false;

  commentsToggleBtn.onclick = async () => {
    if (commentsList.style.display === "none") {
      commentsList.style.display = "";
      commentForm.style.display = user ? "" : "none";
      commentsToggleBtn.textContent = `Hide Comments (${post.commentsCount || 0})`;
      if (!commentsLoaded) {
        commentsList.innerHTML = "<div class='loading'>Loading comments...</div>";
        try {
          const comments = await FeedbackService.getComments(post.id);
          commentsList.innerHTML = "";
          if (!comments.length) {
            commentsList.innerHTML = "<div class='no-updates'>No comments yet.</div>";
          } else {
            comments.forEach(c => {
              const cDiv = document.createElement("div");
              cDiv.className = "feedback-update";
              cDiv.innerHTML = `<div class="update-meta"><strong>${c.author || "User"}</strong> <span>${new Date(c.timestamp).toLocaleString()}</span></div><div class="update-text">${c.text}</div>`;
              commentsList.appendChild(cDiv);
            });
          }
          commentsLoaded = true;
        } catch {
          commentsList.innerHTML = "<div class='no-updates'>Could not load comments.</div>";
        }
      }
    } else {
      commentsList.style.display = "none";
      commentForm.style.display = "none";
      commentsToggleBtn.textContent = `💬 ${post.commentsCount || 0}`;
    }
  };

  submitCommentBtn.onclick = async () => {
    const text = commentTextarea.value.trim();
    if (!text) return;
    submitCommentBtn.disabled = true;
    try {
      await handlers.onComment(post.id, text);
    } finally {
      submitCommentBtn.disabled = false;
    }
  };

  // Toggle updates
  const toggleBtn = item.querySelector('.toggle-updates-btn');
  const updatesList = item.querySelector('.updates-list');
  let updatesLoaded = false;
  toggleBtn.onclick = async () => {
    if (updatesList.style.display === 'none') {
      if (!updatesLoaded) {
        updatesList.innerHTML = '<div class="loading">Loading updates...</div>';
        const updates = await FeedbackService.getUpdates(post.id);
        updatesList.innerHTML = '';
        if (updates.length === 0) {
          updatesList.innerHTML = '<div class="no-updates">No updates yet.</div>';
        } else {
          updates.forEach(u => {
            const uDiv = document.createElement('div');
            uDiv.className = 'feedback-update';
            uDiv.innerHTML = `<div class="update-meta"><strong>${u.authorRole}</strong> <span>${new Date(u.timestamp).toLocaleString()}</span></div><div class="update-text">${u.content}</div>`;
            updatesList.appendChild(uDiv);
          });
        }
        updatesLoaded = true;
      }
      updatesList.style.display = '';
      toggleBtn.textContent = 'Hide Updates';
    } else {
      updatesList.style.display = 'none';
      toggleBtn.textContent = 'View Updates';
    }
  };

  if (isAdmin) {
    const addBtn = item.querySelector('.add-update-btn');
    const form = item.querySelector('.add-update-form');
    const textarea = item.querySelector('.update-textarea');
    const submitBtn = item.querySelector('.submit-update-btn');
    const cancelBtn = item.querySelector('.cancel-update-btn');

    addBtn.onclick = () => {
      form.style.display = form.style.display === 'none' ? '' : 'none';
    };

    submitBtn.onclick = async () => {
      const content = textarea.value.trim();
      if (!content) return;
      try {
        await FeedbackService.addUpdate(post.id, content);
        textarea.value = '';
        form.style.display = 'none';
        // Reload updates if visible
        if (updatesList.style.display !== 'none') {
          updatesList.innerHTML = '<div class="loading">Loading updates...</div>';
          const updates = await FeedbackService.getUpdates(post.id);
          updatesList.innerHTML = '';
          if (updates.length === 0) {
            updatesList.innerHTML = '<div class="no-updates">No updates yet.</div>';
          } else {
            updates.forEach(u => {
              const uDiv = document.createElement('div');
              uDiv.className = 'feedback-update';
              uDiv.innerHTML = `<div class="update-meta"><strong>${u.authorRole}</strong> <span>${new Date(u.timestamp).toLocaleString()}</span></div><div class="update-text">${u.content}</div>`;
              updatesList.appendChild(uDiv);
            });
          }
        }
      } catch (e) {
        alert('Failed to add update');
      }
    };

    cancelBtn.onclick = () => {
      textarea.value = '';
      form.style.display = 'none';
    };
  }

  return item;
}
