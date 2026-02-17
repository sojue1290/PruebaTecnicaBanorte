import { PdfObjectIndex } from "../reader/pdf/PdfObjectIndex.js";
import { PdfCatalogResolver } from "../reader/pdf/PdfCatalogResolver.js";
import { PdfPageTreeResolver } from "../reader/pdf/PdfPageTreeResolver.js";
import { PdfStreamDecoder } from "../reader/pdf/PdfStreamDecoder.js";
import { PdfContentsResolver } from "../reader/pdf/PdfContentsResolver.js";
import { PdfContentTokenizer } from "../reader/pdf/PdfContentTokenizer.js";

async function run() {
  // 1) cargar pdf (pon sample.pdf en la raíz del proyecto)
  const res = await fetch("./COMAPA.pdf");
  if (!res.ok) throw new Error(`No pude cargar sample.pdf: ${res.status} ${res.statusText}`);

  const buffer = await res.arrayBuffer();

  // 2) indexar objetos
  const index = new PdfObjectIndex(buffer);

  // 3) encontrar catalog + root pages
  const catalogResolver = new PdfCatalogResolver();
  const catalog = catalogResolver.findCatalog(index.getAllObjects());
  if (!catalog) throw new Error("Catalog no encontrado (PDF no soportado o index incompleto).");

  const rootPagesId = catalogResolver.getPagesRootRef(catalog);
  if (!rootPagesId) throw new Error("Root /Pages no encontrado en Catalog.");

  // 4) recorrer árbol de páginas (orden real)
  const pageTree = new PdfPageTreeResolver();
  const pages = pageTree.resolve(index, rootPagesId);

  console.log("pages:", pages.length);
  if (pages.length === 0) throw new Error("No se resolvieron páginas. (posible ObjStm / PDF moderno).");

  console.log("page1:", pages[0]);

  // 5) resolver contents (streams) de la página 1
  const decoder = new PdfStreamDecoder();
  const contentsResolver = new PdfContentsResolver({ index, decoder });

  if (!pages[0].contentsRefs || pages[0].contentsRefs.length === 0) {
    console.warn("Página 1 no tiene contentsRefs (puede ser herencia o estructura no contemplada).");
  }

  const bytes = await contentsResolver.resolveContents(pages[0].contentsRefs ?? []);
  console.log("decoded content bytes:", bytes.length);

  const contentStr = new TextDecoder("latin1").decode(bytes);

  console.log("content stream (first 1000 chars):");
  console.log(contentStr.slice(0, 1000));

  // 6) tokenizar
  const tokenizer = new PdfContentTokenizer();
  const tokens = tokenizer.tokenize(contentStr);

  console.log("tokens:", tokens.length);
  console.log("first 60 tokens:", tokens.slice(0, 60));

  // 7) quick checks de operadores de texto
  const ops = new Set(tokens.filter(t => t.type === "op").map(t => t.value));
  console.log("has BT?", ops.has("BT"));
  console.log("has ET?", ops.has("ET"));
  console.log("has Tj?", ops.has("Tj"));
  console.log("has TJ?", ops.has("TJ"));

  // 8) extra: imprime un ejemplo de string token si existe
  const firstString = tokens.find(t => t.type === "string");
  console.log("first string token:", firstString ?? "(none)");
}

run().catch(err => {
  console.error("testContents failed:", err);
});
