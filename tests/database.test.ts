import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
describe.each(["broad Supabase defaults", "observed homies-os defaults"])(
  "%s",
  (profile) => {
    let db: PGlite;
    beforeAll(async () => {
      db = new PGlite();
      await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 -- Supabase grants these privileges to newly created public objects by default.
 grant usage on schema public to anon,authenticated,service_role;
 ${
   profile === "broad Supabase defaults"
     ? `
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
 alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
 `
     : `
 -- Public defaults for the SQL Editor's postgres creator, from the uploaded CSV.
 alter default privileges in schema public grant truncate,references,trigger,maintain on tables to anon,authenticated,service_role;
 alter default privileges in schema public revoke all on sequences from anon,authenticated,service_role;
 alter default privileges in schema public revoke execute on functions from public,anon,authenticated,service_role;
 `
 }
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated,service_role;grant all on storage.objects to anon,authenticated,service_role;
 create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
 insert into auth.users values('${alice}'),('${bob}');
 `);
      const migrations = readdirSync("supabase/migrations")
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .map((file) => readFileSync(`supabase/migrations/${file}`, "utf8"));
      await db.exec(`begin;\n${migrations.join("\n")}\ncommit;`);
    }, 30000);
    afterAll(async () => {
      await db.close();
    });
    async function asUser(user: string, fn: () => Promise<void>) {
      await db.exec(
        `set role authenticated;set request.jwt.claim.sub='${user}'`,
      );
      try {
        await fn();
      } finally {
        await db.exec("reset role;reset request.jwt.claim.sub");
      }
    }
    it("RLS isolates account records and denies forged owner writes", async () => {
      await asUser(alice, async () => {
        await db.query("select merge_workspace_records($1::jsonb)", [
          JSON.stringify([
            {
              id: "task-a",
              kind: "task",
              payload: { title: "Alice private task" },
              updated_at: "2026-10-09T00:00:00Z",
            },
          ]),
        ]);
      });
      await asUser(bob, async () => {
        const result = await db.query("select * from workspace_records");
        expect(result.rows).toHaveLength(0);
        await expect(
          db.query(
            "insert into workspace_records(owner_id,id,kind,payload) values($1,$2,$3,$4::jsonb)",
            [alice, "forged", "note", "{}"],
          ),
        ).rejects.toThrow(/row-level security|permission denied/);
      });
    });
    it("typed views respect the same owner boundary", async () => {
      await asUser(bob, async () => {
        expect((await db.query("select * from tasks")).rows).toHaveLength(0);
      });
      await asUser(alice, async () => {
        expect((await db.query("select * from tasks")).rows).toHaveLength(1);
      });
    });
    it("sync ignores stale updates and retains newer deletion tombstones", async () => {
      await asUser(alice, async () => {
        await db.query("select merge_workspace_records($1::jsonb)", [
          JSON.stringify([
            {
              id: "task-a",
              kind: "task",
              payload: { title: "Stale title" },
              updated_at: "2026-10-08T00:00:00Z",
            },
          ]),
        ]);
        expect(
          (await db.query<any>("select payload from workspace_records")).rows[0]
            .payload.title,
        ).toBe("Alice private task");
        await db.query("select merge_workspace_records($1::jsonb)", [
          JSON.stringify([
            {
              id: "task-a",
              kind: "task",
              payload: { title: "Deleted" },
              updated_at: "2026-10-10T00:00:00Z",
              deleted: true,
            },
          ]),
        ]);
        expect((await db.query("select * from tasks")).rows).toHaveLength(0);
      });
    });
    it("document and storage policies enforce owner-prefix privacy", async () => {
      await asUser(alice, async () => {
        await db.query(
          `insert into documents(owner_id,name,path,classification,mime_type) values($1,'private.txt',$2,'confidential','text/plain')`,
          [alice, alice + "/private.txt"],
        );
        await db.query(
          `insert into storage.objects(bucket_id,name) values('engineering-documents',$1)`,
          [alice + "/private.txt"],
        );
      });
      await asUser(bob, async () => {
        expect((await db.query("select * from documents")).rows).toHaveLength(
          0,
        );
        expect(
          (await db.query("select * from storage.objects")).rows,
        ).toHaveLength(0);
        await expect(
          db.query(
            `insert into storage.objects(bucket_id,name) values('engineering-documents',$1)`,
            [alice + "/forged.txt"],
          ),
        ).rejects.toThrow(/row-level security|permission denied/);
      });
    });
    it("clients cannot mark documents indexed or bypass AI budgets", async () => {
      await asUser(alice, async () => {
        await expect(
          db.exec("update documents set status='indexed'"),
        ).rejects.toThrow(/permission denied/);
        await expect(
          db.query("select reserve_ai_request($1,100,$2)", [alice, "model"]),
        ).rejects.toThrow(/permission denied/);
      });
    });
    it("server reservations enforce request budgets atomically", async () => {
      const first = await db.query("select reserve_ai_request($1,1,$2)", [
        bob,
        "test-model",
      ]);
      expect(first.rows).toHaveLength(1);
      await expect(
        db.query("select reserve_ai_request($1,1,$2)", [bob, "test-model"]),
      ).rejects.toThrow(/Daily AI request budget/);
    });
    it("anonymous callers cannot sync records", async () => {
      await db.exec("set role anon");
      try {
        await expect(
          db.query("select merge_workspace_records($1::jsonb)", ["[]"]),
        ).rejects.toThrow(/permission denied/);
      } finally {
        await db.exec("reset role");
      }
    });
    it("document permissions allow metadata edits but reject protected fields and deletion", async () => {
      await asUser(alice, async () => {
        await db.exec(
          "update documents set allow_ai=true, classification='internal', revision='B', published_date='2026-10-12'",
        );
        expect(
          (await db.query<any>("select allow_ai,revision from documents"))
            .rows[0],
        ).toMatchObject({ allow_ai: true, revision: "B" });
        for (const assignment of [
          "openai_file_id='file-forged'",
          "name='replaced.txt'",
          "path=path || '.other'",
          "owner_id='22222222-2222-4222-8222-222222222222'",
          "created_at=now()",
          "id=gen_random_uuid()",
        ])
          await expect(
            db.exec(`update documents set ${assignment}`),
          ).rejects.toThrow(/permission denied/);
        await expect(db.exec("delete from documents")).rejects.toThrow(
          /permission denied/,
        );
        await expect(db.exec("truncate documents")).rejects.toThrow(
          /permission denied/,
        );
        await expect(
          db.query(
            "insert into documents(owner_id,name,path,classification,mime_type,status) values($1,'forged.txt',$2,'internal','text/plain','indexed')",
            [alice, alice + "/forged.txt"],
          ),
        ).rejects.toThrow(/row-level security|permission denied/);
        await expect(
          db.query(
            "insert into documents(owner_id,name,path,classification,mime_type,openai_file_id) values($1,'forged.txt',$2,'internal','text/plain','file-forged')",
            [alice, alice + "/forged.txt"],
          ),
        ).rejects.toThrow(/permission denied/);
      });
      await asUser(bob, async () => {
        const result = await db.query(
          "update documents set allow_ai=false returning id",
        );
        expect(result.rows).toHaveLength(0);
        await expect(
          db.query(
            "insert into documents(owner_id,name,path,classification,mime_type) values($1,'forged.txt',$2,'internal','text/plain')",
            [alice, alice + "/bob.txt"],
          ),
        ).rejects.toThrow(/row-level security|permission denied/);
      });
    });
    it("service role can index documents and delete metadata", async () => {
      await db.exec("set role service_role");
      try {
        const result = await db.query(
          "update documents set status='indexed',openai_file_id='file-server' returning id",
        );
        expect(result.rows).toHaveLength(1);
        await db.query(
          "insert into documents(owner_id,name,path,classification,mime_type) values($1,'server.txt',$2,'internal','text/plain')",
          [bob, bob + "/server.txt"],
        );
        expect(
          (
            await db.query(
              "delete from documents where owner_id=$1 returning id",
              [bob],
            )
          ).rows,
        ).toHaveLength(1);
      } finally {
        await db.exec("reset role");
      }
    });
    it("anonymous document access and writes are denied", async () => {
      await db.exec("set role anon");
      try {
        for (const sql of [
          "select * from documents",
          "update documents set allow_ai=true",
          "delete from documents",
          "truncate documents",
        ])
          await expect(db.exec(sql)).rejects.toThrow(/permission denied/);
      } finally {
        await db.exec("reset role");
      }
    });
    it("Storage rejects foreign deletion, object replacement and other buckets", async () => {
      await asUser(bob, async () => {
        expect(
          (
            await db.query(
              "delete from storage.objects where bucket_id='engineering-documents' returning id",
            )
          ).rows,
        ).toHaveLength(0);
        await expect(
          db.query(
            "insert into storage.objects(bucket_id,name) values('other-bucket',$1)",
            [bob + "/private.txt"],
          ),
        ).rejects.toThrow(/row-level security|permission denied/);
      });
      await asUser(alice, async () => {
        expect(
          (
            await db.query(
              "update storage.objects set name=name || '.replacement' returning id",
            )
          ).rows,
        ).toHaveLength(0);
        expect(
          (
            await db.query(
              "delete from storage.objects where bucket_id='engineering-documents' returning id",
            )
          ).rows,
        ).toHaveLength(1);
      });
    });
    it("internal mappings and job/budget writes stay server-only despite default grants", async () => {
      await asUser(alice, async () => {
        await expect(db.query("select * from ai_spaces")).rejects.toThrow(
          /permission denied/,
        );
        await expect(
          db.query(
            "insert into ai_spaces(owner_id,vector_store_id) values($1,'forged')",
            [alice],
          ),
        ).rejects.toThrow(/row-level security|permission denied/);
        await expect(
          db.query("insert into ai_requests(owner_id) values($1)", [alice]),
        ).rejects.toThrow(/row-level security|permission denied/);
        await expect(
          db.query(
            "insert into background_jobs(owner_id,kind,idempotency_key) values($1,'forged','forged')",
            [alice],
          ),
        ).rejects.toThrow(/row-level security|permission denied/);
      });
    });
    it("corrective migration removes stale column grants and is safe to rerun", async () => {
      await db.exec(
        "grant update(status) on documents to authenticated;grant select(id) on documents to anon",
      );
      await db.exec(
        readFileSync(
          "supabase/migrations/202610120001_document_permissions.sql",
          "utf8",
        ),
      );
      await asUser(alice, async () => {
        await expect(
          db.exec("update documents set status='indexed'"),
        ).rejects.toThrow(/permission denied/);
        await db.exec("update documents set revision='C'");
      });
      await db.exec("set role anon");
      try {
        await expect(db.exec("select id from documents")).rejects.toThrow(
          /permission denied/,
        );
      } finally {
        await db.exec("reset role");
      }
    });

    it("default TRUNCATE grants cannot bypass RLS on app tables", async () => {
      await asUser(alice, async () => {
        for (const table of [
          "workspace_records",
          "documents",
          "ai_spaces",
          "ai_requests",
          "background_jobs",
        ])
          await expect(db.exec(`truncate ${table}`)).rejects.toThrow(
            /permission denied/,
          );
      });
    });
  },
);
