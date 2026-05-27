// ============================================================
//  Netlify Function — admin-content (PROTÉGÉE)
//  Tous les endpoints admin pour piloter le contenu.
//  Auth : header "x-admin-token" doit matcher ADMIN_TOKEN (env var).
//
//  Actions (champ "action" du body) :
//    - "get_all"        → renvoie live + tous replays (avec youtube_id)
//    - "save_event"     → upsert l'événement live (data dans "event")
//    - "delete_event"   → efface l'événement
//    - "save_replay"    → upsert un replay (data dans "replay", id optionnel)
//    - "delete_replay"  → supprime un replay (data dans "id")
// ============================================================

import { getStore } from "@netlify/blobs";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function genId() {
  return "rep_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function validateEvent(e) {
  const errors = {};
  if (!e || typeof e !== "object") return { _: "Données manquantes" };
  if (!e.title?.trim()) errors.title = "Titre requis";
  if (!e.expert_name?.trim()) errors.expert_name = "Expert requis";
  if (!e.expert_company?.trim()) errors.expert_company = "Cabinet requis";
  if (e.expert_rating !== undefined && (isNaN(e.expert_rating) || e.expert_rating < 4.5)) {
    errors.expert_rating = "Note minimum 4,5";
  }
  if (!e.scheduled_at) errors.scheduled_at = "Date/heure requise";
  if (e.is_live && !e.stream_url?.trim()) errors.stream_url = "URL StreamYard requise si live actif";
  if (!Array.isArray(e.covered_departments) || e.covered_departments.length === 0) {
    errors.covered_departments = "Au moins 1 département";
  }
  return Object.keys(errors).length ? errors : null;
}

function validateReplay(r) {
  const errors = {};
  if (!r || typeof r !== "object") return { _: "Données manquantes" };
  if (!r.title?.trim()) errors.title = "Titre requis";
  if (!r.tag?.trim()) errors.tag = "Catégorie requise";
  if (!r.expert_name?.trim()) errors.expert_name = "Expert requis";
  if (!r.expert_company?.trim()) errors.expert_company = "Cabinet requis";
  if (!r.youtube_id?.trim()) errors.youtube_id = "ID YouTube requis";
  if (r.expert_rating !== undefined && (isNaN(r.expert_rating) || r.expert_rating < 4.5)) {
    errors.expert_rating = "Note minimum 4,5";
  }
  if (!Array.isArray(r.covered_departments) || r.covered_departments.length === 0) {
    errors.covered_departments = "Au moins 1 département";
  }
  return Object.keys(errors).length ? errors : null;
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée" });

  const token = request.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return json(401, { error: "Non autorisé" });
  }

  let body;
  try { body = await request.json(); } catch { return json(400, { error: "JSON invalide" }); }

  const events = getStore("events");
  const replays = getStore("replays");

  try {
    switch (body.action) {

      case "get_all": {
        const live = await events.get("next", { type: "json" });
        const { blobs } = await replays.list();
        const list = [];
        for (const b of blobs) {
          const r = await replays.get(b.key, { type: "json" });
          if (r) list.push({ id: b.key, ...r });
        }
        list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        return json(200, { ok: true, live, replays: list });
      }

      case "save_event": {
        const errs = validateEvent(body.event);
        if (errs) return json(422, { error: "Champs invalides", fields: errs });
        const event = {
          ...body.event,
          expert_rating: Number(body.event.expert_rating),
          covered_departments: body.event.covered_departments.map(Number),
          updated_at: new Date().toISOString(),
        };
        await events.setJSON("next", event);
        return json(200, { ok: true, event });
      }

      case "delete_event": {
        await events.delete("next");
        return json(200, { ok: true });
      }

      case "save_replay": {
        const errs = validateReplay(body.replay);
        if (errs) return json(422, { error: "Champs invalides", fields: errs });
        const id = body.replay.id || genId();
        const existing = await replays.get(id, { type: "json" });
        const replay = {
          ...body.replay,
          id: undefined, // l'id vit dans la clé Blob, pas dans le corps
          expert_rating: Number(body.replay.expert_rating),
          covered_departments: body.replay.covered_departments.map(Number),
          created_at: existing?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        delete replay.id;
        await replays.setJSON(id, replay);
        return json(200, { ok: true, id, replay });
      }

      case "delete_replay": {
        if (!body.id) return json(400, { error: "id requis" });
        await replays.delete(body.id);
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: String(e) });
  }
};
