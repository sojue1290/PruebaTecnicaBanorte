export class DiffEntry {
  constructor({ page, kind, anchor, original, evaluated } = {}) {
    this.page = Number(page);
    this.kind = kind; // "ADDED" | "REMOVED" | "CHANGED"
    this.anchor = anchor ?? { x: null, y: null };
    this.original = String(original ?? "");
    this.evaluated = String(evaluated ?? "");
  }
}
