/**
 * Getstock — home feed page logic.
 * Loads /api/media (respecting ?q= and ?kind= from the URL), renders
 * skeleton placeholders while loading, then the real animated card grid.
 * Filtering by chip happens without a full page reload.
 */
(async function () {
  await Getstock.initHeader();

  const grid = document.getElementById("feedGrid");
  const skeletonGrid = document.getElementById("skeletonGrid");
  const emptyState = document.getElementById("emptyState");
  const chipRow = document.getElementById("chipRow");

  function currentParams() {
    return new URLSearchParams(window.location.search);
  }

  function renderSkeletons(count = 10) {
    skeletonGrid.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const div = document.createElement("div");
      div.className = "card skeleton-card";
      div.innerHTML = `
        <div class="card-thumb"></div>
        <div class="skeleton-line w-60"></div>
        <div class="skeleton-line w-40"></div>
      `;
      skeletonGrid.appendChild(div);
    }
    skeletonGrid.hidden = false;
    grid.hidden = true;
    emptyState.hidden = true;
  }

  function renderCard(item, index) {
    const a = document.createElement("a");
    a.href = `/watch.html?id=${item.id}`;
    a.className = "card";
    a.style.animationDelay = `${Math.min(index * 0.03, 0.3)}s`;

    const thumb = document.createElement("div");
    thumb.className = "card-thumb";

    if (item.kind === "image") {
      const img = document.createElement("img");
      img.src = `/api/media/${item.id}/view`;
      img.alt = item.title;
      img.loading = "lazy";
      thumb.appendChild(img);
    } else {
      const video = document.createElement("video");
      video.src = `/api/media/${item.id}/view#t=0.5`;
      video.muted = true;
      video.preload = "metadata";
      thumb.appendChild(video);
    }

    const badge = document.createElement("span");
    badge.className = "kind-badge";
    badge.textContent = item.kind;
    thumb.appendChild(badge);

    const info = document.createElement("div");
    info.className = "card-info";
    info.innerHTML = `
      <div class="avatar avatar-sm">${Getstock.escapeHtml(item.ownerName[0].toUpperCase())}</div>
      <div class="card-text">
        <div class="card-title">${Getstock.escapeHtml(item.title)}</div>
        <div class="card-channel">${Getstock.escapeHtml(item.ownerName)}</div>
        <div class="card-meta">${item.views} view${item.views === 1 ? "" : "s"} · ${Getstock.timeAgo(item.uploadedAt)}</div>
      </div>
    `;

    a.append(thumb, info);
    return a;
  }

  async function loadFeed() {
    renderSkeletons();
    const params = currentParams();
    const query = new URLSearchParams();
    if (params.get("q")) query.set("q", params.get("q"));
    if (params.get("kind")) query.set("kind", params.get("kind"));

    const { items } = await Getstock.api(`/api/media?${query.toString()}`);

    skeletonGrid.hidden = true;
    grid.innerHTML = "";

    if (items.length === 0) {
      emptyState.hidden = false;
      grid.hidden = true;
      return;
    }

    emptyState.hidden = true;
    grid.hidden = false;
    items.forEach((item, idx) => grid.appendChild(renderCard(item, idx)));
  }

  function syncChips() {
    const kind = currentParams().get("kind") || "";
    chipRow.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.kind === kind);
    });
  }

  chipRow.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const params = currentParams();
    if (chip.dataset.kind) params.set("kind", chip.dataset.kind);
    else params.delete("kind");
    const query = params.toString();
    history.pushState({}, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
    syncChips();
    loadFeed();
  });

  syncChips();
  loadFeed();
})();