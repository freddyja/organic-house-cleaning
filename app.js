(() => {
  const PHONE = "7273792528";
  const CANONICAL = "https://computingmadeeasy.org/organic-house-cleaning/";
  const $ = (id) => document.getElementById(id);

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

  function buildBody() {
    const name = $("cust-name").value.trim();
    const phone = $("cust-phone").value.trim();
    const email = $("cust-email").value.trim();
    const address = $("cust-address").value.trim();
    const home = radioValue("home-type");
    const beds = $("beds").value.trim();
    const baths = $("baths").value.trim();
    const sqft = $("sqft").value.trim();
    const pets = radioValue("pets");
    const services = checkedServices();
    const freq = radioValue("freq");
    const schedule = $("schedule").value.trim();
    const focus = $("focus").value.trim();
    const products = $("products").value.trim();
    const found = $("found").value.trim();
    const notes = $("notes").value.trim();

    const lines = [
      "Free quote request — Organic House Cleaning",
      name && `Name: ${name}`,
      phone && `Phone: ${phone}`,
      email && `Email: ${email}`,
      address && `Address: ${address}`,
      home && `Home: ${home}`,
      (beds || baths) && `Beds/Baths: ${beds || "—"} / ${baths || "—"}`,
      sqft && `Sq ft: ${sqft}`,
      pets && `Pets: ${pets}`,
      services.length && `Service: ${services.join(", ")}`,
      freq && `Frequency: ${freq}`,
      schedule && `Preferred schedule: ${schedule}`,
      focus && `Focus areas: ${focus}`,
      products && `Products: ${products}`,
      found && `Found us via: ${found}`,
      notes && `Notes: ${notes}`,
    ].filter(Boolean);
    return lines.join("\n");
  }

  function validate() {
    const name = $("cust-name").value.trim();
    const phoneDigits = digits($("cust-phone").value);
    const address = $("cust-address").value.trim();
    const services = checkedServices();
    if (!/[A-Za-z]/.test(name)) return { ok: false, hint: "Enter your name." };
    if (phoneDigits.length < 10 || phoneDigits.length > 15) return { ok: false, hint: "Enter a phone number so we can reach you." };
    if (address.length < 3) return { ok: false, hint: "Enter your address or ZIP." };
    if (!services.length) return { ok: false, hint: "Pick at least one service type." };
    return { ok: true, hint: "" };
  }

  function buildSmsUrl(body) {
    return `sms:+1${PHONE}?&body=${encodeURIComponent(body)}`;
  }

  function refresh() {
    const body = buildBody();
    const v = validate();
    $("preview").textContent = body || "Fill in the form. The text Anne & Rosana will receive shows here.";
    $("form-hint").textContent = v.hint;
    const host = $("send-host");
    host.replaceChildren();
    if (v.ok) {
      const link = document.createElement("a");
      link.className = "send";
      link.href = buildSmsUrl(body);
      link.textContent = "Text free quote request";
      host.append(link);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "send";
      btn.disabled = true;
      btn.textContent = "Text free quote request";
      host.append(btn);
    }
  }

  function shareUrl() {
    // Prefer CME canonical when live; fall back to current origin for Pages preview
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
    // iOS / browsers without beforeinstallprompt
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
})();
