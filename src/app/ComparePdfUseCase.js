import { NoTextLayerError } from "../reader/pdf/errors/NoTextLayerError.js";

export class ComparePdfUseCase {
  constructor({ reader, comparer } = {}) {
    this.reader = reader;
    this.comparer = comparer;
  }

  async execute({ originalBuffer, evaluatedBuffer }) {
    let docA, docB;

    try {
      docA = await this.reader.read(originalBuffer);
    } catch (err) {
      if (err instanceof NoTextLayerError) throw err;
      throw new Error(`No se pudo leer el documento original: ${err.message}`);
    }

    try {
      docB = await this.reader.read(evaluatedBuffer);
    } catch (err) {
      if (err instanceof NoTextLayerError) throw err;
      throw new Error(`No se pudo leer el documento evaluado: ${err.message}`);
    }

    if (docA.pageCount() < 3 || docB.pageCount() < 3) {
      throw new Error(
        `Ambos PDFs deben tener mínimo 3 páginas. ` +
        `Original: ${docA.pageCount()} pág(s), Evaluado: ${docB.pageCount()} pág(s).`
      );
    }

    return this.comparer.compare(docA, docB);
  }
}
