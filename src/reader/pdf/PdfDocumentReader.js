import { DocumentModel } from "../../domain/models/DocumentModel.js";
import { PageModel } from "../../domain/models/PageModel.js";

import { PdfCatalogResolver } from "./PdfCatalogResolver.js";
import { PdfPageTreeResolver } from "./PdfPageTreeResolver.js";

import { PdfTextLayerDetector } from "./PdfTextLayerDetector.js";
import { PdfStreamDecoder } from "./PdfStreamDecoder.js";
import { PdfContentsResolver } from "./PdfContentsResolver.js";
import { PdfTextExtractor } from "./PdfTextExtractor.js";
import { PdfObjectIndexBuilder } from "./PdfObjectIndexBuilder.js";
import { LineGrouper } from "../../domain/services/LineGrouper.js";

export class PdfDocumentReader {
  constructor() {
    this.textLayerDetector = new PdfTextLayerDetector();
    this.streamDecoder = new PdfStreamDecoder();
    this.textExtractor = new PdfTextExtractor();
    this.lineGrouper = new LineGrouper();
  }

  async read(arrayBuffer) {
    const index = await PdfObjectIndexBuilder.build(arrayBuffer);

    const catalogResolver = new PdfCatalogResolver();
    const catalogObj = catalogResolver.findCatalog(index.getAllObjects());
    if (!catalogObj) throw new Error("No se encontró el catálogo del PDF");

    const catalogId = catalogResolver.getPagesRootRef(catalogObj);
    if (!catalogId) throw new Error("No se encontró el árbol de páginas");

    const pageTreeResolver = new PdfPageTreeResolver();
    const pagesInfo = pageTreeResolver.resolve(index, catalogId);
    if (pagesInfo.length === 0) throw new Error("El PDF no tiene páginas");

    await this.textLayerDetector.assertHasTextLayer({ index, pagesInfo });

    const contentsResolver = new PdfContentsResolver({
      index,
      decoder: this.streamDecoder
    });

    const pages = [];

    for (let i = 0; i < pagesInfo.length; i++) {
      const pageInfo = pagesInfo[i];
      const pageNumber = i + 1;

      if (!pageInfo.contentsRefs || pageInfo.contentsRefs.length === 0) {
        pages.push(new PageModel({ pageNumber, items: [] }));
        continue;
      }

      let bytes;
      try {
        bytes = await contentsResolver.resolveContents(pageInfo.contentsRefs);
      } catch (err) {
        throw new Error(`Error al leer la página ${pageNumber}: ${err.message}`);
      }

      const contentStr = new TextDecoder("latin1").decode(bytes);
      const rawItems = this.textExtractor.extract(contentStr, {
        xObjectMap: pageInfo.xObjectMap,
        index,
        decoder: this.streamDecoder,
        depth: 0
      });

      const lines = this.lineGrouper.group(rawItems);
      pages.push(new PageModel({ pageNumber, items: lines }));
    }

    return new DocumentModel({ pages });
  }
}
