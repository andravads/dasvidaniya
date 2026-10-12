import { authenticate, body, json, openai, serve } from "../_shared/runtime.ts";
Deno.serve((req) =>
  serve(async (req) => {
    const { user, admin } = await authenticate(req);
    if ((await body(req)).confirmation !== "DELETE")
      throw new Error("Explicit DELETE confirmation is required");
    const { data: space } = await admin
      .from("ai_spaces")
      .select("vector_store_id")
      .eq("owner_id", user.id)
      .maybeSingle();
    const { data: docs, error } = await admin
      .from("documents")
      .select("openai_file_id")
      .eq("owner_id", user.id);
    if (error) throw error;
    // Purge externally transmitted files before deleting the account. Fail visibly if provider cleanup fails.
    if (space)
      await openai("vector_stores/" + space.vector_store_id, {
        method: "DELETE",
      });
    for (const d of docs ?? [])
      if (d.openai_file_id)
        await openai("files/" + d.openai_file_id, { method: "DELETE" });
    while (true) {
      const { data: objects, error: listError } = await admin.storage
        .from("engineering-documents")
        .list(user.id, { limit: 1000 });
      if (listError) throw listError;
      if (!objects?.length) break;
      const { error: removeError } = await admin.storage
        .from("engineering-documents")
        .remove(objects.map((o) => user.id + "/" + o.name));
      if (removeError) throw removeError;
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return json({ deleted: true });
  }, req),
);
