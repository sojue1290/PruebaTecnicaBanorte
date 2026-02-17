import { PdfDocumentReader } from "../reader/pdf/PdfDocumentReader.js";

async function run() {
  const res = await fetch("./Aviso.pdf");
  const buffer = await res.arrayBuffer();

  const reader = new PdfDocumentReader();
  const doc = await reader.read(buffer);

  console.log("Page count:", doc.pageCount());
  console.log(doc);
}

run();
