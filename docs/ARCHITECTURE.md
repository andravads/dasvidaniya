# Homies OS architecture

Expo Router + React Native + TypeScript serves Android, iOS and responsive web. A common domain store owns tasks, events, habits, business campaigns, drafts, watchlists, cards and conversations. Screens never talk directly to AI providers.

## Data and trust

Local mode is an explicitly labeled single-device sandbox, not authentication or cloud backup. AsyncStorage is namespaced by account. Supabase Auth (email/password) and owner-only RLS provide account isolation. The cloud stores individual versioned records, with tombstones for deletion; synchronization merges by record ID and latest timestamp. This MVP uses last-write-wins, not collaborative conflict resolution. Do not use it for shared maintenance authorizations. Concurrent edits to the same record may overwrite each other; exporting a backup is supported.

Engineering documents live in a private owner-prefixed Storage bucket and a separate metadata table. Users classify each document and separately authorize transmission to OpenAI. Upload without authorization never sends a file to AI. Retrieval uses OpenAI File Search, creating a private vector store for each user; extracted citations are returned with the answer. Local TXT imports support keyword excerpts without AI; PDF/DOCX text retrieval requires configured cloud processing. XLSX/images may be stored, but OCR and spreadsheet semantic indexing remain unimplemented. Never infer repair limits from an unsupported source.

The assistant Edge Function authenticates every request, bounds input and context, strips confidential engineering records from general chat, reserves usage budget before calling OpenAI Responses, and logs usage. The model can propose only a small validated action set. The client validates again, checks schedule conflicts, and records performed actions. External publishing, trading and deletion tools are not exposed. Engineering mode restricts answers to explicitly authorized indexed files and labels interpretation.

## Phases / actual scope

1. MVP: dashboard, task/calendar CRUD, habits + timer, account preferences, local persistence and authenticated cloud sync, native scheduled local reminders, persistent chat, local deterministic tools, configured OpenAI chat/tools, authorized document upload/search, captions and campaigns.
2. Manual research: editable IDX/US lists with unavailable-data labels, card variants and user-entered prices. Provider connections, exchange calendars, automatic market briefings and OCR are extension points, not working integrations.
3. Content: draft pipeline, scheduled tasks, caption generator, manual metrics. Carousel/video export, OAuth calendar sync and publishing require separate implementation.
4. Hardening: domain/unit and browser workflow tests, web build, RLS schema and deployment documentation. Production security review, device notification tests and cross-device validation require deployed Supabase and physical devices.

## Conventions

Strict TypeScript. Domain validation in `src/lib/domain.ts`. Business state in `src/state/Store.tsx`. Shared UI tokens in `src/components/UI.tsx`. New provider adapters must return provenance, timestamps and availability; unavailable is never represented as zero or a fabricated quote. No secrets in EXPO_PUBLIC variables. Migrations are versioned. Run typecheck, unit tests and browser tests before release.
