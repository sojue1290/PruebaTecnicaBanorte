import { DocumentModel } from "../domain/models/DocumentModel.js";
import { LcsDiffer } from "../domain/services/LcsDiffer.js";
import { DocumentComparer } from "../domain/services/DocumentComparer.js";
import { TextNormalizer } from "../domain/services/TextNormalizer.js";

const docA = new DocumentModel({
  pages: [
    { pageNumber: 1, width: 600, height: 800, items: [
      { text: "Nombre:", x: 10, y: 700 },
      { text: "Juan Perez", x: 80, y: 700 },
    ]},
    { pageNumber: 2, width: 600, height: 800, items: [{ text: "Dirección: X", x: 10, y: 700 }] },
    { pageNumber: 3, width: 600, height: 800, items: [{ text: "Fin", x: 10, y: 10 }] },
  ]
});

const docB = new DocumentModel({
  pages: [
    { pageNumber: 1, width: 600, height: 800, items: [
      { text: "Nombre:", x: 10, y: 700 },
      { text: "Juan Pérez", x: 80, y: 700 },
      { text: "RFC: ABC123", x: 10, y: 680 },
    ]},
    { pageNumber: 2, width: 600, height: 800, items: [{ text: "Dirección: Y", x: 10, y: 700 }] },
    { pageNumber: 3, width: 600, height: 800, items: [{ text: "Fin", x: 10, y: 10 }] },
  ]
});

const comparer = new DocumentComparer({ differ: new LcsDiffer(), normalizer: new TextNormalizer() });
const report = comparer.compare(docA, docB);

console.log(JSON.stringify(report, null, 2));
