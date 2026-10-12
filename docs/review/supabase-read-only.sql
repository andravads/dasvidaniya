-- Run in Supabase SQL Editor. This only reads configuration/catalog metadata.
-- It does not read uploaded documents, workspace records, user accounts or keys.
begin transaction read only;

-- 1. Existing tables/views, owners, RLS flags and security-invoker options.
select n.nspname as schema_name,c.relname as object_name,c.relkind,
 pg_get_userbyid(c.relowner) as owner,c.relrowsecurity as rls_enabled,
 c.relforcerowsecurity as force_rls,c.reloptions
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage','supabase_migrations')
 and c.relkind in ('r','p','v','m','f')
order by 1,2;

-- 2. ALL public/Storage policies: permissive policies combine with OR.
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage')
order by schemaname,tablename,policyname;

-- 3. Bucket settings only, without listing objects or file contents.
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets order by id;

-- 4. Effective table privileges, including inherited/PUBLIC permissions.
select c.relname,r.role_name,p.privilege,
 has_table_privilege(r.role_name,c.oid,p.privilege) as allowed
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values ('anon'),('authenticated'),('service_role')) r(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege)
where n.nspname='public' and c.relkind in ('r','p','v')
order by 1,2,3;

-- 5. Effective document-column privileges (empty if documents does not exist).
select a.attname as column_name,r.role_name,p.privilege,
 has_column_privilege(r.role_name,c.oid,a.attnum,p.privilege) as allowed
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
cross join (values ('anon'),('authenticated'),('service_role')) r(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(privilege)
where n.nspname='public' and c.relname='documents'
order by a.attnum,2,3;

-- 6. Default grants and role inheritance, without authentication secrets.
select pg_get_userbyid(d.defaclrole) as creator,
 coalesce(n.nspname,'ALL SCHEMAS') as schema_name,
 d.defaclobjtype,d.defaclacl
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
order by 1,2,3;
select parent.rolname as inherited_role,member.rolname as member_role
from pg_auth_members m join pg_roles parent on parent.oid=m.roleid
join pg_roles member on member.oid=m.member
where member.rolname in ('anon','authenticated','service_role');

-- 7. Existing public routines and their effective client execution grants.
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,
 p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by 1,2;

-- 8. Existing public triggers and constraints relevant to migration conflicts.
select c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal order by 1,2;
select c.relname,k.conname,pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' order by 1,2;

commit;
