const { handleOptions, json } = require("../../lib/cors");
const { requireAdmin } = require("../../lib/auth");
const { getSummary } = require("../../lib/store");
const { twilioConfigured } = require("../../lib/twilio");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const auth = requireAdmin(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  try {
    const summary = await getSummary();
    return json(res, 200, {
      ok: true,
      ...summary,
      twilioConfigured: twilioConfigured(),
    });
  } catch (err) {
    console.error("summary error", err);
    return json(res, 500, { error: String(err.message || err) });
  }
};
