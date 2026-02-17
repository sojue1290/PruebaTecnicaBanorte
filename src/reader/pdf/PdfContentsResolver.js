export class PdfContentsResolver {
  constructor({ index, decoder }) {
    this.index = index;
    this.decoder = decoder;
  }

  async resolveContents(contentsRefs) {
    const parts = [];

    for (const objId of contentsRefs) {
      const s = this.index.getStream(objId);
      if (!s || !s.streamBytes) continue;

      let decoded = null;

      try {
        decoded = await this.decoder.decode(s.dictStr, s.streamBytes);
      } catch (_) {
        // Fallback a bytes crudos
      }

      if (decoded == null) {
        decoded = s.streamBytes;
      }

      parts.push(decoded);
    }

    return concat(parts);
  }
}

function concat(chunks) {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
