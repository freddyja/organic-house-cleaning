const { handleOptions, json } = require("../lib/cors");
const { addLead } = require("../lib/store");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const services = Array.isArray(body.services) ? body.services : [];
    if (!/[A-Za-z]/.test(name)) return json(res, 400, { error: "Name required" });
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return json(res, 400, { error: "Phone required" });
    if (address.length < 3) return json(res, 400, { error: "Address required" });
    if (!services.length) return json(res, 400, { error: "Pick at least one service" });

    const lead = await addLead({
      name,
      phone,
      email: body.email,
      address,
      homeType: body.homeType,
      beds: body.beds,
      baths: body.baths,
      sqft: body.sqft,
      pets: body.pets,
      services,
      frequency: body.frequency,
      schedule: body.schedule,
      focus: body.focus,
      products: body.products,
      found: body.found,
      notes: body.notes,
      smsBody: body.smsBody,
      source: body.source || req.headers.origin || "",
      utm: body.utm,
    });
    return json(res, 201, { ok: true, id: lead.id, createdAt: lead.createdAt });
  } catch (err) {
    console.error("leads error", err);
    return json(res, 500, { error: "Could not save lead", detail: String(err.message || err) });
  }
};
