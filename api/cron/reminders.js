const { handleOptions, json } = require("../../lib/cors");
const { requireCron } = require("../../lib/auth");
const { listAppointments, updateAppointment } = require("../../lib/store");
const { sendSms, reminderMessage, twilioConfigured } = require("../../lib/twilio");
const { partsInTz, formatWhenNy, ymdInTz, addDaysYmd, TZ } = require("../../lib/time");

/**
 * Daily crons (Hobby-friendly):
 *  - 12:00 UTC ≈ 08:00 America/New_York (EDT) — morning-of window
 *  - 22:00 UTC ≈ 18:00 America/New_York (EDT) — day-before window
 * Handler uses local hour windows so EST/EDT drift still works.
 */
module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const auth = requireCron(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const now = new Date();
  const local = partsInTz(now, TZ);
  const results = [];
  const isMorningWindow = local.hour >= 7 && local.hour <= 9;
  const isEveningWindow = local.hour >= 17 && local.hour <= 19;

  if (!twilioConfigured()) {
    return json(res, 200, {
      ok: true,
      skipped: true,
      reason: "Twilio not configured",
      local,
      isMorningWindow,
      isEveningWindow,
    });
  }

  try {
    const appointments = await listAppointments();
    const today = local.ymd;
    const tomorrow = addDaysYmd(today, 1);

    for (const appt of appointments) {
      if (!appt.scheduledAt || !appt.phone || !appt.clientName) continue;
      const apptYmd = ymdInTz(appt.scheduledAt, TZ);
      const whenLabel = formatWhenNy(appt.scheduledAt);

      if (apptYmd === tomorrow && isEveningWindow && !appt.reminderDayBeforeSentAt) {
        const msg = reminderMessage(appt.clientName, whenLabel);
        const sent = await sendSms({ to: appt.phone, body: msg });
        if (sent.ok) {
          await updateAppointment(appt.id, { reminderDayBeforeSentAt: now.toISOString() });
        }
        results.push({ id: appt.id, kind: "day-before", ...sent });
      }

      if (apptYmd === today && isMorningWindow && !appt.reminderMorningSentAt) {
        const msg = reminderMessage(appt.clientName, whenLabel);
        const sent = await sendSms({ to: appt.phone, body: msg });
        if (sent.ok) {
          await updateAppointment(appt.id, { reminderMorningSentAt: now.toISOString() });
        }
        results.push({ id: appt.id, kind: "morning-of", ...sent });
      }
    }

    return json(res, 200, {
      ok: true,
      local,
      isMorningWindow,
      isEveningWindow,
      sent: results.length,
      results,
    });
  } catch (err) {
    console.error("cron reminders error", err);
    return json(res, 500, { error: String(err.message || err) });
  }
};
