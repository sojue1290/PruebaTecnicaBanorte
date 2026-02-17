import { PdfDocumentReader } from "../reader/pdf/PdfDocumentReader.js";

async function run() {
  const res = await fetch("./Aviso.pdf");
  const buffer = await res.arrayBuffer();

  const reader = new PdfDocumentReader({ textProbePages: 10, yTolerance: 2.5, minSpaceGap: 6 });
  const doc = await reader.read(buffer);

  console.log("pages:", doc.pageCount());

  const p1 = doc.getPage(1);
  console.log("page1 lines:", p1.items.length);
  console.log("first 20 lines:");
  p1.items.slice(0, 20).forEach(l => console.log(`[y=${l.y?.toFixed?.(2)} x=${l.x?.toFixed?.(2)}] ${l.text}`));
}

run().catch(e => console.error("testLines failed:", e));
