let feedbackList = [];
let currentSort = "recent";
let currentUser = null;

document.addEventListener("DOMContentLoaded", initFeed);

async function initFeed() {
  const feed = document.getElementById("feedList");

  // Get current user
  try {
    const res = await fetch("/api/whoami", { credentials: "include" });
    const data = await res.json();
    currentUser = data.ok ? data.user : null;

    if (window.NotificationService) {
      if (currentUser) {
        NotificationService.info(
          `Welcome back, ${currentUser.displayName || currentUser.username || "User"}!`,
        );
      } else {
        NotificationService.info(
          "Viewing feed as guest. Log in to interact more.",
        );
      }
    }
  } catch {
    currentUser = null;
    if (window.NotificationService) {
      NotificationService.error(
        "Could not check login status. You may be in guest mode.",
      );
    }
  }

  // Show empty state immediately
  renderFeed(feed, [], handleUpvote, currentUser);

  try {
    feedbackList = await FeedbackService.getAll();
    render();

    if (window.NotificationService) {
      NotificationService.success("Feed loaded!");
    }
  } catch (err) {
    // If the feed fails to load, keep empty render but notify
    if (window.NotificationService) {
      NotificationService.error(
        "Could not load the feed. Please refresh and try again.",
      );
    }
  }
}

function render() {
  const feed = document.getElementById("feedList");
  renderFeed(feed, getSortedFeedback(), handleUpvote, currentUser);
}

function getSortedFeedback() {
  const list = [...feedbackList];

  if (currentSort === "upvotes") {
    return list.sort((a, b) => b.upvotes - a.upvotes);
  }

  if (currentSort === "date") {
    return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function changeSort() {
  currentSort = document.getElementById("sortSelect").value;

  if (window.NotificationService) {
    const label =
      currentSort === "recent"
        ? "Most Recent"
        : currentSort === "upvotes"
          ? "Most Upvoted"
          : "Oldest First";
    NotificationService.info(`Sorting by: ${label}`);
  }

  render();
}

async function handleUpvote(id) {
  try {
    await FeedbackService.toggleUpvote(id);

    if (window.NotificationService) {
      NotificationService.success("Upvote saved!");
    }

    feedbackList = await FeedbackService.getAll();
    render();
  } catch (err) {
    if (window.NotificationService) {
      NotificationService.error("Could not save upvote. Please try again.");
    }
  }
}

async function submitFeedback() {
  const issue = document.getElementById("issue").value.trim();
  const impact = document.getElementById("impact").value.trim();
  const suggestion = document.getElementById("suggestion").value.trim();
  const theme = document.getElementById("theme").value;

  if (!issue || !impact || !suggestion) {
    if (window.NotificationService) {
      NotificationService.error(
        "Please fill out Issue, Impact, and Suggestion before posting.",
      );
    }
    return;
  }

  // Optimistic UI item (temporary)
  const tempId = "temp_" + Date.now();
  const newPost = {
    id: tempId,
    issue,
    impact,
    suggestion,
    theme,
    upvotes: 0,
    createdAt: new Date().toISOString(),
    temp: true,
  };

  // Optimistic UI
  feedbackList.unshift(newPost);
  render();
  closeModal();

  try {
    // Persist
    await FeedbackService.create({ issue, impact, suggestion, theme });

    if (window.NotificationService) {
      NotificationService.success("Feedback posted. Thanks for sharing!");
    }

    // Refresh from server so IDs/upvotes are real
    feedbackList = await FeedbackService.getAll();
    render();
  } catch (err) {
    // Rollback optimistic post if save fails
    feedbackList = feedbackList.filter((p) => p.id !== tempId);
    render();

    if (window.NotificationService) {
      NotificationService.error("Could not post feedback. Please try again.");
    }
  }
}

// Modal helpers (UI only)
function openModal() {
  document.getElementById("modalOverlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
}
