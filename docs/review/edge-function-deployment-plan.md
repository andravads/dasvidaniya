# Existing Edge Function deployment proposal

User reported OPENAI_API_KEY saved in Supabase Edge Functions Secrets. The value
has not been requested, read or verified. Existing function source is unchanged.

Three functions are proposed for project jnuaexajxrudalbcxcii:

- assistant: authenticated personal/engineering chat and proposed internal actions.
- documents: authenticated, explicitly permitted document indexing.
- account: authenticated account deletion requiring confirmation DELETE.

Original and self-contained dashboard copies passed frozen-lockfile Deno checks.
The prepared copies in work/edge-dashboard include the shared runtime unchanged,
so the user can deploy through the dashboard without managing relative files.
No database operations, frontend rebuild, site deployment, new modules, account
creation, AI invocation or document upload is part of this deployment proposal.

Gateway legacy JWT verification is disabled as in existing supabase/config.toml.
Every function authenticates the bearer token through Supabase Auth getUser
before obtaining or using a service-role client. Anonymous requests must return
401 after deployment. CORS preflight does not invoke AI or access user records.

Codex currently has only public client configuration; there is no administrative
Supabase deployment credential or management connector. Use the user's existing
Supabase dashboard session to deploy, with step-by-step guidance after approval.
Do not request an administrator key in chat. Never run db push for this manually
initialized database without first reconciling migration history.

The user explicitly approved deployment of all three helpers by replying Yes.
Approval persists through the dashboard-guided deployment steps; do not ask again
for these same functions. No functions have been deployed by Codex.

Current user action: deploy the prepared assistant code in the Supabase dashboard
editor with function name assistant, then disable legacy gateway JWT verification
as configured. After confirmation, perform an unauthenticated request to verify
HTTP 401 from the function itself before proceeding to the other two functions.

## Assistant deployment check

User reported the assistant deployment step done. Live requests to
/functions/v1/assistant (no-login POST, invalid-login POST, OPTIONS) all returned
HTTP 404 with NOT_FOUND / Requested function was not found. Availability and
authentication enforcement are not verified. No authenticated AI calls or
provider charges were initiated. Stop further helper deployment guidance until
the user confirms the actual function name/project or supplies the function-list
screenshot. Approval for all three existing helpers remains valid.

## Capitalization mismatch identified

User screenshots show the deployed slug is Assistant with uppercase A.
Live probes to /functions/v1/Assistant return HTTP 401 / Authentication required
without login, HTTP 401 / Invalid or expired session for an invalid token, and
HTTP 204 for OPTIONS. Login enforcement and preflight are confirmed at that slug.
The application invokes assistant in lowercase, whose route previously returned
404. Deployment correction remains within the already approved helper scope:
copy the existing code and deploy it under assistant. No frontend modification
or rebuild is needed. Do not claim authenticated AI functionality is verified.
The Supabase function URL is a backend endpoint, not the app's user interface.

Lowercase assistant deployment confirmed: missing/invalid login return 401 from the function and browser preflight returns 204. The older capitalized deployment remains present; it was not deleted. Authenticated AI response remains untested. Proceed with the already approved documents and account deployments.

Documents deployment confirmed: missing/invalid login return 401 from the function and browser preflight returns 204. No uploaded documents, provider indexing or authenticated calls were performed. Proceed with already approved account deployment.

Account deployment confirmed: missing/invalid login return 401 from the function and browser preflight returns 204. All three intended lowercase helpers are deployed. No account deletion or authenticated AI call was performed. App rebuild/hosting approval remains pending.
