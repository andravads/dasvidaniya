import { z } from "npm:zod@4.3.6";
import { authenticate, body, json, openai, serve } from "../_shared/runtime.ts";
Deno.serve((req) =>
  serve(async (req) => {
    const { user, admin } = await authenticate(req);
    const { id } = z
      .object({ action: z.literal("index"), id: z.string().uuid() })
      .parse(await body(req));
    const { data: doc, error } = await admin
      .from("documents")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();
    if (error || !doc) throw new Error("Document not found");
    if (!doc.allow_ai)
      throw new Error(
        "Explicit permission to send this document to OpenAI is required",
      );
    if (!/\.(pdf|docx|txt)$/i.test(doc.name))
      throw new Error("AI indexing currently supports PDF, DOCX and TXT only");
    if (doc.status === "indexed") return json({ status: "indexed" });
    const { data: reservation, error: budgetError } = await admin.rpc(
      "reserve_ai_request",
      {
        target_owner: user.id,
        daily_limit: Number(Deno.env.get("AI_DAILY_REQUEST_LIMIT") ?? 20),
        requested_model: "file-index",
      },
    );
    if (budgetError) throw new Error(budgetError.message);
    let fileId = doc.openai_file_id;
    try {
      const { data: existing } = await admin
        .from("ai_spaces")
        .select("vector_store_id")
        .eq("owner_id", user.id)
        .maybeSingle();
      let vector = existing?.vector_store_id;
      if (!vector) {
        const created = await openai("vector_stores", {
          method: "POST",
          body: JSON.stringify({
            name: "Homies private engineering library",
            expires_after: { anchor: "last_active_at", days: 30 },
          }),
        });
        const { error: insertError } = await admin
          .from("ai_spaces")
          .insert({ owner_id: user.id, vector_store_id: created.id });
        if (insertError) {
          await openai("vector_stores/" + created.id, { method: "DELETE" });
          const { data: winning } = await admin
            .from("ai_spaces")
            .select("vector_store_id")
            .eq("owner_id", user.id)
            .single();
          if (!winning) throw insertError;
          vector = winning.vector_store_id;
        } else vector = created.id;
      }
      if (!fileId) {
        const { data: file, error: downloadError } = await admin.storage
          .from("engineering-documents")
          .download(doc.path);
        if (downloadError || !file)
          throw new Error("Could not read private document");
        const form = new FormData();
        form.append("purpose", "assistants");
        form.append("file", file, doc.name);
        const uploaded = await openai("files", { method: "POST", body: form });
        fileId = uploaded.id;
        const { error: writeError } = await admin
          .from("documents")
          .update({ openai_file_id: fileId, status: "processing" })
          .eq("id", doc.id);
        if (writeError) {
          await openai("files/" + fileId, { method: "DELETE" });
          throw writeError;
        }
        await openai(`vector_stores/${vector}/files`, {
          method: "POST",
          body: JSON.stringify({
            file_id: fileId,
            attributes: { doc_id: doc.id },
          }),
        });
      }
      let result = await openai(`vector_stores/${vector}/files/${fileId}`);
      if (result.status === "failed")
        throw new Error(
          "File indexing failed: " +
            (result.last_error?.message ?? "unsupported document"),
        );
      const status = result.status === "completed" ? "indexed" : "processing";
      await admin.from("documents").update({ status }).eq("id", doc.id);
      await admin
        .from("ai_requests")
        .update({ status: "completed" })
        .eq("id", reservation);
      return json({
        status,
        message:
          status === "processing"
            ? "Indexing in progress. Press Index with AI later to check completion."
            : "Ready for source-grounded questions.",
      });
    } catch (e) {
      await admin
        .from("documents")
        .update({ status: "failed" })
        .eq("id", doc.id);
      await admin
        .from("ai_requests")
        .update({ status: "failed", error: (e as Error).message.slice(0, 500) })
        .eq("id", reservation);
      throw e;
    }
  }, req),
);
