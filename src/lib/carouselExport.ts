// PNG files already use compression. A standard uncompressed ZIP keeps export
// dependency-free on both native and web; entries use ASCII names.
export function decodeBase64(encoded: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0)
    throw new Error("Invalid image export.");
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const result = new Uint8Array(
    (encoded.length / 4) * 3 -
      (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0),
  );
  let bits = 0,
    value = 0,
    offset = 0;
  for (const char of encoded.replace(/=+$/, "")) {
    value = (value << 6) | alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      result[offset++] = (value >>> bits) & 255;
    }
  }
  return result;
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function carouselZip(entries: { name: string; bytes: Uint8Array }[]) {
  const local: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0,
    centralSize = 0;
  for (const { name, bytes } of entries) {
    if (!/^[A-Za-z0-9_.-]+$/.test(name))
      throw new Error("Invalid export filename.");
    const filename = new TextEncoder().encode(name),
      crc = crc32(bytes);
    const header = new Uint8Array(30 + filename.length),
      view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(12, 33, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, bytes.length, true);
    view.setUint32(22, bytes.length, true);
    view.setUint16(26, filename.length, true);
    header.set(filename, 30);
    local.push(header, bytes);
    const directory = new Uint8Array(46 + filename.length),
      d = new DataView(directory.buffer);
    d.setUint32(0, 0x02014b50, true);
    d.setUint16(4, 20, true);
    d.setUint16(6, 20, true);
    d.setUint16(14, 33, true);
    d.setUint32(16, crc, true);
    d.setUint32(20, bytes.length, true);
    d.setUint32(24, bytes.length, true);
    d.setUint16(28, filename.length, true);
    d.setUint32(42, offset, true);
    directory.set(filename, 46);
    central.push(directory);
    centralSize += directory.length;
    offset += header.length + bytes.length;
  }
  const end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + 22);
  let cursor = 0;
  for (const chunk of [...local, ...central, end]) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }
  return result;
}
export function wrapSlideText(text: string, width: number) {
  const lines: string[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    // Split long words too, so edited URLs cannot spill outside the image.
    for (let i = 0; i < raw.length; i += width) {
      const word = raw.slice(i, i + width),
        last = lines.length - 1;
      if (last >= 0 && lines[last].length + word.length + 1 <= width)
        lines[last] += " " + word;
      else lines.push(word);
    }
  }
  return lines;
}
