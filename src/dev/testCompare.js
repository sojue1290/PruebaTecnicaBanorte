import { PdfDocumentReader } from "../reader/pdf/PdfDocumentReader.js";
import { DocumentComparer } from "../domain/services/DocumentComparer.js";

function checksum(u8) {
  let sum = 0;
  for (let i = 0; i < u8.length; i += 1024) sum = (sum + u8[i]) % 1000000007;
  return sum;
}

function previewPage(doc, pageNum = 1, n = 10) {
  const page = doc.getPage(pageNum);
  if (!page) return { count: 0, sampleDisplay: [], sampleKey: [] };

  const seq = page.compareSequence();
  return {
    count: seq.length,
    sampleDisplay: seq.slice(0, n).map(x => x.display),
    sampleKey: seq.slice(0, n).map(x => x.key),
  };
}

async function run() {
  const urlA = "./xobj_original.pdf";
  const urlB = "./xobj_evaluada.pdf";

  const [resA, resB] = await Promise.all([
    fetch(urlA, { cache: "no-store" }),
    fetch(urlB, { cache: "no-store" }),
  ]);

  if (!resA.ok) throw new Error(`No pude cargar ${urlA}: ${resA.status}`);
  if (!resB.ok) throw new Error(`No pude cargar ${urlB}: ${resB.status}`);

  const [bufA, bufB] = await Promise.all([resA.arrayBuffer(), resB.arrayBuffer()]);
  const u8A = new Uint8Array(bufA);
  const u8B = new Uint8Array(bufB);

  console.log("PDF A bytes:", u8A.length, "checksum:", checksum(u8A));
  console.log("PDF B bytes:", u8B.length, "checksum:", checksum(u8B));

  const reader = new PdfDocumentReader();
  const [docA, docB] = await Promise.all([reader.read(bufA), reader.read(bufB)]);

  console.log("docA pages:", docA.pageCount());
  console.log("docB pages:", docB.pageCount());

  const pA = previewPage(docA, 1, 10);
  const pB = previewPage(docB, 1, 10);

  console.log("page1 seqA count:", pA.count);
  console.log("page1 seqB count:", pB.count);
  console.log("page1 A display (first 10):", pA.sampleDisplay);
  console.log("page1 B display (first 10):", pB.sampleDisplay);
  console.log("page1 A key (first 10):", pA.sampleKey);
  console.log("page1 B key (first 10):", pB.sampleKey);

  const comparer = new DocumentComparer();
  const report = comparer.compare(docA, docB);

  console.log("REPORT summary:", report.summary);
  console.log("REPORT first diffs:", report.differences.slice(0, 25));
}

run().catch(e => console.error("testCompare failed:", e));
