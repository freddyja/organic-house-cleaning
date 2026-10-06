(() => {
  const cfg = window.OHC_CONFIG || {};
  const PHONE = cfg.phoneE164 || "7273792528";
  const CANONICAL = "https://computingmadeeasy.org/organic-house-cleaning/";
  const $ = (id) => document.getElementById(id);

  function apiBase() {
    const configured = (cfg.apiBase || "").replace(/\/$/, "");
    const host = location.hostname;
    if (host.includes("vercel.app") || host === "localhost" || host === "127.0.0.1") {
      return "";
    }
    return configured;
  }

  function apiUrl(path) {
    return `${apiBase()}${path}`;
  }

  function radioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : "";
  }
  function checkedServices() {
    return [...document.querySelectorAll('input[name="service"]:checked')].map((el) => el.value);
  }
  function digits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function readUtm() {
    try {
      const q = new URLSearchParams(location.search);
      const utm = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
        const v = q.get(k);
        if (v) utm[k] = v.slice(0, 120);
      }
      return utm;
    } catch {
      return {};
    }
  }

  function collectFields() {
    return {
      name: $("cust-name").value.trim(),
      phone: $("cust-phone").value.trim(),
      email: $("cust-email").value.trim(),
      address: $("cust-address").value.trim(),
      homeType: radioValue("home-type"),
      beds: $("beds").value.trim(),
      baths: $("baths").value.trim(),
      sqft: $("sqft").value.trim(),
      pets: radioValue("pets"),
      services: checkedServices(),
      frequency: radioValue("freq"),
      schedule: $("schedule").value.trim(),
      focus: $("focus").value.trim(),
      products: $("products").value.trim(),
      found: $("found").value.trim(),
      notes: $("notes").value.trim(),
    };
  }

  function buildBody() {
    const f = collectFields();
    const lines = [
      "Free quote request — Organic House Cleaning",
      f.name && `Name: ${f.name}`,
      f.phone && `Phone: ${f.phone}`,
      f.email && `Email: ${f.email}`,
      f.address && `Address: ${f.address}`,
      f.homeType && `Home: ${f.homeType}`,
      (f.beds || f.baths) && `Beds/Baths: ${f.beds || "—"} / ${f.baths || "—"}`,
      f.sqft && `Sq ft: ${f.sqft}`,
      f.pets && `Pets: ${f.pets}`,
      f.services.length && `Service: ${f.services.join(", ")}`,
      f.frequency && `Frequency: ${f.frequency}`,
      f.schedule && `Preferred schedule: ${f.schedule}`,
      f.focus && `Focus areas: ${f.focus}`,
      f.products && `Products: ${f.products}`,
      f.found && `Found us via: ${f.found}`,
      f.notes && `Notes: ${f.notes}`,
    ].filter(Boolean);
    return lines.join("\n");
  }

  function validate() {
    const f = collectFields();
    const phoneDigits = digits(f.phone);
    if (!/[A-Za-z]/.test(f.name)) return { ok: false, hint: "Enter your name." };
    if (phoneDigits.length < 10 || phoneDigits.length > 15) return { ok: false, hint: "Enter a phone number so we can reach you." };
    if (f.address.length < 3) return { ok: false, hint: "Enter your address or ZIP." };
    if (!f.services.length) return { ok: false, hint: "Pick at least one service type." };
    return { ok: true, hint: "" };
  }

  function buildSmsUrl(body) {
    return `sms:+1${PHONE}?&body=${encodeURIComponent(body)}`;
  }

  async function saveLead(smsBody) {
    const f = collectFields();
    const payload = {
      ...f,
      smsBody,
      source: location.href.split("#")[0],
      utm: readUtm(),
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(apiUrl("/api/leads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    } catch (err) {
      return { ok: false, error: err };
    } finally {
      clearTimeout(timer);
    }
  }

  function logVisit() {
    try {
      const payload = {
        path: location.pathname + location.search,
        referrer: document.referrer || "",
        userAgent: (navigator.userAgent || "").slice(0, 180),
        utm: readUtm(),
      };
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(apiUrl("/api/visits"), blob);
        return;
      }
      fetch(apiUrl("/api/visits"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  let submitting = false;

  async function onSubmitClick(ev) {
    ev.preventDefault();
    if (submitting) return;
    const v = validate();
    if (!v.ok) {
      $("form-hint").textContent = v.hint;
      return;
    }
    submitting = true;
    const body = buildBody();
    const host = $("send-host");
    const btn = host.querySelector("a.send, button.send");
    if (btn) {
      btn.textContent = "Saving…";
      if (btn.tagName === "BUTTON") btn.disabled = true;
    }
    $("form-hint").textContent = "Saving your request…";
    const saved = await saveLead(body);
    submitting = false;
    refresh();
    if (saved.ok) {
      $("form-hint").textContent = "Saved — opening your text message…";
      showToast("Request saved");
    } else {
      $("form-hint").textContent = "Could not reach the server — opening text message instead.";
    }
    // Always offer sms: fallback / continuation
    location.href = buildSmsUrl(body);
  }

  function refresh() {
    const body = buildBody();
    const v = validate();
    $("preview").textContent = body || "Fill in the form. The text Anne & Rosana will receive shows here.";
    if (!submitting) $("form-hint").textContent = v.hint;
    const host = $("send-host");
    host.replaceChildren();
    if (v.ok) {
      const link = document.createElement("a");
      link.className = "send";
      link.href = buildSmsUrl(body);
      link.textContent = "Send free quote request";
      link.addEventListener("click", onSubmitClick);
      host.append(link);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "send";
      btn.disabled = true;
      btn.textContent = "Send free quote request";
      host.append(btn);
    }
  }

  function shareUrl() {
    try {
      const here = location.href.split("#")[0];
      if (here.includes("computingmadeeasy.org")) return here;
      if (here.includes("github.io")) return CANONICAL;
      return here;
    } catch {
      return CANONICAL;
    }
  }

  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  async function copyLink() {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      showToast("Could not copy — select the address bar");
    }
  }

  function renderQr() {
    const host = $("share-qr");
    host.replaceChildren();
    const url = shareUrl();
    if (typeof qrcode === "undefined") {
      host.textContent = url;
      return;
    }
    try {
      const qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      host.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      const svg = host.querySelector("svg");
      if (svg) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", "QR code for Organic House Cleaning free quote");
      }
    } catch (err) {
      host.textContent = "QR unavailable";
      console.warn(err);
    }
  }

  async function onShare() {
    const url = shareUrl();
    const panel = $("share-panel");
    panel.hidden = false;
    renderQr();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Organic House Cleaning — Free Quote",
          text: "Request a free quote from Anne & Rosana.",
          url,
        });
      } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }
  }

  let deferredPrompt = null;
  function updateInstallUi() {
    const btn = $("install-app");
    const tip = $("install-tip");
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    if (standalone) {
      btn.hidden = true;
      tip.hidden = true;
      return;
    }
    if (deferredPrompt) {
      btn.hidden = false;
      tip.hidden = true;
      return;
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    btn.hidden = false;
    btn.onclick = () => {
      tip.hidden = false;
      tip.textContent = isIos
        ? "On iPhone: tap Share, then Add to Home Screen."
        : "Use your browser menu → Install app / Add to Home Screen.";
    };
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    updateInstallUi();
    $("install-app").onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      updateInstallUi();
    };
  });

  function setupAutoUpdate() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      reg.update();
      setInterval(() => reg.update(), 60 * 60 * 1000);
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });
    }).catch(() => {});
  }

  for (const id of ["cust-name","cust-phone","cust-email","cust-address","beds","baths","sqft","schedule","focus","products","found","notes"]) {
    $(id).addEventListener("input", refresh);
  }
  for (const el of document.querySelectorAll('input[name="home-type"], input[name="pets"], input[name="service"], input[name="freq"]')) {
    el.addEventListener("change", refresh);
  }
  $("share-site").addEventListener("click", onShare);
  $("copy-share-link").addEventListener("click", copyLink);
  updateInstallUi();
  setupAutoUpdate();
  refresh();
  logVisit();
})();
