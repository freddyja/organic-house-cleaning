const { handleOptions, json } = require("../../lib/cors");
const { requireAdmin } = require("../../lib/auth");
const { addAppointment, deleteAppointment, listAppointments } = require("../../lib/store");
const { localNyToIso, formatWhenNy } = require("../../lib/time");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const auth = requireAdmin(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  try {
    if (req.method === "GET") {
      const appointments = await listAppointments();
      return json(res, 200, { ok: true, appointments });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const clientName = String(body.clientName || "").trim();
      const phone = String(body.phone || "").trim();
      const local = String(body.scheduledLocal || body.scheduledAt || "").trim();
      if (!clientName) return json(res, 400, { error: "clientName required" });
      if (phone.replace(/\D/g, "").length < 10) return json(res, 400, { error: "phone required" });
      const iso = localNyToIso(local) || (Date.parse(local) ? new Date(local).toISOString() : null);
      if (!iso) return json(res, 400, { error: "scheduledLocal required (America/New_York)" });
      const appt = await addAppointment({
        clientName,
        phone,
        scheduledAt: iso,
        notes: body.notes,
      });
      return json(res, 201, {
        ok: true,
        appointment: appt,
        whenLabel: formatWhenNy(appt.scheduledAt),
      });
    }

    if (req.method === "DELETE") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const id = String(body.id || req.query?.id || "").trim();
      if (!id) return json(res, 400, { error: "id required" });
      const ok = await deleteAppointment(id);
      if (!ok) return json(res, 404, { error: "Not found" });
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("appointments error", err);
    return json(res, 500, { error: String(err.message || err) });
  }
};
