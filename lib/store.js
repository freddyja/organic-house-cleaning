/**
 * Storage for leads, visits, appointments.
 * Prefers Upstash Redis / Vercel KV (KV_REST_API_URL + KV_REST_API_TOKEN).
 * Falls back to in-memory (dev / missing secrets — not durable across cold starts).
 */

const crypto = require("crypto");

const KEYS = {
  leads: "ohc:leads",
  visits: "ohc:visits",
  appointments: "ohc:appointments",
};

const memory = {
  leads: [],
  visits: [],
  appointments: [],
};

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function storageMode() {
  if (kvConfigured()) return "kv";
  return "memory";
}

async function kvExec(command) {
  const base = process.env.KV_REST_API_URL.replace(/\/$/, "");
  const res = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function readList(name) {
  if (kvConfigured()) {
    const result = await kvExec(["GET", KEYS[name]]);
    const raw = result.result;
    if (raw == null || raw === "") return [];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return memory[name].slice();
}

async function writeList(name, list) {
  if (kvConfigured()) {
    await kvExec(["SET", KEYS[name], JSON.stringify(list)]);
    return;
  }
  memory[name] = list.slice();
}

function id() {
  return crypto.randomBytes(8).toString("hex");
}

function nowIso() {
  return new Date().toISOString();
}

async function addLead(fields) {
  const leads = await readList("leads");
  const lead = {
    id: id(),
    createdAt: nowIso(),
    contacted: false,
    contactedAt: null,
    name: String(fields.name || "").trim(),
    phone: String(fields.phone || "").trim(),
    email: String(fields.email || "").trim(),
    address: String(fields.address || "").trim(),
    homeType: String(fields.homeType || "").trim(),
    beds: String(fields.beds || "").trim(),
    baths: String(fields.baths || "").trim(),
    sqft: String(fields.sqft || "").trim(),
    pets: String(fields.pets || "").trim(),
    services: Array.isArray(fields.services) ? fields.services : [],
    frequency: String(fields.frequency || "").trim(),
    schedule: String(fields.schedule || "").trim(),
    focus: String(fields.focus || "").trim(),
    products: String(fields.products || "").trim(),
    found: String(fields.found || "").trim(),
    notes: String(fields.notes || "").trim(),
    smsBody: String(fields.smsBody || "").trim(),
    source: String(fields.source || "").trim(),
    utm: fields.utm && typeof fields.utm === "object" ? fields.utm : {},
  };
  leads.unshift(lead);
  await writeList("leads", leads.slice(0, 1000));
  return lead;
}

async function markLeadContacted(leadId, contacted = true) {
  const leads = await readList("leads");
  const idx = leads.findIndex((l) => l.id === leadId);
  if (idx < 0) return null;
  leads[idx] = {
    ...leads[idx],
    contacted: Boolean(contacted),
    contactedAt: contacted ? nowIso() : null,
  };
  await writeList("leads", leads);
  return leads[idx];
}

async function addVisit(fields) {
  const visits = await readList("visits");
  const visit = {
    id: id(),
    createdAt: nowIso(),
    path: String(fields.path || "/").slice(0, 300),
    referrer: String(fields.referrer || "").slice(0, 500),
    userAgent: String(fields.userAgent || "").slice(0, 180),
    utm: fields.utm && typeof fields.utm === "object" ? fields.utm : {},
  };
  visits.unshift(visit);
  await writeList("visits", visits.slice(0, 2000));
  return visit;
}

async function addAppointment(fields) {
  const appointments = await readList("appointments");
  const appt = {
    id: id(),
    createdAt: nowIso(),
    clientName: String(fields.clientName || "").trim(),
    phone: String(fields.phone || "").trim(),
    scheduledAt: String(fields.scheduledAt || "").trim(),
    timezone: "America/New_York",
    reminderDayBeforeSentAt: null,
    reminderMorningSentAt: null,
    notes: String(fields.notes || "").trim(),
  };
  appointments.unshift(appt);
  await writeList("appointments", appointments.slice(0, 500));
  return appt;
}

async function updateAppointment(apptId, patch) {
  const appointments = await readList("appointments");
  const idx = appointments.findIndex((a) => a.id === apptId);
  if (idx < 0) return null;
  appointments[idx] = { ...appointments[idx], ...patch };
  await writeList("appointments", appointments);
  return appointments[idx];
}

async function deleteAppointment(apptId) {
  const appointments = await readList("appointments");
  const next = appointments.filter((a) => a.id !== apptId);
  if (next.length === appointments.length) return false;
  await writeList("appointments", next);
  return true;
}

async function getSummary() {
  const [leads, visits, appointments] = await Promise.all([
    readList("leads"),
    readList("visits"),
    readList("appointments"),
  ]);
  return {
    storageMode: storageMode(),
    visitsCount: visits.length,
    leadsCount: leads.length,
    appointmentsCount: appointments.length,
    recentVisits: visits.slice(0, 50),
    leads: leads.slice(0, 200),
    appointments: appointments.slice(0, 200),
  };
}

async function listAppointments() {
  return readList("appointments");
}

module.exports = {
  storageMode,
  kvConfigured,
  addLead,
  markLeadContacted,
  addVisit,
  addAppointment,
  updateAppointment,
  deleteAppointment,
  getSummary,
  listAppointments,
};
