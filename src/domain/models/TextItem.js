export class TextItem {
  constructor({ text, x = null, y = null } = {}) {
    this.text = String(text ?? "");
    this.x = x === null ? null : Number(x);
    this.y = y === null ? null : Number(y);
  }
}
