export class PdfObjectIndex {
  constructor({ rawBytes, text, objectsById }) {
    this.raw = rawBytes;
    this.text = text;
    this.objectsById = objectsById;
  }

  getObject(id) {
    return this.objectsById.get(Number(id)) ?? null;
  }

  getAllObjects() {
    return Array.from(this.objectsById.values());
  }

  getStream(objId) {
    const obj = this.getObject(objId);
    if (!obj) return null;

    if (obj.fromObjStm) {
      const bytes = new Uint8Array(obj.body.length);
      for (let i = 0; i < obj.body.length; i++) {
        bytes[i] = obj.body.charCodeAt(i) & 0xff;
      }
      return { dictStr: "<<>>", streamBytes: bytes };
    }

    const parsed = extractStreamFromBody(obj.body);
    if (parsed) return parsed;

    return null;
  }
}

function extractStreamFromBody(body) {
  const streamMatch = body.match(/stream(\r\n|\n|\r)/);
  if (!streamMatch) return null;

  const sIdx = streamMatch.index;
  const eIdx = body.indexOf("endstream", sIdx + "stream".length);
  if (sIdx < 0 || eIdx < 0 || eIdx <= sIdx) return null;

  const dictStr = body.slice(0, sIdx).trim();
  const eolLen = streamMatch[1].length;
  const start = sIdx + "stream".length + eolLen;

  let end = eIdx;
  if (body[end - 1] === "\n") end--;
  if (body[end - 1] === "\r") end--;

  const streamContent = body.slice(start, end);

  const streamBytes = new Uint8Array(streamContent.length);
  for (let i = 0; i < streamContent.length; i++) {
    streamBytes[i] = streamContent.charCodeAt(i) & 0xff;
  }

  return { dictStr, streamBytes };
}
