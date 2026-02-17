export class TextNormalizer {
  static forCompare(s) {
    return String(s ?? "")
      .toLowerCase()
      .normalize("NFC")                           // NFC preserva ñ, ü, ç y demás caracteres compuestos
      .replace(/[¡!¿?\(\)\[\]\{\}"'`]/g, "")     // quita puntuación no numérica (incluye ? ASCII)
      .replace(/(?<!\d)[.,;:](?!\d)/g, "")        // quita . , ; : que NO están entre dígitos
      .replace(/\s+/g, " ")                       // colapsa espacios
      .trim();
  }
}
