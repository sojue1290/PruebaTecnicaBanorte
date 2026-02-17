import { PdfDocumentReader } from "../reader/pdf/PdfDocumentReader.js";

async function run() {
  const res = await fetch("./Aviso.pdf");
  if (!res.ok) throw new Error(`No pude cargar sample.pdf: ${res.status}`);

  const buffer = await res.arrayBuffer();

  const reader = new PdfDocumentReader({ textProbePages: 10 });
  const doc = await reader.read(buffer);

  console.log("pages:", doc.pageCount());

  const p1 = doc.getPage(1);
  console.log("page1 items:", p1.items.length);
  console.log("first 40 items:", p1.items.slice(0, 40));

  // quick check: imprime algunas cadenas
  const texts = p1.items.slice(0, 80).map(i => i.text).filter(Boolean);
  console.log("sample texts:", texts.slice(0, 30));
}

run().catch(e => console.error("testExtractText failed:", e));
