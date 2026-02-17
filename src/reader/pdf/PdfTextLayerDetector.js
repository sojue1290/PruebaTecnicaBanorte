import { NoTextLayerError } from "./errors/NoTextLayerError.js";
import { PdfStreamDecoder } from "./PdfStreamDecoder.js";
import { PdfContentsResolver } from "./PdfContentsResolver.js";

export class PdfTextLayerDetector {
  constructor({ probePages = 10 } = {}) {
    this.probePages = probePages;
  }

  /**
   * Lanza NoTextLayerError solo si hay certeza de que el PDF es puro-imagen.
   *
   * Nivel 1 (sin decodificar): busca /Font en los objetos raw.
   *   Si hay fuentes declaradas → tiene texto, retorna inmediatamente.
   *
   * Nivel 2 (decodificando): intenta hasta probePages content streams.
   *   Si alguno contiene operadores de texto → retorna sin error.
   *   Si ningún stream se pudo decodificar → beneficio de la duda, retorna.
   *   Solo lanza si se decodificaron páginas y NINGUNA tenía texto.
   */
  async assertHasTextLayer({ index, pagesInfo }) {

    // ── Nivel 1: inspección rápida sin decodificar ────────────────
    const allObjects = index.getAllObjects();

    // /Font en cualquier objeto = PDF con texto
    const hasFont = allObjects.some(obj => /\/Font\b/.test(obj.body));
    if (hasFont) return;

    // Operadores de texto en claro (PDF sin compresión)
    const hasRawTextOps = allObjects.some(obj =>
      /\bBT\b/.test(obj.body)
    );
    if (hasRawTextOps) return;

    // ── Nivel 2: decodificar y buscar operadores ──────────────────
    const decoder = new PdfStreamDecoder();
    const contentsResolver = new PdfContentsResolver({ index, decoder });

    const probeCount = Math.min(this.probePages, pagesInfo.length);
    let decoded = 0;
    let withText = 0;

    for (let i = 0; i < probeCount; i++) {
      const p = pagesInfo[i];
      if (!p.contentsRefs || p.contentsRefs.length === 0) continue;

      let bytes;
      try {
        bytes = await contentsResolver.resolveContents(p.contentsRefs);
      } catch (_) {
        continue; // no se pudo decodificar esta página — pasar a la siguiente
      }

      if (!bytes || bytes.length === 0) continue;

      decoded++;
      const contentStr = new TextDecoder("latin1").decode(bytes);

      if (/\bTj\b|\bTJ\b|\bTf\b|\bDo\b/.test(contentStr)) {
        withText++;
      }
    }

    // Solo rechazar si se decodificaron páginas y NINGUNA tenía texto
    if (decoded > 0 && withText === 0) {
      throw new NoTextLayerError();
    }
    // decoded === 0 → no pudimos verificar → beneficio de la duda
  }
}
