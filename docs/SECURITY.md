# Security boundaries and release checks

- Local sandbox data is unencrypted device/browser storage. Native auth tokens use SecureStore; web tokens use browser storage. Keep browsers/devices trusted and protect against XSS in production. No raw HTML rendering is used.
- Supabase records and document metadata enforce owner-only RLS. Private Storage keys begin with the authenticated user's ID. Domain views use security_invoker. Server-role operations authenticate the bearer token first and explicitly scope every query to its owner.
- General chat excludes engineering records and uses server-loaded context rather than client-claimed records. Engineering chat uses a private user vector store filtered to the currently authorized indexed document IDs. No cross-user retrieval is permitted.
- Only explicitly enabled documents are sent to OpenAI. Work questions themselves are externally sent when using cloud engineering chat. File-search annotations are retained and checked against the authorized document set. No citation means no technical answer.
- AI actions are validated twice, restricted to internal records, checked for calendar conflicts, and logged. Tool requests cannot publish externally, delete important records or perform transactions. Sensitive actions are disabled rather than silently approximated.
- AI calls reserve request budget under a PostgreSQL advisory lock; only service_role may invoke reservations. Input sizes and output tokens are bounded. Provider storage charges need provider billing controls.
- The pending carousel endpoint authenticates before reading photos, accepts only bounded PNG thumbnails (no remotely fetched URLs), and reserves the same AI budget. It validates slide count, account matching and caption lengths before returning output. Neither photos nor generated provider responses are logged in database request records; failures use a generic message. The frontend saves only user-approved captions and slide text. Original photos remain in page memory; native exported ZIPs temporarily remain in OS cache. No new database grants, buckets or RLS policies are introduced.
- Account deletion requires typing DELETE; it purges provider files, private bucket objects and Auth identity. Provider cleanup failures block deletion visibly. Orphan remote files from interrupted indexing are a residual risk; production must add cleanup reconciliation.
- Before production: test a real two-user Supabase deployment, recovery flows, file revocation, malicious uploaded document prompts, concurrent indexing, interrupted deletion, rate limits, device notifications and third-party provider retention. Audit storage policies together with any policies already present in your project. This migration is intended for a fresh project.

## Dependency audit, 9 October 2026

`npm audit --omit=dev` reports upstream advisory paths through Expo / React Native. The actual underlying advisories are:

- [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), installed 3.0.3. No patched release is available from npm at this check.
- [node-forge signature parsing](https://github.com/advisories/GHSA-86w9-cpqp-85rv), installed 1.4.0. No patched release is available from npm at this check.
- [decode-uri-component decoding DoS](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), installed 0.2.2 through query-string / Expo Router. Patched 0.5.0 changes the CommonJS/ESM interface; blindly overriding it would break the caller. Await a compatible Expo Router update or migrate and validate the SDK as a separate change.
- The xcode UUID dependency was overridden to 11.1.1, and its UUID-generation call was exercised successfully. This removes the UUID advisory while preserving the API xcode uses.

The remaining audit paths include both development tooling and client routing. Do not claim a clean production security audit. npm's suggested Expo 44 downgrade is incompatible with this SDK 57 application and was not applied. No signature/TLS verification or security checks were disabled to suppress findings.
