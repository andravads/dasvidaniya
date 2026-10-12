import React, { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import Svg, {
  Defs,
  Image,
  LinearGradient,
  Stop,
  Rect,
  Text as SvgText,
  TSpan,
} from "react-native-svg";
import {
  Button,
  Card,
  Choice,
  Disclosure,
  Field,
  Label,
  Row,
  styles,
  useColors,
  Busy,
} from "./UI";
import { useStore } from "../state/Store";
import { invoke } from "../lib/backend";
import { dayInZone, uid } from "../lib/domain";
import {
  carouselZip,
  decodeBase64,
  wrapSlideText,
} from "../lib/carouselExport";
import {
  Category,
  CarouselPlan,
  maxSlides,
  validateCarouselPlan,
} from "../../supabase/functions/_shared/carousel";

type Photo = { id: string; name: string; uri: string };
function renderPNG(svg: Svg | undefined | null, width: number, height: number) {
  return new Promise<string>((resolve, reject) => {
    if (!svg) return reject(new Error("The photo preview is not ready yet."));
    const timeout = setTimeout(
      () =>
        reject(
          new Error("This photo could not be exported. Try a JPEG or PNG."),
        ),
      12000,
    );
    try {
      svg.toDataURL(
        (value) => {
          clearTimeout(timeout);
          if (value) resolve(value);
          else reject(new Error("The photo could not be exported."));
        },
        { width, height },
      );
    } catch {
      clearTimeout(timeout);
      reject(new Error("The photo could not be exported."));
    }
  });
}
async function readPhoto(asset: DocumentPicker.DocumentPickerAsset) {
  const size = asset.size ?? asset.file?.size ?? new File(asset.uri).size;
  if (!size || size > 8_000_000)
    throw new Error("Choose photos smaller than 8 MB each.");
  const mime = asset.mimeType || asset.file?.type || "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw new Error(
      "Choose JPEG, PNG or WebP photos. Convert HEIC photos to JPEG first.",
    );
  if (Platform.OS === "web" && asset.file) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not open this photo."));
      reader.readAsDataURL(asset.file!);
    });
  }
  return `data:${mime};base64,${await new File(asset.uri).base64()}`;
}

