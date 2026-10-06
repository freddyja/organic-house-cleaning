(() => {
  const cfg = window.OHC_CONFIG || {};
  const PHONE = cfg.phoneE164 || "7273792528";
  const CANONICAL = "https://computingmadeeasy.org/organic-house-cleaning/";
  const LANG_KEY = "ohc-lang";
  const $ = (id) => document.getElementById(id);
  const t = (key) => (typeof window.ohcT === "function" ? window.ohcT(key) : key);
  const tv = (englishValue) => (typeof window.ohcVal === "function" ? window.ohcVal(englishValue) : englishValue);

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
      t("smsTitle"),
      f.name && `${t("smsName")}: ${f.name}`,
      f.phone && `${t("smsPhone")}: ${f.phone}`,
      f.email && `${t("smsEmail")}: ${f.email}`,
      f.address && `${t("smsAddress")}: ${f.address}`,
      f.homeType && `${t("smsHome")}: ${tv(f.homeType)}`,
      (f.beds || f.baths) && `${t("smsBedsBaths")}: ${f.beds || "—"} / ${f.baths || "—"}`,
      f.sqft && `${t("smsSqft")}: ${f.sqft}`,
      f.pets && `${t("smsPets")}: ${tv(f.pets)}`,
      f.services.length && `${t("smsService")}: ${f.services.map(tv).join(", ")}`,
      f.frequency && `${t("smsFrequency")}: ${tv(f.frequency)}`,
      f.schedule && `${t("smsSchedule")}: ${f.schedule}`,
      f.focus && `${t("smsFocus")}: ${f.focus}`,
      f.products && `${t("smsProducts")}: ${f.products}`,
      f.found && `${t("smsFound")}: ${f.found}`,
      f.notes && `${t("smsNotes")}: ${f.notes}`,
    ].filter(Boolean);
    return lines.join("\n");
  }

  function validate() {
    const f = collectFields();
    const phoneDigits = digits(f.phone);
    if (!/[A-Za-zÀ-ÿ]/.test(f.name)) return { ok: false, hint: t("hintName") };
    if (phoneDigits.length < 10 || phoneDigits.length > 15) return { ok: false, hint: t("hintPhone") };
    if (f.address.length < 3) return { ok: false, hint: t("hintAddress") };
    if (!f.services.length) return { ok: false, hint: t("hintService") };
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
      lang: window.ohcLang || "en",
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
      btn.textContent = t("saving");
      if (btn.tagName === "BUTTON") btn.disabled = true;
    }
    $("form-hint").textContent = t("savingHint");
    const saved = await saveLead(body);
    submitting = false;
    refresh();
    if (saved.ok) {
      $("form-hint").textContent = t("savedHint");
      showToast(t("savedToast"));
    } else {
      $("form-hint").textContent = t("saveFailedHint");
    }
    // Always offer sms: fallback / continuation
    location.href = buildSmsUrl(body);
  }

  function refresh() {
    const body = buildBody();
    const v = validate();
    $("preview").textContent = body || t("previewEmpty");
    if (!submitting) $("form-hint").textContent = v.hint;
    const host = $("send-host");
    host.replaceChildren();
    if (v.ok) {
      const link = document.createElement("a");
      link.className = "send";
      link.href = buildSmsUrl(body);
      link.textContent = t("sendBtn");
      link.addEventListener("click", onSubmitClick);
      host.append(link);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "send";
      btn.disabled = true;
      btn.textContent = t("sendBtn");
      host.append(btn);
    }
  }

  function applyLang() {
    const lang = window.ohcLang || "en";
    const dict = (window.OHC_I18N && window.OHC_I18N[lang]) || {};
    document.documentElement.lang = dict.htmlLang || lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    document.querySelectorAll("[data-i18n-content]").forEach((el) => {
      el.setAttribute("content", t(el.getAttribute("data-i18n-content")));
    });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      const on = btn.dataset.lang === lang;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
    });

    // Re-apply install tip if visible
    const tip = $("install-tip");
    if (tip && !tip.hidden && tip.textContent) {
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      tip.textContent = isIos ? t("installTipIos") : t("installTipAndroid");
    }

    refresh();
  }

  function initLangSwitch() {
    let saved = "en";
    try {
      saved = localStorage.getItem(LANG_KEY) || "en";
    } catch {
      saved = "en";
    }
    window.ohcLang = ["en", "es", "pt"].includes(saved) ? saved : "en";
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.ohcLang = btn.dataset.lang;
        try {
          localStorage.setItem(LANG_KEY, window.ohcLang);
        } catch {
          /* ignore */
        }
        applyLang();
      });
    });
    applyLang();
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
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  async function copyLink() {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      showToast(t("linkCopied"));
    } catch {
      showToast(t("copyFailed"));
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
        svg.setAttribute("aria-label", t("qrAria"));
      }
    } catch (err) {
      host.textContent = t("qrUnavailable");
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
          title: t("shareTitleNative"),
          text: t("shareTextNative"),
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
      tip.textContent = isIos ? t("installTipIos") : t("installTipAndroid");
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
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });

    function checkForUpdate(reg) {
      if (!reg || typeof reg.update !== "function") return;
      reg.update().catch(() => {});
      if (reg.waiting) {
        try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch (_) { /* ignore */ }
      }
      if (typeof reg.addEventListener === "function") {
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              try { worker.postMessage({ type: "SKIP_WAITING" }); } catch (_) { /* ignore */ }
            }
          });
        });
      }
    }

    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((reg) => {
      checkForUpdate(reg);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate(reg);
      });
      window.addEventListener("pageshow", () => checkForUpdate(reg));
      window.addEventListener("focus", () => checkForUpdate(reg));
      setInterval(() => checkForUpdate(reg), 60 * 60 * 1000);
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
  initLangSwitch();
  updateInstallUi();
  setupAutoUpdate();
  logVisit();
})();
