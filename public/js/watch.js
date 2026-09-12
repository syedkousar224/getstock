/**
 * Getstock — watch page logic.
 * Loads a single media item by ?id=, renders the player, handles
 * likes and comments (auth-gated), and fills the "more like this" rail.
 */
(async function () {
  const user = await Getstock.initHeader();
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    window.location.href = "/index.html";
    return;
  }

  const playerWrap = document.getElementById("playerWrap");
  const titleEl = document.getElementById("mediaTitle");
  const ownerAvatar = document.getElementById("ownerAvatar");
  const ownerName = document.getElementById("ownerName");
  const mediaStats = document.getElementById("mediaStats");
  const likeBtn = document.getElementById("likeBtn");
  const likeCount = document.getElementById("likeCount");
  const downloadBtn = document.getElementById("downloadBtn");
  const descriptionEl = document.getElementById("mediaDescription");
  const commentCountEl = document.getElementById("commentCount");
  const commentList = document.getElementById("commentList");
  const commentForm = document.getElementById("commentForm");
  const commentInput = document.getElementById("commentInput");
  const commentAvatar = document.getElementById("commentAvatar");
  const commentSignInPrompt = document.getElementById("commentSignInPrompt");
  const relatedList = document.getElementById("relatedList");

  let currentItem = null;

  function renderComments(comments) {
    commentList.innerHTML = "";
    [...comments].reverse().forEach((c) => {
      const li = document.createElement("li");
      li.className = "comment-item";
      li.innerHTML = `
        <div class="avatar avatar-sm">${Getstock.escapeHtml(c.username[0].toUpperCase())}</div>
        <div class="comment-body">
          <div class="comment-head">
            <span class="comment-author">${Getstock.escapeHtml(c.username)}</span>
            <span class="comment-time">${Getstock.timeAgo(c.createdAt)}</span>
          </div>
          <div class="comment-text">${Getstock.escapeHtml(c.text)}</div>
        </div>
      `;
      commentList.appendChild(li);
    });
  }

  function renderRelatedItem(item) {
    const li = document.createElement("li");
    li.className = "related-item";
    li.addEventListener("click", () => {
      window.location.href = `/watch.html?id=${item.id}`;
    });

    const thumb = document.createElement("div");
    thumb.className = "related-thumb";
    if (item.kind === "image") {
      const img = document.createElement("img");
      img.src = `/api/media/${item.id}/view`;
      img.loading = "lazy";
      thumb.appendChild(img);
    } else {
      const video = document.createElement("video");
      video.src = `/api/media/${item.id}/view#t=0.5`;
      video.muted = true;
      video.preload = "metadata";
      thumb.appendChild(video);
    }

    const info = document.createElement("div");
    info.className = "related-info";
    info.innerHTML = `
      <div class="related-title">${Getstock.escapeHtml(item.title)}</div>
      <div class="related-meta">${Getstock.escapeHtml(item.ownerName)} · ${item.views} views</div>
    `;

    li.append(thumb, info);
    return li;
  }

  async function loadRelated() {
    const { items } = await Getstock.api("/api/media");
    relatedList.innerHTML = "";
    items
      .filter((m) => m.id !== id)
      .slice(0, 12)
      .forEach((item) => relatedList.appendChild(renderRelatedItem(item)));
  }

  async function load() {
    const { item } = await Getstock.api(`/api/media/${id}`);
    currentItem = item;
    document.title = `${item.title} — Getstock`;

    playerWrap.innerHTML = "";
    if (item.kind === "image") {
      const img = document.createElement("img");
      img.src = `/api/media/${id}/view`;
      img.alt = item.title;
      playerWrap.appendChild(img);
    } else {
      const video = document.createElement("video");
      video.src = `/api/media/${id}/view`;
      video.controls = true;
      playerWrap.appendChild(video);
    }

    titleEl.textContent = item.title;
    ownerAvatar.textContent = item.ownerName[0].toUpperCase();
    ownerName.textContent = item.ownerName;
    mediaStats.textContent = `${item.views} view${item.views === 1 ? "" : "s"} · ${Getstock.timeAgo(item.uploadedAt)}`;
    descriptionEl.textContent = item.description || "No description provided.";
    downloadBtn.href = `/api/media/${id}/download`;

    likeCount.textContent = item.likeCount;
    likeBtn.classList.toggle("is-liked", item.likedByMe);

    commentCountEl.textContent = item.comments.length;
    renderComments(item.comments);

    if (user) {
      commentForm.hidden = false;
      commentSignInPrompt.hidden = true;
      commentAvatar.textContent = user.username[0].toUpperCase();
    } else {
      commentForm.hidden = true;
      commentSignInPrompt.hidden = false;
    }

    loadRelated();
  }

  likeBtn.addEventListener("click", async () => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }
    const { likeCount: count, likedByMe } = await Getstock.api(`/api/media/${id}/like`, {
      method: "POST",
    });
    likeCount.textContent = count;
    likeBtn.classList.toggle("is-liked", likedByMe);
  });

  commentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = commentInput.value.trim();
    if (!text) return;
    const { comment } = await Getstock.api(`/api/media/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    currentItem.comments.push(comment);
    commentCountEl.textContent = currentItem.comments.length;
    renderComments(currentItem.comments);
    commentInput.value = "";
  });

  load();
})();