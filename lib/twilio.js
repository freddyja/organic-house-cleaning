function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM
  );
}

function normalizeToE164(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (String(phone || "").startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

async function sendSms({ to, body }) {
  if (!twilioConfigured()) {
    return { ok: false, skipped: true, error: "Twilio env vars not configured" };
  }
  const toE164 = normalizeToE164(to);
  if (!toE164) {
    return { ok: false, error: "Invalid phone number" };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({ To: toE164, From: from, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data.message || data.error_message || `Twilio HTTP ${res.status}`,
      code: data.code,
    };
  }
  return { ok: true, sid: data.sid, status: data.status };
}

function reminderMessage(name, whenLabel) {
  return `Hi ${name}, reminder: Organic House Cleaning is scheduled ${whenLabel}. Reply or call 727-379-2528 if you need to reschedule. — Anne & Rosana`;
}

module.exports = {
  twilioConfigured,
  normalizeToE164,
  sendSms,
  reminderMessage,
};
