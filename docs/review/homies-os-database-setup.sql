-- REVIEWED FRESH-PROJECT DATABASE SETUP. NOT YET APPROVED OR APPLIED.
-- Run the complete file as one transaction; do not run only selected sections.
-- No Edge Functions or application deployment is included.
begin;

-- Migration: 202610090001_workspace.sql
-- Owner isolation applies equally to task data, conversations and private work notes.
create table public.workspace_records (
 owner_id uuid not null references auth.users(id) on delete cascade,
 id text not null check(length(id) between 1 and 256),
 kind text not null check(kind in ('task','event','habit','completion','campaign','draft','watch','card','message','note','audit','preferences')),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=1000000),
 updated_at timestamptz not null default now(), deleted boolean not null default false,
 primary key(owner_id,id)
);
create index workspace_kind_idx on public.workspace_records(owner_id,kind,updated_at);
create index workspace_due_idx on public.workspace_records(owner_id,(payload->>'due')) where kind in ('task','event','draft','campaign') and not deleted;
alter table public.workspace_records enable row level security;
create policy records_owner on public.workspace_records for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
grant select,insert,update,delete on public.workspace_records to authenticated;
create function public.merge_workspace_records(items jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)>10000 then raise exception 'Invalid record batch';end if;
 insert into public.workspace_records(owner_id,id,kind,payload,updated_at,deleted)
 select auth.uid(),x.id,x.kind,x.payload,x.updated_at,coalesce(x.deleted,false)
 from jsonb_to_recordset(items) as x(id text,kind text,payload jsonb,updated_at timestamptz,deleted boolean)
 on conflict(owner_id,id) do update set kind=excluded.kind,payload=excluded.payload,updated_at=excluded.updated_at,deleted=excluded.deleted
 where workspace_records.updated_at<excluded.updated_at;
end;$$;
revoke all on function public.merge_workspace_records(jsonb) from public,anon;
grant execute on function public.merge_workspace_records(jsonb) to authenticated;

-- Typed domain views retain the common record and tombstone semantics.
create view public.tasks with (security_invoker=true) as select owner_id,id,payload->>'title' title,payload->>'domain' domain,payload->>'due' due,payload->>'status' status,payload,updated_at from public.workspace_records where kind='task' and not deleted;
create view public.calendar_events with (security_invoker=true) as select * from public.workspace_records where kind in ('task','event') and not deleted;
create view public.user_preferences with (security_invoker=true) as select * from public.workspace_records where kind='preferences' and not deleted;
create view public.conversations with (security_invoker=true) as select * from public.workspace_records where kind='message' and not deleted;
create view public.domain_notes with (security_invoker=true) as select * from public.workspace_records where kind='note' and not deleted;
create view public.marketing_campaigns with (security_invoker=true) as select * from public.workspace_records where kind='campaign' and not deleted;
create view public.content_drafts with (security_invoker=true) as select * from public.workspace_records where kind='draft' and not deleted;
create view public.investment_watchlists with (security_invoker=true) as select * from public.workspace_records where kind='watch' and not deleted;
create view public.owned_cards with (security_invoker=true) as select * from public.workspace_records where kind='card' and not deleted;
create view public.habit_definitions with (security_invoker=true) as select * from public.workspace_records where kind='habit' and not deleted;
create view public.habit_completions with (security_invoker=true) as select * from public.workspace_records where kind='completion' and not deleted;
grant select on public.tasks,public.calendar_events,public.user_preferences,public.conversations,public.domain_notes,public.marketing_campaigns,public.content_drafts,public.investment_watchlists,public.owned_cards,public.habit_definitions,public.habit_completions to authenticated;

create table public.documents (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 250),path text not null unique,
 revision text not null default '',published_date date,classification text not null check(classification in ('public','internal','confidential')),
 allow_ai boolean not null default false,mime_type text not null,
 status text not null default 'stored' check(status in ('stored','processing','indexed','failed')),
 openai_file_id text,created_at timestamptz not null default now(),
 check(split_part(path,'/',1)=owner_id::text)
);
alter table public.documents enable row level security;
create policy documents_read on public.documents for select to authenticated using(owner_id=auth.uid());
create policy documents_insert on public.documents for insert to authenticated with check(owner_id=auth.uid() and status='stored' and openai_file_id is null);
create policy documents_update on public.documents for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create index documents_owner_idx on public.documents(owner_id,created_at);
grant select on public.documents to authenticated;
grant insert(owner_id,name,path,revision,published_date,classification,allow_ai,mime_type,status) on public.documents to authenticated;
grant update(allow_ai,classification,revision,published_date) on public.documents to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('engineering-documents','engineering-documents',false,20971520,array['application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png','image/webp','application/octet-stream']) on conflict(id) do nothing;
create policy private_docs_read on storage.objects for select to authenticated using(bucket_id='engineering-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy private_docs_insert on storage.objects for insert to authenticated with check(bucket_id='engineering-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy private_docs_delete on storage.objects for delete to authenticated using(bucket_id='engineering-documents' and (storage.foldername(name))[1]=auth.uid()::text);

create table public.ai_spaces(owner_id uuid primary key references auth.users(id) on delete cascade,vector_store_id text not null);
alter table public.ai_spaces enable row level security;
-- Only the authenticated server service-role accesses vector store mappings.
create table public.ai_requests(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),status text not null default 'reserved',model text,input_tokens integer,output_tokens integer,error text);
create index ai_requests_owner_time on public.ai_requests(owner_id,created_at);
alter table public.ai_requests enable row level security;
create policy ai_usage_read on public.ai_requests for select to authenticated using(owner_id=auth.uid());
grant select on public.ai_requests to authenticated;
create function public.reserve_ai_request(target_owner uuid,daily_limit integer,requested_model text) returns uuid language plpgsql security definer set search_path=public as $$
declare request_id uuid;
begin
 perform pg_advisory_xact_lock(hashtext(target_owner::text));
 if daily_limit<1 or daily_limit>100 then raise exception 'Invalid budget';end if;
 if (select count(*) from public.ai_requests where owner_id=target_owner and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=daily_limit then raise exception 'Daily AI request budget reached';end if;
 if (select count(*) from public.ai_requests where owner_id=target_owner and created_at>now()-interval '1 minute')>=5 then raise exception 'Rate limit: wait a minute before trying again';end if;
 insert into public.ai_requests(owner_id,model) values(target_owner,requested_model) returning id into request_id;
 return request_id;
end;$$;
revoke all on function public.reserve_ai_request(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,integer,text) to service_role;

-- Future scheduled-provider jobs: unique idempotency key, retry state and failure logging.
-- No market/calendar jobs are scheduled before a legitimate data provider exists.
create table public.background_jobs(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,kind text not null,idempotency_key text not null,payload jsonb not null default '{}',status text not null default 'pending' check(status in ('pending','running','done','failed')),attempts integer not null default 0,max_attempts integer not null default 3,run_after timestamptz not null default now(),last_error text,unique(owner_id,idempotency_key));
alter table public.background_jobs enable row level security;
create policy jobs_read on public.background_jobs for select to authenticated using(owner_id=auth.uid());
grant select on public.background_jobs to authenticated;
create index jobs_due_idx on public.background_jobs(run_after) where status='pending';

grant all on public.workspace_records,public.documents,public.ai_spaces,public.ai_requests,public.background_jobs to service_role;


-- Migration: 202610120001_document_permissions.sql
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

commit;
