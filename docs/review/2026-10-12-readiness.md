# Homies OS security review — 12 October 2026

Database setup was applied by the user in Supabase SQL Editor and reported
successful. No Edge Functions or app hosting were deployed. Application source
and existing exported build were not changed.

## Connection

Runtime URL is a root HTTPS URL for jnuaexajxrudalbcxcii.supabase.co.
The key matches sb_publishable_ format; no credential value was printed.
GET /auth/v1/settings with the configured apikey returned HTTP 200.
GET /rest/v1/ returned HTTP 401 (Secret API key required); this schema-discovery
restriction is not a connectivity failure. No secret key is needed for our next step.
Read-only limit=0 requests for workspace_records, documents, ai_spaces,
ai_requests and background_jobs each returned PGRST205 / HTTP 404. These tables
are not in the live API schema cache; this does not prove the database is empty.

## Security changes prepared

The initial migration is preserved. A follow-up migration,
202610120001_document_permissions.sql, removes PUBLIC/anon/authenticated table
and column grants on documents before restoring SELECT, the existing upload
column allowlist, and updates to allow_ai/classification/revision/published_date.
Server-only status and provider IDs cannot be forged, paths/owners cannot be
reassigned, and clients cannot delete or truncate document metadata. Existing
service_role indexing and account cleanup remain authorized.

The follow-up also resets client grants on the four other app tables and eleven
views. Workspace CRUD, owner-scoped usage/job reads, and read-only views remain.
Internal AI mappings are service-only. TRUNCATE, which bypasses RLS, is removed
from client grants. This migration changes privileges, not data or RLS policies.

The database fixture now runs every database test under two profiles: broad
Supabase default ALL grants and the actual postgres public defaults from the
user-supplied CSV (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN table grants, no client
sequence grants, and no default client function execution). Both model Storage
table grants and service_role BYPASSRLS. Both migrations execute in one transaction. Before the fix the
original protected-status test failed because the user could mark their document
indexed. After the fix, protected writes, spoofed inserts, owner isolation,
allowed metadata changes, service indexing/deletion, stale column-grant cleanup,
repeat application, anonymous denial and TRUNCATE denial pass.

## Policy review

All five app tables enable RLS. Workspace writes use auth.uid(); document reads,
inserts and permitted updates are owner-scoped. Inserts require stored status,
null provider ID, and matching path prefix. Eleven views use security_invoker.
AI mappings have no client policies. Usage/jobs permit owner-only reads.
Budget reservations use a fixed search_path and service-only EXECUTE.

The bucket is intended to be private, size-limited to 20 MiB. Storage policies
allow owner-prefix reads/inserts/deletes only in engineering-documents; no UPDATE
policy is added. Tests cover foreign prefixes, foreign deletion, other buckets,
and owner replacement denial. Real Storage API behavior remains untested.

The supplied seven-section SQL Editor CSV shows no public tables/views, no
public/Storage policies, no buckets, no document columns, and no memberships for
the client roles. The only public routine is rls_auto_enable, which does not
collide with either new routine. Existing Storage system tables enable RLS and
are preserved. No reported object or bucket conflicts block initial deployment.
The snapshot is metadata evidence, not a live two-user integration test.

The initial bucket INSERT uses ON CONFLICT DO NOTHING; re-review if any bucket,
policy or app object is created after this snapshot. Do not change Supabase
default grants globally or modify its rls_auto_enable routine.

## Checks

- 42 unit/domain/provider/database tests passed across three suites; 28 database
  checks cover both broad defaults and the actual project defaults.
- Strict TypeScript passed.
- Frozen-lockfile Deno checks passed for all three Edge Functions.
- 24 desktop/mobile browser tests passed against the existing dist export.
- No rebuild, migrations, live writes, user creation or Edge Function deployment.

Browser tests establish local workflows only: dist predates the supplied runtime
Supabase configuration. They do not establish live login, sync or document indexing.
Previous dependency advisories and provider/native-device limitations remain;
this focused change is not a clean production security certification.

## Deployment decision and user action

The supplied inventory is compatible with initial database deployment, and both
grant profiles pass. The database migration is ready for explicit approval,
subject to the snapshot remaining current. Full application production readiness
is not established. No administrator credential needs to be shared.

A reviewable SQL Editor bundle is saved as homies-os-database-setup.sql. It wraps
the two unchanged migration files in one BEGIN/COMMIT transaction, so there is
no committed interval exposing the initial broad grants. The inventory summary
and migration/bundle SHA-256 checksums are in live-inventory-summary.json.
Nothing has been applied. SQL Editor application will require the user because
only the publishable API key is available to Codex.

For a confirmed fresh project the proposed database deployment would create five
app tables, eleven owner-isolated views, sync/budget functions, indexes and RLS
policies, plus the private engineering-documents bucket and three Storage policies;
then apply the privilege correction. It does not intentionally remove existing
records. If the initial migration already exists, apply only the correction after
reviewing actual object definitions and migration history.

Explicit approval is pending for database migrations only. No Edge Function or
application deployment is included. Live two-user access, Storage API operations
and authenticated server endpoints require post-migration verification before
claiming the complete cloud application works.

## Database application follow-up

The user ran the reviewed setup transaction in SQL Editor and reported
“Success. No rows returned.” Subsequent GET-only live requests recognize all
five app tables and the tasks view and return HTTP 401 / PostgreSQL 42501
permission denial for anonymous callers. Auth settings still return HTTP 200.
This supports successful object creation and anonymous isolation, but does not
verify authenticated column privileges, two-user RLS or Storage settings live.

All three Edge Function URLs return NOT_FOUND / HTTP 404; they are not deployed.
Further deployment approval remains required. No cloud records were created by
these checks, and no secret credentials were requested.

Manual SQL Editor setup did not populate Supabase CLI migration history. Do not
run db push blindly: it would try to recreate the initial objects. Before using
CLI database migration commands, reconcile history with the applied SQL after
verifying the actual schema. Function deployment does not require db push.
