export const carouselAccounts = {
  Gym: ["TikTok · Gym", "Instagram · Gym"],
  Work: ["TikTok · Working tips"],
} as const;
export type Category = keyof typeof carouselAccounts;
export type CarouselPlan = {
  slides: { headline: string; body: string }[];
  captions: { account: string; text: string }[];
};
export const maxSlides = 10;
export const maxRequestBytes = 5_000_000;
function shortText(value: unknown, max: number, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!allowEmpty && !value.trim())
  )
    throw new Error(
      "The carousel text is missing or too long. Please try again.",
    );
  return value.trim();
}
export function validateCarouselInput(value: unknown) {
  const v = value as Record<string, unknown> | null;
  if (!v || (v.category !== "Gym" && v.category !== "Work"))
    throw new Error("Choose Gym or Work.");
  if (!["Indonesian", "English", "Mixed"].includes(String(v.language)))
    throw new Error("Choose a supported language.");
  if (
    !Array.isArray(v.images) ||
    v.images.length < 1 ||
    v.images.length > maxSlides
  )
    throw new Error("Choose between 1 and 10 photos.");
  const images = v.images.map((image: unknown) => {
    // Accept only locally rendered PNG thumbnails, never URLs a server could fetch.
    if (
      typeof image !== "string" ||
      image.length > 450_000 ||
      !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(image)
    )
      throw new Error(
        "A photo could not be prepared. Try a smaller JPEG or PNG.",
      );
    const prefix = "data:image/png;base64,";
    const header = Uint8Array.from(
      atob(image.slice(prefix.length, prefix.length + 44)),
      (c) => c.charCodeAt(0),
    );
    const dimensions = new DataView(header.buffer);
    if (
      header.length < 33 ||
      new TextDecoder().decode(header.slice(12, 16)) !== "IHDR" ||
      dimensions.getUint32(16) < 1 ||
      dimensions.getUint32(16) > 512 ||
      dimensions.getUint32(20) < 1 ||
      dimensions.getUint32(20) > 640
    )
      throw new Error("Photos must be small PNG previews.");
    return image;
  });
  return {
    category: v.category as Category,
    language: String(v.language),
    context: shortText(v.context ?? "", 1000, true),
    images,
  };
}
export function validateCarouselPlan(
  value: unknown,
  category: Category,
  count: number,
): CarouselPlan {
  const v = value as CarouselPlan | null;
  const accounts = carouselAccounts[category];
  if (
    !v ||
    !Array.isArray(v.slides) ||
    v.slides.length !== count ||
    !Array.isArray(v.captions) ||
    v.captions.length !== accounts.length
  )
    throw new Error("AI returned an incomplete carousel. Please try again.");
  return {
    slides: v.slides.map((slide) => ({
      headline: shortText(slide?.headline, 64),
      body: shortText(slide?.body, 140, true),
    })),
    captions: accounts.map((account) => {
      const matches = v.captions.filter(
        (caption) => caption?.account === account,
      );
      if (matches.length !== 1)
        throw new Error(
          "AI returned the wrong account captions. Please try again.",
        );
      return { account, text: shortText(matches[0].text, 2200) };
    }),
  };
}
export async function readCarouselBody(req: Request) {
  if (req.method !== "POST") throw new Error("Use POST");
  if (Number(req.headers.get("content-length")) > maxRequestBytes)
    throw new Error("Photos are too large.");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Choose your photos first.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxRequestBytes) {
        await reader.cancel();
        throw new Error("Photos are too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return validateCarouselInput(JSON.parse(new TextDecoder().decode(bytes)));
}
