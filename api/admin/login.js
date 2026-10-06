const { handleOptions, json } = require("../../lib/cors");
const { adminPassword, timingSafeEqualStr, signToken } = require("../../lib/auth");
const { storageMode } = require("../../lib/store");
const { twilioConfigured } = require("../../lib/twilio");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const pw = adminPassword();
  if (!pw) return json(res, 503, { error: "ADMIN_PASSWORD is not configured." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!timingSafeEqualStr(body.password, pw)) {
    return json(res, 401, { error: "Wrong password" });
  }

  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const token = signToken(exp);
  return json(res, 200, {
    ok: true,
    token,
    expiresAt: new Date(exp).toISOString(),
    storageMode: storageMode(),
    twilioConfigured: twilioConfigured(),
  });
};
