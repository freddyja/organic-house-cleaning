const { handleOptions, json } = require("../../lib/cors");
const { requireAdmin } = require("../../lib/auth");
const { markLeadContacted } = require("../../lib/store");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const auth = requireAdmin(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (req.method !== "PATCH") return json(res, 405, { error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const id = String(body.id || "").trim();
    if (!id) return json(res, 400, { error: "id required" });
    const lead = await markLeadContacted(id, body.contacted !== false);
    if (!lead) return json(res, 404, { error: "Lead not found" });
    return json(res, 200, { ok: true, lead });
  } catch (err) {
    console.error("leads patch error", err);
    return json(res, 500, { error: String(err.message || err) });
  }
};