export function CarouselStudio() {
  const { session, prefs, put } = useStore(),
    c = useColors(),
    router = useRouter();
  const [category, setCategory] = useState<Category>("Gym"),
    [language, setLanguage] = useState("Indonesian");
  const [photos, setPhotos] = useState<Photo[]>([]),
    [context, setContext] = useState("");
  const [plan, setPlan] = useState<CarouselPlan | null>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const thumbnails = useRef<Record<string, Svg | null>>({}),
    previews = useRef<Record<string, Svg | null>>({});
  const alive = useRef(true);
  const draftSet = useRef("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function invalidate() {
    setPlan(null);
    setMessage("");
    setError("");
  }
  async function choose() {
    if (busy) return;
    setError("");
    setBusy("Opening photos…");
    try {
      const selected = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (selected.canceled) return;
      if (selected.assets.length > maxSlides)
        throw new Error("Choose up to 10 photos at a time.");
      if (
        selected.assets.reduce(
          (n, a) => n + (a.size ?? a.file?.size ?? new File(a.uri).size),
          0,
        ) > 32_000_000
      )
        throw new Error("Choose a photo set smaller than 32 MB.");
      const next: Photo[] = [];
      for (const [i, asset] of selected.assets.entries())
        next.push({
          id: Date.now() + ":" + i,
          name: asset.name,
          uri: await readPhoto(asset),
        });
      if (!alive.current) return;
      invalidate();
      setPhotos(next);
    } catch (e: any) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy("");
    }
  }
  function move(index: number, direction: number) {
    if (busy) return;
    const next = [...photos];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setPhotos(next);
    invalidate();
  }
  async function generate() {
    if (busy || !session) return;
    setBusy("Looking at your photos and preparing the carousel…");
    setError("");
    setMessage("");
    try {
      const images = [];
      for (const photo of photos) {
        let png = await renderPNG(thumbnails.current[photo.id], 512, 640);
        // Detailed phone photos compress poorly as PNGs. Shrink only the AI
        // preview; exports still render the original at 1080 × 1350.
        for (const [width, height] of [
          [256, 320],
          [128, 160],
        ]) {
          if (png.length <= 450000 - 22) break;
          png = await renderPNG(thumbnails.current[photo.id], width, height);
        }
        if (png.length > 450000 - 22)
          throw new Error(
            "This photo could not be prepared. Try choosing it again.",
          );
        images.push("data:image/png;base64," + png);
      }
      if (!alive.current) return;
      const result = validateCarouselPlan(
        await invoke("carousel", {
          category,
          language,
          context: context.slice(0, 1000),
          images,
        }),
        category,
        photos.length,
      );
      if (!alive.current) return;
      setPlan(result);
      draftSet.current = uid();
      setMessage("Your carousel is ready. Review the text, then download it.");
    } catch (e: any) {
      if (alive.current)
        setError(
          /Failed to send|Failed to fetch|not found/i.test(e.message)
            ? "Photo AI is not available yet. Its server setup must be enabled first."
            : e.message,
        );
    } finally {
      if (alive.current) setBusy("");
    }
  }
  async function download() {
    if (!plan || busy) return;
    setBusy("Preparing your download…");
    setError("");
    try {
      if (Platform.OS !== "web" && !(await Sharing.isAvailableAsync()))
        throw new Error("Sharing is unavailable on this device.");
      const entries = [];
      for (const [i, photo] of photos.entries())
        entries.push({
          name: `slide-${String(i + 1).padStart(2, "0")}.png`,
          bytes: decodeBase64(
            await renderPNG(previews.current[photo.id], 1080, 1350),
          ),
        });
      entries.push({
        name: "captions.txt",
        bytes: new TextEncoder().encode(
          plan.captions
            .map((c) => c.account + "\n\n" + c.text)
            .join("\n\n--------------------\n\n"),
        ),
      });
      const bytes = carouselZip(entries),
        name = `homies-${category.toLowerCase()}-carousel.zip`;
      if (!alive.current) return;
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const file = new File(Paths.cache, Date.now() + "-" + name);
        file.write(bytes);
        // Android can dismiss the chooser before the receiving app reads the
        // file. Leave this export in OS-managed cache rather than deleting it.
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/zip",
          UTI: "public.zip-archive",
        });
      }
      if (alive.current)
        setMessage("Export prepared: ordered slide images and captions.txt.");
    } catch (e: any) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy("");
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <Card>
        <Label style={styles.heading}>Photos in. Carousel ready.</Label>
        <Label muted>
          Choose your photos. Homies writes each slide and your post captions.
        </Label>
        <Choice
          options={["Gym", "Work"]}
          value={category}
          onChange={(v) => {
            if (!busy) {
              setCategory(v as Category);
              invalidate();
            }
          }}
        />
        <Button disabled={!!busy} onPress={choose}>
          {photos.length
            ? "Choose a different photo set"
            : "Choose carousel photos"}
        </Button>
        <Label small muted>
          Up to 10 JPEG, PNG or WebP photos. Arrange them below. Each image
          becomes a portrait slide with readable text on the photo.
        </Label>
        <Disclosure title="Language & optional context">
          <Choice
            options={["Indonesian", "English", "Mixed"]}
            value={language}
            onChange={(v) => {
              if (!busy) {
                setLanguage(v);
                invalidate();
              }
            }}
          />
          <Field
            label="Anything the photos cannot tell us? (optional)"
            value={context}
            onChangeText={(v) => {
              if (!busy) {
                setContext(v.slice(0, 1000));
                invalidate();
              }
            }}
            placeholder="For example: my first week back at the gym"
            multiline
          />
        </Disclosure>
        {!session ? (
          <Button secondary onPress={() => router.navigate("/profile")}>
            Sign in to prepare with AI
          </Button>
        ) : (
          <Button disabled={!!busy || !photos.length} onPress={generate}>
            {plan ? "Prepare again with AI" : "Prepare with AI"}
          </Button>
        )}
        <Label small muted>
          Preparing sends small copies of these photos to OpenAI and uses one AI
          request. Photos stay out of your cloud records. Download before
          leaving this page.
        </Label>
        {!!busy && (
          <>
            <Busy />
            <Label>{busy}</Label>
          </>
        )}
        {!!error && <Label style={{ color: c.danger }}>{error}</Label>}
        {!!message && <Label>{message}</Label>}
      </Card>
      {!!photos.length && (
        <Label style={styles.heading}>Your slide order</Label>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        {photos.map((photo, index) => (
          <Card
            key={photo.id}
            style={{ width: "100%", maxWidth: 370, flexGrow: 1 }}
          >
            <Row>
              <Label>
                Slide {index + 1} of {photos.length}
              </Label>
              <Label small muted>
                {category}
              </Label>
            </Row>
            <View
              style={{
                width: "100%",
                aspectRatio: 4 / 5,
                backgroundColor: "#111",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <Svg
                ref={(node) => {
                  previews.current[photo.id] = node;
                }}
                width="100%"
                height="100%"
                viewBox="0 0 1080 1350"
                accessibilityLabel={`Slide ${index + 1} preview`}
              >
                <Rect width="1080" height="1350" fill="#101514" />
                <Image
                  href={photo.uri}
                  x="0"
                  y="0"
                  width="1080"
                  height="1350"
                  preserveAspectRatio="xMidYMid meet"
                />
                {plan && (
                  <>
                    <Defs>
                      <LinearGradient
                        id={"shade" + photo.id.replace(/\W/g, "")}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="100%"
                      >
                        <Stop offset="0" stopColor="#101514" stopOpacity="0" />
                        <Stop
                          offset="0.4"
                          stopColor="#101514"
                          stopOpacity="0.9"
                        />
                        <Stop
                          offset="1"
                          stopColor="#101514"
                          stopOpacity="0.98"
                        />
                      </LinearGradient>
                    </Defs>
                    <Rect
                      y="760"
                      width="1080"
                      height="590"
                      fill={"url(#shade" + photo.id.replace(/\W/g, "") + ")"}
                    />
                    <SvgText
                      x="64"
                      y="985"
                      fill="#eef3e8"
                      fontFamily={
                        Platform.OS === "ios" ? "Courier" : "monospace"
                      }
                      fontWeight="700"
                      fontSize="44"
                    >
                      {wrapSlideText(plan.slides[index].headline, 32).map(
                        (line, i) => (
                          <TSpan key={i} x="64" dy={i ? 56 : 0}>
                            {line}
                          </TSpan>
                        ),
                      )}
                    </SvgText>
                    <SvgText
                      x="64"
                      y="1150"
                      fill="#c7ef9a"
                      fontFamily={
                        Platform.OS === "ios" ? "Courier" : "monospace"
                      }
                      fontSize="30"
                    >
                      {wrapSlideText(plan.slides[index].body, 48).map(
                        (line, i) => (
                          <TSpan key={i} x="64" dy={i ? 36 : 0}>
                            {line}
                          </TSpan>
                        ),
                      )}
                    </SvgText>
                  </>
                )}
              </Svg>
            </View>
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 4,
                height: 5,
                opacity: 0,
                pointerEvents: "none",
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Svg
                ref={(node) => {
                  thumbnails.current[photo.id] = node;
                }}
                width="4"
                height="5"
                viewBox="0 0 1080 1350"
              >
                <Rect width="1080" height="1350" fill="#101514" />
                <Image
                  href={photo.uri}
                  width="1080"
                  height="1350"
                  preserveAspectRatio="xMidYMid meet"
                />
              </Svg>
            </View>
            <Label small muted>
              {photo.name}
            </Label>
            <Row>
              <Button
                secondary
                accessibilityLabel={`Move slide ${index + 1} earlier`}
                disabled={!!busy || index === 0}
                onPress={() => move(index, -1)}
              >
                ↑ Earlier
              </Button>
              <Button
                secondary
                accessibilityLabel={`Move slide ${index + 1} later`}
                disabled={!!busy || index === photos.length - 1}
                onPress={() => move(index, 1)}
              >
                ↓ Later
              </Button>
            </Row>
            <Button
              secondary
              disabled={!!busy}
              accessibilityLabel={`Remove slide ${index + 1}`}
              onPress={() => {
                setPhotos(photos.filter((p) => p.id !== photo.id));
                invalidate();
              }}
            >
              Remove
            </Button>
            {plan && (
              <>
                <Field
                  label={`Slide ${index + 1} headline`}
                  value={plan.slides[index].headline}
                  onChangeText={(headline) => {
                    if (!busy)
                      setPlan({
                        ...plan,
                        slides: plan.slides.map((s, i) =>
                          i === index
                            ? { ...s, headline: headline.slice(0, 64) }
                            : s,
                        ),
                      });
                  }}
                />
                <Field
                  label={`Slide ${index + 1} text`}
                  value={plan.slides[index].body}
                  multiline
                  onChangeText={(body) => {
                    if (!busy)
                      setPlan({
                        ...plan,
                        slides: plan.slides.map((s, i) =>
                          i === index ? { ...s, body: body.slice(0, 140) } : s,
                        ),
                      });
                  }}
                />
              </>
            )}
          </Card>
        ))}
      </View>
      {plan && (
        <Card>
          <Label style={styles.heading}>Post captions</Label>
          {plan.captions.map((caption, index) => (
            <Field
              key={caption.account}
              label={caption.account + " post caption"}
              value={caption.text}
              multiline
              onChangeText={(text) => {
                if (!busy)
                  setPlan({
                    ...plan,
                    captions: plan.captions.map((c, i) =>
                      i === index ? { ...c, text: text.slice(0, 2200) } : c,
                    ),
                  });
              }}
            />
          ))}
          <Button disabled={!!busy} onPress={download}>
            Download carousel & captions
          </Button>
          <Button
            secondary
            disabled={!!busy}
            onPress={() => {
              const due = dayInZone(new Date(), prefs.timezone);
              for (const [index, caption] of plan.captions.entries())
                put(
                  "draft",
                  {
                    title: plan.slides[0].headline,
                    account: caption.account,
                    text: caption.text,
                    due,
                    status: "Ready",
                    metrics: {},
                    carouselText: plan.slides,
                    category,
                  },
                  "carousel-" + draftSet.current + "-" + index,
                );
              setMessage(
                "Captions saved to your content drafts. Download the images separately.",
              );
            }}
          >
            Save captions to my drafts
          </Button>
          <Label small muted>
            Review before posting. Download includes slide-01.png onward plus
            captions.txt. No social accounts are connected yet.
          </Label>
        </Card>
      )}
    </View>
  );
}
