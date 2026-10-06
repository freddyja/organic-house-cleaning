const { handleOptions, json } = require("../lib/cors");
const { addVisit } = require("../lib/store");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const ua = String(body.userAgent || req.headers["user-agent"] || "").slice(0, 180);
    const visit = await addVisit({
      path: body.path || "/",
      referrer: body.referrer || req.headers.referer || "",
      userAgent: ua,
      utm: body.utm,
    });
    return json(res, 201, { ok: true, id: visit.id });
  } catch (err) {
    console.error("visits error", err);
    // Soft-fail so the PWA never breaks on analytics
    return json(res, 200, { ok: false, error: String(err.message || err) });
  }
};
