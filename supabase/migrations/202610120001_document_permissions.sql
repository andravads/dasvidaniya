-- Column grants do not override Supabase's default table-wide grants.
-- Remove both table and column privileges before restoring the client allowlist.
-- This also repairs projects where the initial workspace migration was applied.
revoke all privileges on table public.documents from public, anon, authenticated;
revoke all privileges (id,owner_id,name,path,revision,published_date,classification,allow_ai,mime_type,status,openai_file_id,created_at)
 on table public.documents from public, anon, authenticated;

grant select on public.documents to authenticated;
grant insert(owner_id,name,path,revision,published_date,classification,allow_ai,mime_type,status)
 on public.documents to authenticated;
grant update(allow_ai,classification,revision,published_date)
 on public.documents to authenticated;

-- Server indexing and account cleanup retain their existing access.
grant all on public.documents to service_role;

-- RLS does not protect TRUNCATE. Reset the other new objects' default grants
-- too, then restore only operations the app actually uses.
revoke all privileges on public.workspace_records,public.ai_spaces,
 public.ai_requests,public.background_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.workspace_records to authenticated;
grant select on public.ai_requests,public.background_jobs to authenticated;

revoke all privileges on public.tasks,public.calendar_events,
 public.user_preferences,public.conversations,public.domain_notes,
 public.marketing_campaigns,public.content_drafts,public.investment_watchlists,
 public.owned_cards,public.habit_definitions,public.habit_completions
 from public,anon,authenticated;
grant select on public.tasks,public.calendar_events,
 public.user_preferences,public.conversations,public.domain_notes,
 public.marketing_campaigns,public.content_drafts,public.investment_watchlists,
 public.owned_cards,public.habit_definitions,public.habit_completions
 to authenticated;
