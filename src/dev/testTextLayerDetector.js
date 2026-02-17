import { PdfObjectIndex } from "../reader/pdf/PdfObjectIndex.js";
import { PdfCatalogResolver } from "../reader/pdf/PdfCatalogResolver.js";
import { PdfPageTreeResolver } from "../reader/pdf/PdfPageTreeResolver.js";
import { PdfTextLayerDetector } from "../reader/pdf/PdfTextLayerDetector.js";

async function run() {
  const res = await fetch("./Aviso.pdf");
  const buffer = await res.arrayBuffer();

  const index = new PdfObjectIndex(buffer);

  const catalogResolver = new PdfCatalogResolver();
  const catalog = catalogResolver.findCatalog(index.getAllObjects());
  const rootPagesId = catalogResolver.getPagesRootRef(catalog);

  const pagesInfo = new PdfPageTreeResolver().resolve(index, rootPagesId);

  const detector = new PdfTextLayerDetector({ probePages: 10 });

  try {
    await detector.assertHasTextLayer({ index, pagesInfo });
    console.log("✅ Text layer detected");
  } catch (e) {
    console.error("❌ No text layer:", e);
  }
}

run();
