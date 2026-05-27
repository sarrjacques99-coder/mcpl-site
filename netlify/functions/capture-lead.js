// ============================================================
//  Netlify Function — capture-lead (PUBLIC)
//  Reçoit le formulaire du Smart Gate, valide, calcule le matching,
//  stocke le lead, et renvoie l'URL YouTube/StreamYard cachée.
//
//  Données lues depuis Netlify Blobs (gérées via /admin.html) :
//    - store "events"   : clé "next"  → événement live
//    - store "replays"  : 1 clé par replay
// ============================================================

import { getStore } from "@netlify/blobs";

function deptFromPostal(postal) {
  if (!postal || postal.length < 2) return null;
  return parseInt(postal.slice(0, 2), 10);
}

async function findLocalPartner(dept, excludeKey) {
  const replays = getStore("replays");
  const { blobs } = await replays.list();
  const seen = new Set();
  for (const b of blobs) {
    if (b.key === excludeKey) continue;
    const r = await replays.get(b.key, { type: "json" });
    if (!r) continue;
    const key = `${r.expert_company}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (
      Array.isArray(r.covered_departments) &&
      r.covered_departments.includes(dept) &&
      Number(r.expert_rating) >= 4.5
    ) {
      return {
        company: r.expert_company,
        name: r.expert_name,
        rating: Number(r.expert_rating),
      };
    }
  }
  return null;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée" });

  let data;
  try { data = await request.json(); } catch { return json(400, { error: "JSON invalide" }); }

  const { first_name, last_name, email, company, postal_code, video_id, consent, utm, content_type } = data;

  const errors = {};
  if (!first_name?.trim()) errors.first_name = "Prénom requis";
  if (!last_name?.trim()) errors.last_name = "Nom requis";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "Email invalide";
  if (!company?.trim()) errors.company = "Société requise";
  if (!postal_code || !/^\d{5}$/.test(postal_code)) errors.postal_code = "Code postal (5 chiffres)";
  if (consent !== true) errors.consent = "Le consentement est obligatoire";
  if (!video_id) errors.video_id = "Contenu introuvable";
  if (Object.keys(errors).length) return json(422, { error: "Champs invalides", fields: errors });

  let content, contentSource;
  if (content_type === "live") {
    const events = getStore("events");
    content = await events.get("next", { type: "json" });
    contentSource = "live";
  } else {
    const replays = getStore("replays");
    content = await replays.get(video_id, { type: "json" });
    contentSource = "replay";
  }
  if (!content) return json(404, { error: "Contenu introuvable" });

  const dept = deptFromPostal(postal_code);
  const covered = Array.isArray(content.covered_departments) ? content.covered_departments : [];
  const isMatch = covered.includes(dept);
  const partner = isMatch ? null : await findLocalPartner(dept, video_id);

  const lead = {
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    email: email.trim().toLowerCase(),
    company: company.trim(),
    postal_code,
    departement: dept,
    content_type: contentSource,
    video_id,
    video_title: content.title,
    expert_company: content.expert_company,
    expert_name: content.expert_name,
    is_relocated: !isMatch,
    relocated_to_company: partner ? partner.company : null,
    consent: true,
    consent_ts: new Date().toISOString(),
    utm: utm || null,
    user_agent: request.headers.get("user-agent") || null,
    created_at: new Date().toISOString(),
  };

  try {
    const leads = getStore("leads");
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await leads.setJSON(key, lead);
  } catch (e) {
    console.error("Lead store error:", e);
  }

  const playback = contentSource === "live"
    ? { type: "live", stream_url: content.stream_url }
    : { type: "replay", youtube_id: content.youtube_id };

  return json(200, {
    ok: true,
    playback,
    matching: {
      is_match: isMatch,
      dept,
      expert: { name: content.expert_name, company: content.expert_company, departments: covered },
      partner,
    },
  });
};
