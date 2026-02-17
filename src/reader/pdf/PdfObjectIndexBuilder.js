import { PdfObjectIndex } from "./PdfObjectIndex.js";
import { PdfStreamDecoder } from "./PdfStreamDecoder.js";

export class PdfObjectIndexBuilder {
  static async build(arrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new TypeError("PdfObjectIndexBuilder.build espera ArrayBuffer");
    }

    const raw = new Uint8Array(arrayBuffer);
    const text = new TextDecoder("latin1").decode(raw);

    const objectsById = new Map();

    // 1) index clásico
    const re = /(\d+)\s+(\d+)\s+obj\b([\s\S]*?)\bendobj\b/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const id = Number(m[1]);
      const gen = Number(m[2]);
      const body = m[3].trim();
      objectsById.set(id, { id, gen, body });
    }

    // 2) expandir ObjStm (mínimo viable)
    await expandObjStm({ pdfText: text, objectsById });

    return new PdfObjectIndex({ rawBytes: raw, text, objectsById });
  }
}

async function expandObjStm({ pdfText, objectsById }) {
  const decoder = new PdfStreamDecoder();

  const objStmIds = [];
  for (const obj of objectsById.values()) {
    if (/\/Type\s*\/ObjStm\b/.test(obj.body)) objStmIds.push(obj.id);
  }
  if (objStmIds.length === 0) return;

  for (const stmId of objStmIds) {
    const stmObj = objectsById.get(stmId);
    if (!stmObj) continue;

    const n = parseInt(match1(stmObj.body, /\/N\s+(\d+)/), 10);
    const first = parseInt(match1(stmObj.body, /\/First\s+(\d+)/), 10);
    if (!Number.isFinite(n) || !Number.isFinite(first) || n <= 0 || first < 0) continue;

    const streamBytes = extractStreamBytesFromWholePdf(pdfText, stmId);
    if (!streamBytes) continue;

    let decodedBytes;
    try {
      decodedBytes = await decoder.decode(stmObj.body, streamBytes);
    } catch {
      continue;
    }
    if (!decodedBytes) continue;

    const decodedText = new TextDecoder("latin1").decode(decodedBytes);

    const header = decodedText.slice(0, first);
    const nums = header.trim().split(/\s+/).map(Number).filter(Number.isFinite);
    if (nums.length < 2 * n) continue;

    const entries = [];
    for (let i = 0; i < 2 * n; i += 2) {
      entries.push({ objId: nums[i], offset: nums[i + 1] });
    }

    const data = decodedText.slice(first);

    for (let i = 0; i < entries.length; i++) {
      const { objId, offset } = entries[i];
      const nextOffset = (i + 1 < entries.length) ? entries[i + 1].offset : data.length;

      if (!Number.isFinite(offset) || !Number.isFinite(nextOffset) || nextOffset < offset) continue;

      const slice = data.slice(offset, nextOffset).trim();
      if (!slice) continue;

      // Guardar si no existe (los ObjStm suelen ser gen=0)
      if (!objectsById.has(objId)) {
        objectsById.set(objId, {
            id: objId,
            gen: 0,
            body: slice,
            fromObjStm: true
        });
      }
    }
  }
}

function extractStreamBytesFromWholePdf(pdfTextLatin1, objId) {
  const re = new RegExp(String.raw`${objId}\s+\d+\s+obj\b([\s\S]*?)\bendobj\b`);
  const m = pdfTextLatin1.match(re);
  if (!m) return null;

  const objBlock = m[1];

  // Usar regex para encontrar "stream" + EOL de forma precisa
  const streamMatch = objBlock.match(/stream(\r\n|\n|\r)/);
  if (!streamMatch) return null;

  const sIdx = objBlock.indexOf("stream");
  const eIdx = objBlock.indexOf("endstream");
  if (sIdx < 0 || eIdx < 0 || eIdx <= sIdx) return null;

  const eolLen = streamMatch[1].length;
  const start = sIdx + "stream".length + eolLen;

  // Quitar el \n o \r\n que precede a "endstream"
  let end = eIdx;
  if (objBlock[end - 1] === "\n") end--;
  if (objBlock[end - 1] === "\r") end--;
  const streamContent = objBlock.slice(start, end);

  // latin1 -> bytes
  const bytes = new Uint8Array(streamContent.length);
  for (let i = 0; i < streamContent.length; i++) {
    bytes[i] = streamContent.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function match1(s, re) {
  const m = s.match(re);
  return m ? m[1] : null;
}
