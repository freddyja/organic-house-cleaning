const crypto = require("crypto");

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function timingSafeEqualStr(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function signToken(expMs) {
  const pw = adminPassword();
  if (!pw) return null;
  const payload = String(expMs);
  const sig = crypto.createHmac("sha256", pw).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyToken(token) {
  const pw = adminPassword();
  if (!pw || !token) return false;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [payload, sig] = raw.split(".");
    if (!payload || !sig) return false;
    const expected = crypto.createHmac("sha256", pw).update(payload).digest("hex");
    if (!timingSafeEqualStr(sig, expected)) return false;
    const exp = Number(payload);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
    return true;
  } catch {
    return false;
  }
}

function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function requireAdmin(req) {
  const pw = adminPassword();
  if (!pw) {
    return { ok: false, status: 503, error: "ADMIN_PASSWORD is not configured on the server." };
  }
  const headerPw = req.headers["x-admin-password"];
  if (headerPw && timingSafeEqualStr(headerPw, pw)) return { ok: true };
  const token = getBearer(req);
  if (verifyToken(token)) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

function requireCron(req) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) {
    return { ok: false, status: 503, error: "CRON_SECRET is not configured." };
  }
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${secret}`) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

module.exports = {
  adminPassword,
  timingSafeEqualStr,
  signToken,
  verifyToken,
  requireAdmin,
  requireCron,
};
