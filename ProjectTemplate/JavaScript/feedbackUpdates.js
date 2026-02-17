// Admin-only update UI and behavior + notifications.
// Relies on feedback items having id via data-id or data-feedback-id, or dataset on .feedback-item.
// Uses NotificationService for user feedback.

(async function () {
  // get current user (includes isAdmin from server)
  let me = null;
  try {
    const who = await fetch("/api/whoami", { credentials: "same-origin" }).then(
      (r) => r.json(),
    );
    if (who.ok) me = who.user;
  } catch (e) {
    /* ignore */
  }

  if (!me || !me.isAdmin) return; // only enable for admins

  // Notify admin mode enabled
  if (window.NotificationService) {
    NotificationService.info(
      "Admin tools enabled. You can post updates on feedback items.",
    );
  }

  function findFeedbackElements() {
    return Array.from(
      document.querySelectorAll(
        ".feedback-item, .feedback, [data-feedback-id], [data-id]",
      ),
    );
  }

  function getFeedbackIdFromEl(el) {
    return (
      el.dataset.feedbackId ||
      el.dataset.id ||
      el.getAttribute("data-feedback-id") ||
      el.getAttribute("data-id")
    );
  }

  async function submitUpdate(feedbackId, text, formEl, containerEl) {
    const submitBtn =
      formEl.querySelector("button[type='submit']") ||
      formEl.querySelector("button");
    if (submitBtn) submitBtn.disabled = true;

    try {
      // Try production ASMX endpoint first
      let posted = false;

      try {
        const prodRes = await fetch("ProjectServices.asmx/AddUpdate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: feedbackId, content: text }),
        });

        if (prodRes.ok) {
          const prodJson = await prodRes.json().catch(() => ({}));
          if (
            prodJson &&
            (prodJson.d === "ok" || prodJson.d === "OK" || prodJson.d === true)
          ) {
            // Fetch latest updates and append newest
            const updates = await FeedbackService.getUpdates(feedbackId);
            if (updates && updates.length) {
              appendUpdateToDOM(containerEl, updates[0]);
            }
            formEl.querySelector("textarea").value = "";
            posted = true;

            if (window.NotificationService) {
              NotificationService.success("Update posted!");
            }
          }
        }
      } catch (e) {
        // prod attempt failed — fall back to mock below
      }

      if (!posted) {
        // Fallback to mock backend
        const resp = await fetch(
          "/api/feedback/" + encodeURIComponent(feedbackId) + "/update",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ text }),
          },
        );

        const json = await resp.json().catch(() => ({}));

        if (!resp.ok || !json.ok) {
          if (window.NotificationService) {
            NotificationService.error(json.message || "Failed to post update.");
          } else {
            alert(json.message || "Failed to post update");
          }

          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        appendUpdateToDOM(containerEl, json.update);
        formEl.querySelector("textarea").value = "";

        if (window.NotificationService) {
          NotificationService.success("Update posted!");
        }
      }
    } catch (e) {
      console.error(e);
      if (window.NotificationService) {
        NotificationService.error("Network error. Please try again.");
      } else {
        alert("Network error");
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function appendUpdateToDOM(feedbackEl, update) {
    // find or create .updates container
    let updatesContainer = feedbackEl.querySelector(".updates");
    if (!updatesContainer) {
      updatesContainer = document.createElement("div");
      updatesContainer.className = "updates";

      const body =
        feedbackEl.querySelector(".feedback-body") ||
        feedbackEl.querySelector(".body") ||
        feedbackEl;

      body.parentNode.insertBefore(updatesContainer, body.nextSibling);
    }

    const div = document.createElement("div");
    div.className = "feedback-update";
    div.innerHTML =
      '<div class="update-meta"><strong class="update-author"></strong> <span class="update-time"></span></div>' +
      '<div class="update-text"></div>';

    div.querySelector(".update-author").textContent = update.author || "Admin";
    div.querySelector(".update-time").textContent = new Date(
      update.createdAt,
    ).toLocaleString();
    div.querySelector(".update-text").textContent = update.text;

    updatesContainer.insertBefore(div, updatesContainer.firstChild);
  }

  // inject "Add update" form/button for each feedback item
  function init() {
    for (const el of findFeedbackElements()) {
      const id = getFeedbackIdFromEl(el);
      if (!id) continue;

      // avoid duplicate injection
      if (el.querySelector(".add-update-form")) continue;

      const actionsBar =
        el.querySelector(".feedback-actions") ||
        el.querySelector(".actions") ||
        el;
      const container = document.createElement("div");
      container.className = "add-update-wrapper";

      // toggle button
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "add-update-button";
      btn.textContent = "Add update";
      btn.addEventListener("click", () => {
        form.style.display = form.style.display === "none" ? "" : "none";
      });

      // form
      const form = document.createElement("form");
      form.className = "add-update-form";
      form.style.display = "none";
      form.innerHTML = `
        <textarea rows="3" placeholder="Write an admin update..." required style="width:100%"></textarea>
        <div style="margin-top:6px;">
          <button type="submit" class="submit-update-btn">Post update</button>
          <button type="button" class="cancel-update-btn">Cancel</button>
        </div>
      `;

      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const text = form.querySelector("textarea").value.trim();

        if (!text) {
          if (window.NotificationService) {
            NotificationService.error("Please type an update before posting.");
          }
          return;
        }

        submitUpdate(id, text, form, el);
      });

      form.querySelector(".cancel-update-btn").addEventListener("click", () => {
        form.style.display = "none";
      });

      container.appendChild(btn);
      container.appendChild(form);
      actionsBar.appendChild(container);

      // render existing updates if present in markup as data-updates JSON
      const updatesJson = el.getAttribute("data-updates");
      if (updatesJson) {
        try {
          const updates = JSON.parse(updatesJson);
          updates.forEach((u) => appendUpdateToDOM(el, u));
        } catch (e) {
          /* ignore */
        }
      }
    }
  }

  // run now and also when new content appears
  init();
  const listRoot = document.querySelector("#feedback-list") || document.body;
  const mo = new MutationObserver(() => init());
  mo.observe(listRoot, { childList: true, subtree: true });
})();
