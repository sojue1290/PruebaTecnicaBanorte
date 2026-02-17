export class NoTextLayerError extends Error {
  constructor() {
    super("El PDF no contiene capa de texto (probablemente escaneado). OCR requerido.");
    this.name = "NoTextLayerError";
  }
}
