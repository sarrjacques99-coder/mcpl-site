// ============================================================
//  Netlify Function — get-content (PUBLIC)
//  Renvoie l'événement en cours/à venir + la liste des replays.
//  ⚠ Les URLs YouTube des replays NE SONT PAS renvoyées ici.
//      Elles ne sont débloquées qu'après capture du lead.
// ============================================================

import { getStore } from "@netlify/blobs";

function safe(v, fallback) {
  return v === undefined || v === null ? fallback : v;
}

export default async () => {
  try {
    const events = getStore("events");
    const replays = getStore("replays");

    const liveRaw = await events.get("next", { type: "json" });
    const { blobs } = await replays.list();

    const replayList = [];
    for (const b of blobs) {
      const r = await replays.get(b.key, { type: "json" });
      if (r) {
        // On masque le youtube_id côté public
        const { youtube_id, ...publicFields } = r;
        replayList.push({ id: b.key, ...publicFields });
      }
    }
    replayList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const live = liveRaw
      ? {
          title: liveRaw.title,
          description: liveRaw.description,
          expert_name: liveRaw.expert_name,
          expert_company: liveRaw.expert_company,
          expert_rating: liveRaw.expert_rating,
          covered_departments: liveRaw.covered_departments || [],
          scheduled_at: liveRaw.scheduled_at,
          duration_min: safe(liveRaw.duration_min, 60),
          // Si l'événement est marqué live=true, on expose l'embed StreamYard
          is_live: liveRaw.is_live === true,
          stream_url: liveRaw.is_live === true ? liveRaw.stream_url : null,
        }
      : null;

    return new Response(JSON.stringify({ ok: true, live, replays: replayList }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
