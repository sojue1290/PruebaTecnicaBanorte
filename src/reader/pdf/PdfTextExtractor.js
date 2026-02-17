import { TextItem } from "../../domain/models/TextItem.js";
import { PdfContentTokenizer } from "./PdfContentTokenizer.js";

export class PdfTextExtractor {
  constructor() {
    this.tokenizer = new PdfContentTokenizer();
  }

  extract(contentStr, context = {}) {
    const tokens = this.tokenizer.tokenize(contentStr);
    const items = [];
    const stack = [];
    const state = { x: 0, y: 0, Tm: [1, 0, 0, 1, 0, 0], font: null, fontSize: 0 };
    let lastResourceName = null;

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];

      if (t.type === "number" || t.type === "string" || t.type === "array") {
        stack.push(t);
        continue;
      }

      if (t.type === "op" && t.value.startsWith("/")) {
        lastResourceName = t.value.slice(1);
        continue;
      }

      const op = t.value;

      if (op === "Tf") {
        state.fontSize = popNumber(stack) || 12;
        state.font = popString(stack) || lastResourceName;
        lastResourceName = null;
        stack.length = 0;
        continue;
      }

      if (op === "Tm") {
        const f = popNumber(stack);
        const e = popNumber(stack);
        const d = popNumber(stack);
        const c = popNumber(stack);
        const b = popNumber(stack);
        const a = popNumber(stack);
        if (a != null && b != null && c != null && d != null && e != null && f != null) {
          state.Tm = [a, b, c, d, e, f];
          state.x = e;
          state.y = f;
        }
        stack.length = 0;
        continue;
      }

      if (op === "Td" || op === "TD") {
        const ty = popNumber(stack);
        const tx = popNumber(stack);
        if (tx != null && ty != null) {
          state.x += tx;
          state.y += ty;
        }
        stack.length = 0;
        continue;
      }

      if (op === "Tj") {
        const txt = popString(stack);
        if (txt) {
          items.push(new TextItem({ text: txt, x: state.x, y: state.y }));
        }
        stack.length = 0;
        continue;
      }

      if (op === "TJ") {
        const arr = stack.pop();
        if (arr?.type === "array") {
          let currentX = state.x;
          for (const el of arr.elements) {
            if (el.type === "string") {
              items.push(new TextItem({ text: el.value, x: currentX, y: state.y }));
              currentX += el.value.length * (state.fontSize / 2);
            } else if (el.type === "number") {
              if (el.value < -100) currentX += Math.abs(el.value) * (state.fontSize / 1000);
            }
          }
        }
        stack.length = 0;
        continue;
      }

      if (op === "'" || op === '"') {
        const txt = popString(stack);
        if (txt) {
          items.push(new TextItem({ text: txt, x: state.x, y: state.y }));
        }
        stack.length = 0;
        continue;
      }

      if (op === "Do") {
        let xName = lastResourceName;
        if (!xName) {
          const top = stack[stack.length - 1];
          if (top?.type === "op" && top.value.startsWith("/")) {
            xName = stack.pop().value.slice(1);
          }
        }
        lastResourceName = null;
        stack.length = 0;

        const subItems = resolveXObject(xName, context, this);
        for (const item of subItems) items.push(item);
        continue;
      }

      stack.length = 0;
    }

    return items;
  }
}

async function resolveXObjectAsync() {}

function resolveXObject(xName, context, extractor) {
  const { xObjectMap, index, decoder, depth = 0 } = context;

  if (depth >= 5) return [];
  if (!xName || !xObjectMap || !index) return [];

  const objId = xObjectMap.get(xName);
  if (objId == null) return [];

  const stream = index.getStream(objId);
  if (!stream?.streamBytes) return [];

  const obj = index.getObject(objId);
  if (obj && !/\/Subtype\s*\/Form\b/.test(obj.body)) return [];

  let contentStr;
  try {
    contentStr = decodeStreamSync(stream);
  } catch {
    return [];
  }

  if (!contentStr) return [];

  let nestedXObjectMap = new Map();
  if (obj) {
    nestedXObjectMap = extractNestedXObjectMap(obj.body, index);
  }

  return extractor.extract(contentStr, {
    xObjectMap: nestedXObjectMap.size > 0 ? nestedXObjectMap : xObjectMap,
    index,
    decoder,
    depth: depth + 1
  });
}

function decodeStreamSync(stream) {
  const { dictStr = "", streamBytes } = stream;
  if (!streamBytes) return null;

  const filters = [];
  const arrMatch = dictStr.match(/\/Filter\s*\[\s*([^\]]+)\]/);
  if (arrMatch) {
    for (const m of arrMatch[1].matchAll(/\/([A-Za-z0-9]+)/g)) filters.push(m[1]);
  } else {
    const single = dictStr.match(/\/Filter\s*\/([A-Za-z0-9]+)/);
    if (single) filters.push(single[1]);
    else if (/\/FlateDecode\b/.test(dictStr)) filters.push("FlateDecode");
  }

  let data = streamBytes;

  for (const f of filters) {
    if (f === "FlateDecode") {
      if (typeof globalThis.pako !== "undefined") {
        try { data = globalThis.pako.inflate(data); continue; } catch { /* fallthrough */ }
      }
      return null;
    }
    if (f !== "Identity") return null;
  }

  return Array.from(data, b => String.fromCharCode(b)).join("");
}

function extractNestedXObjectMap(body, index) {
  const map = new Map();

  let resourcesBody = body;
  const resRef = body.match(/\/Resources\s+(\d+)\s+\d+\s+R/);
  if (resRef) {
    const resObj = index.getObject(Number(resRef[1]));
    if (resObj) resourcesBody = resObj.body;
  }

  const xobjRef = resourcesBody.match(/\/XObject\s+(\d+)\s+\d+\s+R/);
  let xobjBody = resourcesBody;
  if (xobjRef) {
    const xobj = index.getObject(Number(xobjRef[1]));
    if (xobj) xobjBody = xobj.body;
  }

  const inline = xobjBody.match(/\/XObject\s*<<([\s\S]*?)>>/);
  if (!inline) return map;

  for (const m of inline[1].matchAll(/\/([A-Za-z0-9_.]+)\s+(\d+)\s+\d+\s+R/g)) {
    map.set(m[1], Number(m[2]));
  }
  return map;
}

function popNumber(stack) {
  const t = stack.pop();
  if (!t) return null;
  if (t.type === "number") return t.value;
  return null;
}

function popString(stack) {
  const t = stack.pop();
  if (!t) return null;
  if (t.type === "string") return t.value;
  return null;
}
