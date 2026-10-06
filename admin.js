(() => {
  const cfg = window.OHC_CONFIG || {};
  const TOKEN_KEY = "ohc_admin_token";
  const $ = (id) => document.getElementById(id);

  function apiBase() {
    const configured = (cfg.apiBase || "").replace(/\/$/, "");
    const host = location.hostname;
    if (host.includes("vercel.app") || host === "localhost" || host === "127.0.0.1") return "";
    return configured;
  }
  function apiUrl(path) {
    return `${apiBase()}${path}`;
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  }
  function setToken(t) {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(apiUrl(path), { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function fmtWhen(iso) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function showLogin(msg) {
    $("login-panel").hidden = false;
    $("dash").hidden = true;
    if (msg) $("login-hint").textContent = msg;
  }

  function showDash() {
    $("login-panel").hidden = true;
    $("dash").hidden = false;
  }

  async function login() {
    const password = $("admin-password").value;
    $("login-hint").textContent = "Signing in…";
    const { res, data } = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      $("login-hint").textContent = data.error || "Login failed";
      return;
    }
    setToken(data.token);
    $("admin-password").value = "";
    showDash();
    await refresh();
  }

  function logout() {
    setToken("");
    showLogin("Signed out");
  }

  function renderStats(summary) {
    $("stats").innerHTML = `
      <div class="stat"><strong>${summary.visitsCount}</strong><span>Visits</span></div>
      <div class="stat"><strong>${summary.leadsCount}</strong><span>Leads</span></div>
      <div class="stat"><strong>${summary.appointmentsCount}</strong><span>Appointments</span></div>
    `;
    const warns = [];
    if (summary.storageMode === "memory") {
      warns.push("Storage: in-memory (add Upstash KV env vars for durable data)");
    } else {
      warns.push(`Storage: ${summary.storageMode}`);
    }
    warns.push(summary.twilioConfigured ? "Twilio: ready" : "Twilio: not configured (reminders skipped)");
    $("storage-meta").textContent = warns.join(" · ");
  }

  function renderLeads(leads) {
    const host = $("leads-list");
    if (!leads.length) {
      host.innerHTML = "<p class='admin-empty'>No leads yet.</p>";
      return;
    }
    host.replaceChildren();
    for (const lead of leads) {
      const card = document.createElement("article");
      card.className = "admin-card" + (lead.contacted ? " contacted" : "");
      const services = (lead.services || []).join(", ");
      card.innerHTML = `
        <div class="admin-card-top">
          <strong>${escapeHtml(lead.name)}</strong>
          <span class="badge">${lead.contacted ? "Contacted" : "New"}</span>
        </div>
        <p><a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a>
          ${lead.email ? ` · <a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a>` : ""}</p>
        <p>${escapeHtml(lead.address)}</p>
        <p class="muted">${escapeHtml(services)} · ${escapeHtml(lead.frequency || "")}</p>
        <p class="muted">${fmtWhen(lead.createdAt)}</p>
        <button type="button" class="action-btn mark-btn">${lead.contacted ? "Mark new" : "Mark contacted"}</button>
      `;
      card.querySelector(".mark-btn").addEventListener("click", async () => {
        await api("/api/admin/leads", {
          method: "PATCH",
          body: JSON.stringify({ id: lead.id, contacted: !lead.contacted }),
        });
        await refresh();
      });
      host.append(card);
    }
  }

  function renderAppts(appts) {
    const host = $("appts-list");
    if (!appts.length) {
      host.innerHTML = "<p class='admin-empty'>No appointments scheduled.</p>";
      return;
    }
    host.replaceChildren();
    for (const a of appts) {
      const card = document.createElement("article");
      card.className = "admin-card";
      card.innerHTML = `
        <div class="admin-card-top">
          <strong>${escapeHtml(a.clientName)}</strong>
          <button type="button" class="action-btn del-btn">Delete</button>
        </div>
        <p><a href="tel:${escapeHtml(a.phone)}">${escapeHtml(a.phone)}</a></p>
        <p><strong>${fmtWhen(a.scheduledAt)}</strong> <span class="muted">(America/New_York)</span></p>
        <p class="muted">Day-before SMS: ${a.reminderDayBeforeSentAt ? fmtWhen(a.reminderDayBeforeSentAt) : "pending"}
          · Morning: ${a.reminderMorningSentAt ? fmtWhen(a.reminderMorningSentAt) : "pending"}</p>
      `;
      card.querySelector(".del-btn").addEventListener("click", async () => {
        if (!confirm("Delete this appointment?")) return;
        await api("/api/admin/appointments", {
          method: "DELETE",
          body: JSON.stringify({ id: a.id }),
        });
        await refresh();
      });
      host.append(card);
    }
  }

  function renderVisits(visits) {
    const host = $("visits-list");
    if (!visits.length) {
      host.innerHTML = "<p class='admin-empty'>No visits logged yet.</p>";
      return;
    }
    host.replaceChildren();
    for (const v of visits.slice(0, 40)) {
      const row = document.createElement("div");
      row.className = "admin-visit";
      const utm = v.utm && Object.keys(v.utm).length
        ? " · " + Object.entries(v.utm).map(([k, val]) => `${k}=${val}`).join(" ")
        : "";
      row.innerHTML = `<span>${fmtWhen(v.createdAt)}</span>
        <code>${escapeHtml(v.path || "/")}</code>
        <span class="muted">${escapeHtml((v.referrer || "—").slice(0, 60))}${escapeHtml(utm)}</span>`;
      host.append(row);
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function refresh() {
    const { res, data } = await api("/api/admin/summary");
    if (res.status === 401) {
      setToken("");
      showLogin("Session expired — sign in again");
      return;
    }
    if (!res.ok) {
      $("storage-meta").textContent = data.error || "Could not load dashboard";
      return;
    }
    renderStats(data);
    renderLeads(data.leads || []);
    renderAppts(data.appointments || []);
    renderVisits(data.recentVisits || []);
  }

  $("login-btn").addEventListener("click", login);
  $("admin-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
  $("logout-btn").addEventListener("click", logout);
  $("refresh-btn").addEventListener("click", refresh);

  $("appt-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("appt-hint").textContent = "Saving…";
    const { res, data } = await api("/api/admin/appointments", {
      method: "POST",
      body: JSON.stringify({
        clientName: $("appt-name").value.trim(),
        phone: $("appt-phone").value.trim(),
        scheduledLocal: $("appt-when").value,
        notes: $("appt-notes").value.trim(),
      }),
    });
    if (!res.ok) {
      $("appt-hint").textContent = data.error || "Could not save";
      return;
    }
    $("appt-hint").textContent = `Scheduled ${data.whenLabel || ""}`;
    $("appt-form").reset();
    await refresh();
  });

  if (getToken()) {
    showDash();
    refresh();
  }
})();
