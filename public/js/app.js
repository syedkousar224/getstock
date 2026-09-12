/**
 * Getstock — shared client-side helpers.
 * Loaded on every page. Handles the header/sidebar behavior, the
 * auth-area avatar/sign-in button, and small formatting utilities
 * used by home.js, watch.js, and upload.js.
 */
const Getstock = (() => {
  // ---------- API helper ----------
  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  // ---------- formatting ----------
  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  function timeAgo(ts) {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    const steps = [
      [60, "second"],
      [60, "minute"],
      [24, "hour"],
      [7, "day"],
      [4.345, "week"],
      [12, "month"],
      [Number.POSITIVE_INFINITY, "year"],
    ];
    let value = seconds;
    for (const [count, label] of steps) {
      if (value < count) {
        const rounded = Math.max(1, Math.floor(value));
        return `${rounded} ${label}${rounded === 1 ? "" : "s"} ago`;
      }
      value /= count;
    }
    return "just now";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  // ---------- header / sidebar / auth area (shared across all pages) ----------
  function renderAuthArea(user) {
    const el = document.getElementById("authArea");
    if (!el) return;
    if (user) {
      el.innerHTML = `<div class="avatar avatar-sm" id="headerAvatar" title="${escapeHtml(
        user.username
      )} — click to log out">${escapeHtml(user.username[0].toUpperCase())}</div>`;
      el.querySelector("#headerAvatar").addEventListener("click", async () => {
        if (!confirm("Log out of Getstock?")) return;
        await api("/api/logout", { method: "POST" });
        window.location.href = "/index.html";
      });
    } else {
      el.innerHTML = `<a href="/login.html" class="auth-signin-btn">Sign in</a>`;
    }
  }

  function initSidebarToggle() {
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const scrim = document.getElementById("sidebarScrim");
    const mainContent = document.getElementById("mainContent");
    if (!menuToggle || !sidebar) return;

    menuToggle.addEventListener("click", () => {
      const isMobile = window.innerWidth <= 860;
      if (isMobile) {
        sidebar.classList.toggle("is-open");
        if (scrim) scrim.classList.toggle("is-visible");
      } else {
        sidebar.classList.toggle("is-collapsed");
        if (mainContent) mainContent.classList.toggle("is-full");
      }
    });

    if (scrim) {
      scrim.addEventListener("click", () => {
        sidebar.classList.remove("is-open");
        scrim.classList.remove("is-visible");
      });
    }
  }

  function initSearchForm() {
    const form = document.getElementById("searchForm");
    if (!form) return;
    const input = document.getElementById("searchInput");
    const params = new URLSearchParams(window.location.search);
    if (input && params.get("q")) input.value = params.get("q");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = input.value.trim();
      const url = new URL("/index.html", window.location.origin);
      if (q) url.searchParams.set("q", q);
      window.location.href = url.toString();
    });
  }

  // Call once per page: sets up header/sidebar/search and returns the current user (or null).
  async function initHeader() {
    initSidebarToggle();
    initSearchForm();
    const { user } = await api("/api/me").catch(() => ({ user: null }));
    renderAuthArea(user);
    return user;
  }

  // ---------- login page ----------
  function initLoginPage() {
    const form = document.getElementById("loginForm");
    const errorEl = document.getElementById("formError");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      const fd = new FormData(form);
      try {
        await api("/api/login", {
          method: "POST",
          body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }),
        });
        window.location.href = "/index.html";
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    });
  }

  // ---------- register page ----------
  function initRegisterPage() {
    const form = document.getElementById("registerForm");
    const errorEl = document.getElementById("formError");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      const fd = new FormData(form);
      try {
        await api("/api/register", {
          method: "POST",
          body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }),
        });
        window.location.href = "/index.html";
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    });
  }

  return {
    api,
    formatBytes,
    timeAgo,
    escapeHtml,
    renderAuthArea,
    initHeader,
    initLoginPage,
    initRegisterPage,
  };
})();