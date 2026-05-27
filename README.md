# Mon Comptable Part en Live — V1

Plateforme de webinaires d'experts-comptables vérifiés 4,5/5. Le copy s'adresse aux dirigeants côté front, aux cabinets côté `/cabinet.html`.

## Structure

```
mcpl-site/
├── index.html              # Accueil : hero + bloc événement live + grille replays
├── replay.html             # Player + Smart Gate (capture, support live ET replay)
├── cabinet.html            # Page "Devenir cabinet partenaire" (recrutement)
├── admin.html              # Pilotage live + replays (protégé)
├── regie.html              # Dashboard leads (protégé)
├── confidentialite.html    # RGPD
├── mentions-legales.html
├── assets/style.css        # Design system Circle
├── netlify/functions/
│   ├── get-content.js      # GET public : live + replays (sans youtube_id)
│   ├── capture-lead.js     # POST public : capture lead, débloque l'URL
│   ├── list-leads.js       # GET admin : liste des leads (token)
│   └── admin-content.js    # POST admin : CRUD live + replays (token)
├── netlify.toml
└── package.json
```

## Déploiement (3 minutes)

1. Pousser sur GitHub ou glisser le dossier dans Netlify.
2. Build command : vide. Publish directory : `.`
3. Définir `ADMIN_TOKEN` dans Netlify (Site settings → Environment variables).

## Workflow complet

1. **Tu vas sur `/admin.html`**, tu te connectes avec ton `ADMIN_TOKEN`.
2. **Tu ajoutes ton prochain live** : titre, expert, date, départements couverts. L'événement apparaît automatiquement en haut de la home.
3. **Le jour du live** : tu coches "Live en cours", tu colles l'URL StreamYard. Les visiteurs cliquent "Rejoindre le direct", remplissent le Smart Gate, voient le live.
4. **Après le live** : tu uploades l'enregistrement en non-répertorié sur YouTube, tu crées un nouveau replay dans l'admin avec l'ID YouTube.
5. **Tu décoches "Live en cours"** ou tu retires l'événement.
6. **Les leads** affluent dans `/regie.html` au fur et à mesure. Export CSV en 1 clic.

## Architecture des données (Netlify Blobs)

- Store `events`, clé `next` → événement live en cours / à venir
- Store `replays`, 1 clé par replay
- Store `leads`, 1 clé par lead capté

## Sécurité

- Toutes les URLs vidéo (YouTube ET StreamYard) vivent côté Function. Jamais dans le HTML public.
- L'admin et la régie sont protégées par le même token (`ADMIN_TOKEN`).
- Validation côté serveur : la note 4,5/5 minimum est appliquée à l'enregistrement d'un expert. Pas moyen de contourner via l'UI.

## Migration future vers Supabase

Quand le concept est validé, tu remplaces les `getStore(...)` par des appels Supabase (table `events`, `replays`, `leads`). Le contrat des Functions reste identique côté client — zéro changement dans le HTML.
