import React, { useEffect, useState } from "react";
import { View, Switch, Pressable, Linking, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import {
  Badge,
  Button,
  Card,
  Choice,
  Empty,
  Field,
  Label,
  Row,
  Title,
  styles,
  useColors,
  Busy,
  Disclosure,
} from "../components/UI";
import { TaskEditor } from "../components/TaskEditor";
import { CarouselStudio } from "../components/CarouselStudio";
import { TaskRow } from "../components/Tasks";
import { useItems, useStore } from "../state/Store";
import {
  Domain,
  domains,
  domainLabels,
  dayInZone,
  habitStreak,
  RecordItem,
  taskSchema,
} from "../lib/domain";
import { invoke, supabase } from "../lib/backend";

export default function Workspace() {
  const params = useLocalSearchParams();
  const [domain, setDomain] = useState<Domain>("engineering");
  useEffect(() => {
    if (domains.includes(params.domain as Domain))
      setDomain(params.domain as Domain);
  }, [params.domain]);
  return (
    <View style={styles.page}>
      <View>
        <Label small muted>
          SIX WORLDS, ONE WORKSPACE
        </Label>
        <Title>Your workspace</Title>
        <Label muted>
          Keep the details here. Bring the priorities to your day.
        </Label>
      </View>
      <Choice
        options={domains}
        labels={domainLabels}
        value={domain}
        onChange={(v) => setDomain(v as Domain)}
      />
      <Row>
        <Label style={{ fontSize: 23, fontWeight: "600" }}>
          {domainLabels[domain]}
        </Label>
        <Badge>
          {domain === "engineering"
            ? "PRIVATE WORK DOMAIN"
            : "PERSONAL WORKSPACE"}
        </Badge>
      </Row>
      {domain === "engineering" ? (
        <Engineering />
      ) : domain === "gainsip" ? (
        <Gainsip />
      ) : domain === "content" ? (
        <Content />
      ) : domain === "investments" ? (
        <Investments />
      ) : domain === "tcg" ? (
        <Cards />
      ) : (
        <Habits />
      )}
      <DomainTasks domain={domain} />
    </View>
  );
}
function DomainTasks({ domain }: { domain: Domain }) {
  const tasks = useItems("task").filter((r) => r.payload.domain === domain);
  const [open, setOpen] = useState(false),
    [record, setRecord] = useState<RecordItem>();
  return (
    <Card>
      <Row>
        <Label style={styles.heading}>Workspace tasks</Label>
        <Button
          secondary
          onPress={() => {
            setRecord(undefined);
            setOpen(true);
          }}
        >
          Add task
        </Button>
      </Row>
      {tasks.length ? (
        tasks.map((t) => (
          <TaskRow
            key={t.id}
            record={t}
            onEdit={(r) => {
              setRecord(r);
              setOpen(true);
            }}
          />
        ))
      ) : (
        <Empty text="No tasks in this workspace yet." />
      )}
      <TaskEditor
        visible={open}
        onClose={() => setOpen(false)}
        record={record}
        domain={domain}
      />
    </Card>
  );
}
function Engineering() {
  const { put, session } = useStore(),
    c = useColors();
  const local = useItems("note").filter((r) => r.payload.type === "document");
  const [docs, setDocs] = useState<any[]>([]),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<any[]>([]),
    [revision, setRevision] = useState(""),
    [published, setPublished] = useState(""),
    [classification, setClassification] = useState("confidential"),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  const notes = useItems("note").filter(
    (r) => r.payload.type === "engineering-note",
  );
  const refresh = async () => {
    if (session && supabase) {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      else setDocs(data ?? []);
    }
  };
  useEffect(() => {
    void refresh();
  }, [session?.user.id]);
  const upload = async () => {
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: [
          "application/pdf",
          "text/plain",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "image/*",
        ],
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.size ?? 0) > 20 * 1024 * 1024)
        throw new Error("Choose a file smaller than 20 MB.");
      setBusy(true);
      const buffer =
        Platform.OS === "web" && asset.file
          ? await asset.file.arrayBuffer()
          : await new File(asset.uri).arrayBuffer();
      if (buffer.byteLength > 20 * 1024 * 1024)
        throw new Error("File exceeds 20 MB.");
      const isText = asset.name.toLowerCase().endsWith(".txt");
      if (session && supabase) {
        const safe = asset.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${session.user.id}/${Date.now()}-${safe}`;
        const { error: uploadError } = await supabase.storage
          .from("engineering-documents")
          .upload(path, buffer, {
            contentType: asset.mimeType ?? "application/octet-stream",
            upsert: false,
          });
        if (uploadError) throw uploadError;
        const { error: dbError } = await supabase.from("documents").insert({
          owner_id: session.user.id,
          name: asset.name,
          path,
          revision,
          published_date: published || null,
          classification,
          allow_ai: consent,
          mime_type: asset.mimeType ?? "application/octet-stream",
          status: "stored",
        });
        if (dbError) {
          await supabase.storage.from("engineering-documents").remove([path]);
          throw dbError;
        }
        await refresh();
      } else {
        if (!isText)
          throw new Error(
            "Local retrieval supports TXT only. Sign in to store PDF, DOCX, XLSX or images privately.",
          );
        const text = new TextDecoder().decode(buffer);
        put("note", {
          type: "document",
          domain: "engineering",
          name: asset.name,
          text: text.slice(0, 500000),
          revision,
          published,
          classification,
          allow_ai: false,
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 16 }}>
      <Card>
        <Badge>ENGINEERING SUPPORT ONLY</Badge>
        <Label small muted>
          Use current approved maintenance data and qualified engineering
          review. Homies never substitutes for approved manuals or
          authorizations. Work documents are excluded from general-purpose AI
          chat.
        </Label>
      </Card>
      <Card>
        <Label style={styles.heading}>Authorized knowledge library</Label>
        <Label muted>
          Import documents you have permission to use. No automatic access to
          ChatGPT Projects or memory.
        </Label>
        <Field
          label="Document revision"
          value={revision}
          onChangeText={setRevision}
        />
        <Field
          label="Publication date (YYYY-MM-DD, optional)"
          value={published}
          onChangeText={setPublished}
        />
        <Choice
          options={["confidential", "internal", "public"]}
          value={classification}
          onChange={(v) => {
            setClassification(v);
            setConsent(false);
          }}
        />
        <Row>
          <Label style={{ flex: 1 }}>
            I authorize this document to be sent to OpenAI for indexing
          </Label>
          <Switch
            accessibilityLabel="Authorize external AI indexing"
            value={consent}
            onValueChange={setConsent}
          />
        </Row>
        <Label small muted>
          Private storage is separate from indexing. AI indexing only happens
          when you explicitly press “Index with AI” after upload. XLSX and
          images can be stored but AI extraction is not implemented.
        </Label>
        <Button disabled={busy} onPress={() => void upload()}>
          Upload authorized document
        </Button>
        {busy && <Busy />}
        {!!error && <Label style={{ color: c.danger }}>{error}</Label>}
        {[
          ...local.map((r) => ({
            ...r.payload,
            id: r.id,
            status: "local TXT · keyword search only",
          })),
          ...docs,
        ].map((d) => (
          <Card key={d.id} style={{ backgroundColor: c.bg }}>
            <Row>
              <View style={{ flex: 1 }}>
                <Label>{d.name}</Label>
                <Label small muted>
                  Rev {d.revision || "not supplied"} · {d.classification} ·{" "}
                  {d.status}
                </Label>
              </View>
              <Badge>{d.allow_ai ? "AI AUTHORIZED" : "LOCAL / PRIVATE"}</Badge>
            </Row>
            {session && docs.some((doc) => doc.id === d.id) && (
              <Button
                secondary
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const { error: permissionError } = await supabase!
                      .from("documents")
                      .update({ allow_ai: !d.allow_ai })
                      .eq("id", d.id);
                    if (permissionError) throw permissionError;
                    await refresh();
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {d.allow_ai
                  ? "Revoke AI retrieval permission"
                  : "Authorize OpenAI indexing"}
              </Button>
            )}
            {session && d.openai_file_id && !d.allow_ai && (
              <Label small muted>
                Retrieval is disabled. Previously indexed copies remain at
                OpenAI until account deletion or provider retention expiry.
              </Label>
            )}
            {session && d.allow_ai && d.status !== "indexed" && (
              <Button
                secondary
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await invoke("documents", { action: "index", id: d.id });
                    await refresh();
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Index with AI
              </Button>
            )}
          </Card>
        ))}
        <Field
          label="Keyword search in local TXT documents"
          value={query}
          onChangeText={setQuery}
        />
        <Button
          secondary
          onPress={() => {
            const words = query.toLowerCase().split(/\s+/).filter(Boolean);
            setResults(
              words.length
                ? local
                    .filter((r) =>
                      words.every((w) =>
                        r.payload.text.toLowerCase().includes(w),
                      ),
                    )
                    .map((r) => {
                      const at = r.payload.text.toLowerCase().indexOf(words[0]);
                      return {
                        name: r.payload.name,
                        revision: r.payload.revision,
                        excerpt: r.payload.text.slice(
                          Math.max(0, at - 100),
                          at + 650,
                        ),
                      };
                    })
                : [],
            );
          }}
        >
          Search documents
        </Button>
        {results.map((r, i) => (
          <Card key={i}>
            <Label>
              {r.name} · revision {r.revision || "unknown"}
            </Label>
            <Label small>{r.excerpt}</Label>
            <Badge>USER DOCUMENT EXCERPT · REVISION NOT VERIFIED</Badge>
          </Card>
        ))}
        <Label small muted>
          For source-grounded AI questions, index an authorized PDF/DOCX/TXT and
          choose Engineering mode in AI Chat. Image OCR, XLSX semantic search
          and local semantic search are pending.
        </Label>
      </Card>
      <Card>
        <Label style={styles.heading}>Private engineering notes / import</Label>
        <Field
          label="Engineering note or authorized conversation excerpt"
          value={note}
          onChangeText={setNote}
          multiline
        />
        <Button
          secondary
          disabled={!note.trim()}
          onPress={() => {
            put("note", {
              type: "engineering-note",
              domain: "engineering",
              text: note,
              classification: "confidential",
            });
            setNote("");
          }}
        >
          Save private note
        </Button>
        {notes.map((n) => (
          <Label key={n.id} small>
            {n.payload.text}
          </Label>
        ))}
      </Card>
    </View>
  );
}
function Gainsip() {
  const { put, prefs, saveTask } = useStore(),
    c = useColors();
  const campaigns = useItems("campaign");
  const notes = useItems("note");
  const config = notes.find((r) => r.id === "gainsip-profile")?.payload ?? {};
  const sales = notes.filter((r) => r.payload.type === "sale");
  const [product, setProduct] = useState(config.products ?? ""),
    [price, setPrice] = useState(String(config.price ?? "")),
    [audience, setAudience] = useState(config.audience ?? ""),
    [channels, setChannels] = useState(config.channels ?? ""),
    [title, setTitle] = useState(""),
    [hypothesis, setHypothesis] = useState(""),
    [budget, setBudget] = useState("0"),
    [due, setDue] = useState(dayInZone(new Date(), prefs.timezone)),
    [inquiries, setInquiries] = useState("0"),
    [orders, setOrders] = useState("0"),
    [revenue, setRevenue] = useState("0"),
    [error, setError] = useState("");
  const totalOrders = sales.reduce((n, r) => n + r.payload.orders, 0),
    totalRevenue = sales.reduce((n, r) => n + r.payload.revenue, 0),
    totalInquiries = sales.reduce((n, r) => n + r.payload.inquiries, 0);
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.grid}>
        {[
          { name: "Recorded orders", value: totalOrders },
          {
            name: "Recorded revenue · IDR",
            value: totalRevenue.toLocaleString("id-ID"),
          },
          {
            name: "Inquiry conversion",
            value: totalInquiries
              ? `${((totalOrders / totalInquiries) * 100).toFixed(1)}%`
              : "No inquiries recorded",
          },
        ].map((x) => (
          <Card key={x.name} style={styles.grow}>
            <Label muted small>
              {x.name}
            </Label>
            <Label style={{ fontSize: 24, fontWeight: "600" }}>{x.value}</Label>
          </Card>
        ))}
      </View>
      <Card>
        <Label style={styles.heading}>Tell Homies about Gainsip</Label>
        <Field
          label="Products / services"
          value={product}
          onChangeText={setProduct}
        />
        <Field
          label="Price or pricing notes"
          value={price}
          onChangeText={setPrice}
        />
        <Field
          label="Target customer"
          value={audience}
          onChangeText={setAudience}
        />
        <Field
          label="Distribution and marketing channels"
          value={channels}
          onChangeText={setChannels}
        />
        <Button
          secondary
          onPress={() =>
            put(
              "note",
              {
                type: "business-profile",
                domain: "gainsip",
                products: product,
                price,
                audience,
                channels,
              },
              "gainsip-profile",
            )
          }
        >
          Save business profile
        </Button>
      </Card>
      <Card>
        <Label style={styles.heading}>Plan a measurable experiment</Label>
        <Field label="Campaign name" value={title} onChangeText={setTitle} />
        <Field
          label="Hypothesis and success measure"
          value={hypothesis}
          onChangeText={setHypothesis}
          multiline
        />
        <Field
          label="Marketing budget (IDR)"
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
        />
        <Field
          label="Campaign date (YYYY-MM-DD)"
          value={due}
          onChangeText={setDue}
        />
        <Button
          disabled={!title.trim()}
          onPress={() => {
            try {
              if (!Number.isFinite(Number(budget)) || Number(budget) < 0)
                throw new Error("Enter a nonnegative budget");
              taskSchema.parse({ title, domain: "gainsip", due });
              put("campaign", {
                title,
                hypothesis,
                budget: Number(budget),
                due,
                status: "Planned",
                results: "",
              });
              setTitle("");
              setError("");
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          Create campaign
        </Button>
        {!!error && <Label style={{ color: c.danger }}>{error}</Label>}
        {campaigns.map((r) => (
          <Card key={r.id} style={{ backgroundColor: c.bg }}>
            <Row>
              <Label style={{ fontWeight: "600" }}>{r.payload.title}</Label>
              <Badge>{r.payload.status}</Badge>
            </Row>
            <Label small>{r.payload.hypothesis}</Label>
            <Label small muted>
              {r.payload.due} · Budget Rp{" "}
              {r.payload.budget.toLocaleString("id-ID")}
            </Label>
            <Choice
              options={["Planned", "Running", "Reviewed"]}
              value={r.payload.status}
              onChange={(status) =>
                put("campaign", { ...r.payload, status }, r.id)
              }
            />
            <Field
              label={"Observed results: " + r.payload.title}
              value={r.payload.results ?? ""}
              onChangeText={(results) =>
                put("campaign", { ...r.payload, results }, r.id)
              }
            />
            <Button
              secondary
              onPress={() => {
                try {
                  useCalendarCampaign(r);
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              Add review to calendar
            </Button>
          </Card>
        ))}
      </Card>
      <Card>
        <Label style={styles.heading}>Manual performance record</Label>
        <Field
          label="Inquiries"
          value={inquiries}
          onChangeText={setInquiries}
          keyboardType="numeric"
        />
        <Field
          label="Orders"
          value={orders}
          onChangeText={setOrders}
          keyboardType="numeric"
        />
        <Field
          label="Revenue (IDR)"
          value={revenue}
          onChangeText={setRevenue}
          keyboardType="numeric"
        />
        <Button
          secondary
          onPress={() => {
            const numbers = [inquiries, orders, revenue].map(Number);
            if (
              numbers.some((n) => !Number.isFinite(n) || n < 0) ||
              !Number.isInteger(numbers[0]) ||
              !Number.isInteger(numbers[1])
            ) {
              setError("Enter nonnegative counts and revenue.");
              return;
            }
            put("note", {
              type: "sale",
              domain: "gainsip",
              inquiries: numbers[0],
              orders: numbers[1],
              revenue: numbers[2],
              day: dayInZone(new Date(), prefs.timezone),
            });
            setInquiries("0");
            setOrders("0");
            setRevenue("0");
          }}
        >
          Save record
        </Button>
        <Label small muted>
          Observed data is manually entered. No storefront or analytics account
          is connected.
        </Label>
      </Card>
    </View>
  );
  function useCalendarCampaign(r: RecordItem) {
    const value = taskSchema.parse({
      title: "Review Gainsip campaign: " + r.payload.title,
      domain: "gainsip",
      due: r.payload.due,
      time: "17:00",
    });
    saveTask(value, "campaign-task:" + r.id);
  }
}
const accounts = ["TikTok · Working tips", "TikTok · Gym", "Instagram · Gym"];
const pipeline = [
  "Idea",
  "Draft",
  "Editing",
  "Ready",
  "Scheduled",
  "Published",
];
function Content() {
  const { prefs, put, saveCaption, saveTask, session } = useStore(),
    c = useColors();
  const drafts = useItems("draft");
  const [account, setAccount] = useState(accounts[1]),
    [topic, setTopic] = useState(""),
    [text, setText] = useState(""),
    [language, setLanguage] = useState("Indonesian"),
    [tone, setTone] = useState("Friendly and practical"),
    [due, setDue] = useState(dayInZone(new Date(), prefs.timezone)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <View style={{ gap: 16 }}>
      <CarouselStudio key={session?.user.id ?? "local"} />
      <Disclosure title="Write a draft manually">
        <Label style={styles.heading}>Create something worth sharing</Label>
        <Choice options={accounts} value={account} onChange={setAccount} />
        <Field label="Content topic" value={topic} onChangeText={setTopic} />
        <Choice
          options={["Indonesian", "English", "Mixed"]}
          value={language}
          onChange={setLanguage}
        />
        <Field
          label="Caption tone / target audience"
          value={tone}
          onChangeText={setTone}
        />
        <Button
          disabled={busy || !topic.trim()}
          onPress={async () => {
            setBusy(true);
            setError("");
            try {
              await saveCaption(topic, account, language, tone);
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Generate AI caption
        </Button>
        {busy && <Busy />}
        <Field
          label="Your caption or content idea"
          value={text}
          onChangeText={setText}
          multiline
        />
        <Field
          label="Content date (YYYY-MM-DD)"
          value={due}
          onChangeText={setDue}
        />
        <Button
          secondary
          disabled={!topic.trim() || !text.trim()}
          onPress={() => {
            try {
              taskSchema.parse({ title: topic, domain: "content", due });
              put("draft", {
                title: topic,
                text,
                account,
                due,
                status: "Draft",
                metrics: {},
              });
              setTopic("");
              setText("");
              setError("");
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          Save draft
        </Button>
        {!!error && <Label style={{ color: c.danger }}>{error}</Label>}
        <Label small muted>
          No social accounts are connected. Scheduling creates a local calendar
          task; publishing is manual.
        </Label>
      </Disclosure>
      {drafts
        .filter((r) => r.payload.account === account)
        .map((r) => (
          <Card key={r.id}>
            <Row>
              <Label style={styles.heading}>{r.payload.title}</Label>
              <Badge>{r.payload.status}</Badge>
            </Row>
            <Label small muted>
              {r.payload.account} · {r.payload.due}
            </Label>
            <Field
              label={"Caption: " + r.payload.title}
              value={r.payload.text}
              onChangeText={(text) =>
                put("draft", { ...r.payload, text }, r.id)
              }
              multiline
            />
            <Choice
              options={pipeline.filter((v) => v !== "Published")}
              value={r.payload.status}
              onChange={(status) =>
                put("draft", { ...r.payload, status }, r.id)
              }
            />
            <Button
              secondary
              onPress={() => {
                try {
                  saveTask(
                    taskSchema.parse({
                      title: "Prepare / manually publish: " + r.payload.title,
                      domain: "content",
                      due: r.payload.due,
                      time: "18:00",
                    }),
                    "draft-task:" + r.id,
                  );
                  put("draft", { ...r.payload, status: "Scheduled" }, r.id);
                  setError("");
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              Add to content calendar
            </Button>
            <Button
              secondary
              onPress={() =>
                put(
                  "draft",
                  {
                    ...r.payload,
                    status: "Published",
                    publishedManuallyAt: new Date().toISOString(),
                  },
                  r.id,
                )
              }
            >
              I published this manually
            </Button>
            <Field
              label={"Recorded views: " + r.payload.title}
              value={String(r.payload.metrics?.views ?? "")}
              keyboardType="numeric"
              onChangeText={(v) => {
                if (/^\d*$/.test(v))
                  put(
                    "draft",
                    {
                      ...r.payload,
                      metrics: {
                        ...r.payload.metrics,
                        views: v ? Number(v) : null,
                      },
                    },
                    r.id,
                  );
              }}
            />
            <Label small muted>
              Metrics are user-entered. No automatic publishing or analytics.
            </Label>
          </Card>
        ))}
    </View>
  );
}
function Investments() {
  const { put, remove } = useStore(),
    c = useColors();
  const watches = useItems("watch");
  const [ticker, setTicker] = useState(""),
    [exchange, setExchange] = useState("IDX"),
    [quantity, setQuantity] = useState(""),
    [cost, setCost] = useState(""),
    [error, setError] = useState("");
  return (
    <View style={{ gap: 16 }}>
      <Card>
        <Badge>MARKET DATA NOT CONNECTED</Badge>
        <Label>Research without invented numbers.</Label>
        <Label small muted>
          Your watchlist reflects interests, not holdings. Ticker identities
          require verification against a configured licensed provider. Prices,
          market summaries, charts and trading-day briefings are unavailable.
          Homies never executes trades.
        </Label>
      </Card>
      <Card>
        <Label style={styles.heading}>Add a watchlist interest</Label>
        <Field label="Ticker" value={ticker} onChangeText={setTicker} />
        <Choice
          options={["IDX", "US"]}
          value={exchange}
          onChange={setExchange}
        />
        <Button
          secondary
          disabled={!/^[A-Za-z0-9.-]{1,15}$/.test(ticker)}
          onPress={() => {
            put(
              "watch",
              {
                ticker: ticker.trim().toUpperCase(),
                exchange,
                verified: false,
              },
              exchange + "-" + ticker.trim().toUpperCase(),
            );
            setTicker("");
          }}
        >
          Add ticker
        </Button>
      </Card>
      {["IDX", "US"].map((m) => (
        <Card key={m}>
          <Label style={styles.heading}>
            {m === "IDX" ? "Indonesian equities" : "US / global technology"}
          </Label>
          {watches
            .filter((r) => r.payload.exchange === m)
            .map((r) => (
              <Row key={r.id}>
                <View style={{ flex: 1 }}>
                  <Label style={{ fontWeight: "600" }}>
                    {r.payload.ticker}
                  </Label>
                  <Label small muted>
                    Unverified interest · quote unavailable
                  </Label>
                </View>
                <Badge>NO PROVIDER</Badge>
                <Button secondary onPress={() => remove(r.id)}>
                  Remove
                </Button>
              </Row>
            ))}
        </Card>
      ))}
      <Card>
        <Label style={styles.heading}>Record holdings manually</Label>
        <Field label="Holding ticker" value={ticker} onChangeText={setTicker} />
        <Field
          label="Quantity owned"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />
        <Field
          label={
            "Purchase cost per share (" +
            (exchange === "IDX" ? "IDR" : "USD") +
            ")"
          }
          value={cost}
          onChangeText={setCost}
          keyboardType="numeric"
        />
        <Button
          secondary
          onPress={() => {
            if (
              !/^[A-Za-z0-9.-]{1,15}$/.test(ticker) ||
              !quantity ||
              !cost ||
              ![Number(quantity), Number(cost)].every(
                (n) => Number.isFinite(n) && n >= 0,
              )
            ) {
              setError("Enter a valid ticker, quantity and cost.");
              return;
            }
            put("note", {
              type: "holding",
              domain: "investments",
              ticker: ticker.toUpperCase(),
              exchange,
              quantity: Number(quantity),
              cost: Number(cost),
              currency: exchange === "IDX" ? "IDR" : "USD",
            });
            setError("");
            setQuantity("");
            setCost("");
          }}
        >
          Save holding
        </Button>
        {!!error && <Label style={{ color: c.danger }}>{error}</Label>}
        {useItems("note")
          .filter((r) => r.payload.type === "holding")
          .map((r) => (
            <Label key={r.id} small>
              {r.payload.ticker}: {r.payload.quantity} shares · recorded cost{" "}
              {r.payload.currency} {r.payload.cost} · current value unavailable
            </Label>
          ))}
      </Card>
    </View>
  );
}
function Cards() {
  const { put } = useStore(),
    c = useColors();
  const cards = useItems("card");
  const [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [variant, setVariant] = useState(""),
    [language, setLanguage] = useState("Japanese"),
    [condition, setCondition] = useState("Near mint"),
    [grade, setGrade] = useState("Ungraded"),
    [quantity, setQuantity] = useState("1"),
    [purchase, setPurchase] = useState(""),
    [price, setPrice] = useState(""),
    [source, setSource] = useState(""),
    [currency, setCurrency] = useState("JPY"),
    [error, setError] = useState("");
  return (
    <View style={{ gap: 16 }}>
      <Card>
        <Badge>MANUAL COLLECTION · NO PRICING FEED</Badge>
        <Label small muted>
          SNKRDUNK is not connected. Enter exact variants and prices yourself.
          Card photo recognition, catalog matching and camera identification are
          not implemented; printed codes alone do not identify alternate art.
        </Label>
      </Card>
      <Card>
        <Label style={styles.heading}>Add a confirmed card</Label>
        <Field
          label="Printed card code (e.g. OP01-001)"
          value={code}
          onChangeText={setCode}
        />
        <Field
          label="Card / character name"
          value={name}
          onChangeText={setName}
        />
        <Field
          label="Variant / set / rarity / promo edition"
          value={variant}
          onChangeText={setVariant}
        />
        <Choice
          options={["Japanese", "English", "Other"]}
          value={language}
          onChange={setLanguage}
        />
        <Field
          label="Condition"
          value={condition}
          onChangeText={setCondition}
        />
        <Field label="Grading status" value={grade} onChangeText={setGrade} />
        <Field
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />
        <Choice
          options={["JPY", "USD", "IDR"]}
          value={currency}
          onChange={setCurrency}
        />
        <Field
          label="Purchase price per card (optional)"
          value={purchase}
          onChangeText={setPurchase}
          keyboardType="numeric"
        />
        <Field
          label="Observed price per card (optional)"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />
        <Field
          label="Price source / listing versus completed sale"
          value={source}
          onChangeText={setSource}
        />
        <Button
          disabled={!code.trim() || !name.trim() || !variant.trim()}
          onPress={() => {
            if (
              !Number.isInteger(Number(quantity)) ||
              Number(quantity) < 1 ||
              [purchase, price]
                .filter(Boolean)
                .some((v) => !Number.isFinite(Number(v)) || Number(v) < 0) ||
              (!!price && !source.trim())
            ) {
              setError(
                "Enter a positive integer quantity, nonnegative prices and a source for any observed price.",
              );
              return;
            }
            put("card", {
              code: code.trim().toUpperCase(),
              name,
              variant,
              language,
              condition,
              grade,
              quantity: Number(quantity),
              purchase: purchase ? Number(purchase) : null,
              currency,
              prices: price
                ? [
                    {
                      price: Number(price),
                      source,
                      timestamp: new Date().toISOString(),
                      type: "user-entered",
                    },
                  ]
                : [],
            });
            setCode("");
            setName("");
            setVariant("");
            setError("");
          }}
        >
          Confirm variant & add card
        </Button>
        {!!error && <Label style={{ color: c.danger }}>{error}</Label>}
      </Card>
      {cards.map((r) => (
        <Card key={r.id}>
          <Row>
            <Label style={styles.heading}>{r.payload.name}</Label>
            <Badge>{r.payload.code}</Badge>
          </Row>
          <Label small muted>
            {r.payload.variant} · {r.payload.language} · {r.payload.condition} ·{" "}
            {r.payload.grade} · Qty {r.payload.quantity}
          </Label>
          <Label>
            {r.payload.prices.length
              ? `${r.payload.currency} ${r.payload.prices.at(-1).price} · user-entered observation`
              : "Market value unavailable"}
          </Label>
          {r.payload.prices.length > 0 && (
            <Label small muted>
              Source: {r.payload.prices.at(-1).source} ·{" "}
              {r.payload.prices.at(-1).timestamp}
            </Label>
          )}
          <Field
            label={"New observed price: " + r.payload.name}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
          <Field
            label={"New price source: " + r.payload.name}
            value={source}
            onChangeText={setSource}
          />
          <Button
            secondary
            onPress={() => {
              if (
                !price ||
                !source.trim() ||
                !Number.isFinite(Number(price)) ||
                Number(price) < 0
              ) {
                setError("Provide a valid observed price and source.");
                return;
              }
              put(
                "card",
                {
                  ...r.payload,
                  prices: [
                    ...r.payload.prices,
                    {
                      price: Number(price),
                      source,
                      timestamp: new Date().toISOString(),
                      type: "user-entered",
                    },
                  ],
                },
                r.id,
              );
              setPrice("");
              setSource("");
            }}
          >
            Append price observation
          </Button>
        </Card>
      ))}
      {!cards.length && (
        <Empty text="Your collection starts with one confirmed variant." />
      )}
    </View>
  );
}
function Habits() {
  const { records, prefs, toggleHabit, put } = useStore(),
    c = useColors();
  const habits = useItems("habit");
  const today = dayInZone(new Date(), prefs.timezone);
  const [tick, setTick] = useState(Date.now());
  const timer = useItems("note").find((r) => r.id === "piano-timer");
  useEffect(() => {
    if (!timer?.payload.running) return;
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timer?.payload.running]);
  const elapsed =
    (timer?.payload.elapsed ?? 0) +
    (timer?.payload.running ? (tick - timer.payload.start) / 1000 : 0);
  return (
    <View style={{ gap: 16 }}>
      <Card>
        <Label style={styles.heading}>A rhythm that works for you</Label>
        <Label small muted>
          Targets are your preferences, not health recommendations. Use recovery
          or rest days when needed. Native reminders are configured with
          calendar tasks; game reset times and automatic habit reminders are
          pending.
        </Label>
      </Card>
      {habits.map((h) => {
        const done = records.find(
          (r) => r.id === `completion:${h.id}:${today}` && !r.deleted,
        )?.payload.done;
        const streak = habitStreak(
          records.filter((r) => r.kind === "completion"),
          h.id,
          today,
        );
        return (
          <Card key={h.id}>
            <Row>
              <Label style={styles.heading}>{h.payload.title}</Label>
              <Badge>{streak} day streak</Badge>
            </Row>
            <Row>
              <Label small muted>
                {h.payload.target} {h.payload.unit} ·{" "}
                {done ? "Completed today" : "Not completed"}
              </Label>
              <Switch
                accessibilityLabel={"Enable " + h.payload.title}
                value={h.payload.enabled}
                onValueChange={(enabled) => {
                  put("habit", { ...h.payload, enabled }, h.id);
                }}
              />
            </Row>
            <Field
              label={"Target: " + h.payload.title}
              value={String(h.payload.target)}
              keyboardType="numeric"
              onChangeText={(v) => {
                if (/^\d+$/.test(v) && Number(v) <= 1440)
                  put("habit", { ...h.payload, target: Number(v) }, h.id);
              }}
            />
            <Button secondary onPress={() => toggleHabit(h.id, today)}>
              {done ? "Undo completion" : "Complete today"}
            </Button>
            {h.id === "gym" && (
              <Button
                secondary
                onPress={() => {
                  toggleHabit(h.id, today, 0);
                  put("note", {
                    type: "recovery-day",
                    day: today,
                    domain: "personal",
                  });
                }}
              >
                Record recovery / rest day
              </Button>
            )}
            {h.id === "piano" && (
              <View style={{ gap: 12 }}>
                <Label style={{ fontSize: 32, fontVariant: ["tabular-nums"] }}>
                  {Math.floor(elapsed / 60)}:
                  {String(Math.floor(elapsed % 60)).padStart(2, "0")}
                </Label>
                <Row>
                  <Button
                    secondary
                    onPress={() => {
                      setTick(Date.now());
                      put(
                        "note",
                        {
                          type: "timer",
                          running: !timer?.payload.running,
                          start: Date.now(),
                          elapsed,
                        },
                        "piano-timer",
                      );
                    }}
                  >
                    {timer?.payload.running ? "Pause timer" : "Start timer"}
                  </Button>
                  <Button
                    secondary
                    onPress={() => {
                      toggleHabit(h.id, today, Math.floor(elapsed / 60));
                      put(
                        "note",
                        {
                          type: "timer",
                          running: false,
                          elapsed: 0,
                          start: Date.now(),
                        },
                        "piano-timer",
                      );
                    }}
                  >
                    Log practice
                  </Button>
                </Row>
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}
