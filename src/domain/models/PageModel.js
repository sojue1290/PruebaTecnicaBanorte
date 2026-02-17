import { TextNormalizer } from "../services/TextNormalizer.js";

export class PageModel {
  constructor({ pageNumber, width, height, items }) {
    this.pageNumber = pageNumber;
    this.width = width;
    this.height = height;
    this.items = items ?? [];
  }

  compareSequence() {
    return this.items
      .filter(it => it && typeof it.text === "string" && it.text.trim().length > 0)
      .map(it => ({
        display: it.text,
        key: TextNormalizer.forCompare(it.text),
        anchor: { x: it.x, y: it.y }
      }))
      .filter(x => x.key.length > 0);
  }
}
