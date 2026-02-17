// src/reader/pdf/PdfStreamDecoder.js
export class PdfStreamDecoder {
  async decode(dictStr, streamBytes) {
    if (!streamBytes) return null;

    const filters = parseFilters(dictStr);

    let data = streamBytes;

    for (const f of filters) {
      if (f === "ASCII85Decode") {
        data = ascii85DecodeBytes(data);
      } else if (f === "FlateDecode") {
        data = await flateDecodeBytes(data);
        if (data == null) return null;
      }
      // otros filtros: dejar pasar
    }

    return data;
  }
}

/** Extrae filtros /Filter /X o /Filter [/A /B] */
function parseFilters(dictStr) {
  if (!dictStr) return [];

  const arr = dictStr.match(/\/Filter\s*\[\s*([^\]]+)\]/);
  if (arr) {
    return arr[1].match(/\/([A-Za-z0-9]+)\b/g)?.map(x => x.slice(1)) ?? [];
  }

  const single = dictStr.match(/\/Filter\s*\/([A-Za-z0-9]+)\b/);
  if (single) return [single[1]];

  if (/\/FlateDecode\b/.test(dictStr)) return ["FlateDecode"];
  if (/\/ASCII85Decode\b/.test(dictStr)) return ["ASCII85Decode"];

  return [];
}

/**
 * FlateDecode robusto para browser.
 *
 * PDFs generados con Python wbits=-15 → deflate-raw puro (sin header 0x78)
 * PDFs generados con Python default  → zlib-wrapped (header 0x78 0x9C o 0x78 0x53)
 * Chrome DecompressionStream("deflate") NO acepta 0x78 0x53 correctamente.
 * La estrategia: detectar por primer byte y usar el path correcto.
 *
 * Nunca lanza — retorna null si ningún intento funciona.
 */
async function flateDecodeBytes(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream no está disponible en este entorno.");
  }

  const hasZlibHeader = bytes.length > 2 && bytes[0] === 0x78;

  if (hasZlibHeader) {
    // Intento 1A: deflate-raw quitando solo el header de 2 bytes (sin tocar checksum)
    // Esto es lo que Chrome necesita para streams 0x78 0x9C y 0x78 0x53
    try {
      return await decompress(bytes.slice(2), "deflate-raw");
    } catch (_) {}

    // Intento 1B: deflate-raw quitando header (2 bytes) Y checksum (4 bytes)
    if (bytes.length > 6) {
      try {
        return await decompress(bytes.slice(2, bytes.length - 4), "deflate-raw");
      } catch (_) {}
    }

    // Intento 1C: "deflate" completo — Firefox acepta zlib-wrapped aquí
    try {
      return await decompress(bytes, "deflate");
    } catch (_) {}
  }

  // Sin header zlib → deflate-raw puro (wbits=-15)
  // Intento 2: bytes completos como deflate-raw
  try {
    return await decompress(bytes, "deflate-raw");
  } catch (_) {}

  // Intento 3: último recurso — deflate completo
  try {
    return await decompress(bytes, "deflate");
  } catch (_) {}

  return null;
}

/**
 * Decomprime usando DecompressionStream con reader manual.
 * No usa Response/fetch — compatible con file://.
 */
async function decompress(bytes, format) {
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(bytes).then(() => writer.close()).catch(() => writer.abort());

  const chunks = [];
  let totalLen = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }

  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * ASCII85Decode
 */
function ascii85DecodeBytes(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);

  s = s.replace(/\s+/g, "");
  if (s.startsWith("<~")) s = s.slice(2);
  const end = s.indexOf("~>");
  if (end !== -1) s = s.slice(0, end);

  const out = [];
  let group = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i++];

    if (ch === "z" && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }

    const code = ch.charCodeAt(0);
    if (code < 33 || code > 117) continue;

    group.push(code - 33);

    if (group.length === 5) {
      let value = 0;
      for (let k = 0; k < 5; k++) value = value * 85 + group[k];
      out.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
      group = [];
    }
  }

  if (group.length > 0) {
    const n = group.length;
    while (group.length < 5) group.push(84);
    let value = 0;
    for (let k = 0; k < 5; k++) value = value * 85 + group[k];
    const bytes4 = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
    for (let k = 0; k < n - 1; k++) out.push(bytes4[k]);
  }

  return new Uint8Array(out);
}
