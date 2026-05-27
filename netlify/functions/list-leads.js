// ============================================================
//  Netlify Function — list-leads
//  Renvoie tous les leads stockés (pour la page régie).
//  Protégée par un token simple via variable d'env ADMIN_TOKEN.
//  Appel : /.netlify/functions/list-leads?token=XXX
// ============================================================

import { getStore } from "@netlify/blobs";

export default async (request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const expected = process.env.ADMIN_TOKEN;

  // Si ADMIN_TOKEN n'est pas configuré, on refuse par sécurité.
  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const store = getStore("leads");
    const { blobs } = await store.list();
    const leads = [];
    for (const b of blobs) {
      const lead = await store.get(b.key, { type: "json" });
      if (lead) leads.push({ _key: b.key, ...lead });
    }
    leads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return new Response(JSON.stringify({ ok: true, count: leads.length, leads }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
