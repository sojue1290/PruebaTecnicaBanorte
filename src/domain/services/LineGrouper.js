// src/domain/services/LineGrouper.js
import { TextItem } from "../models/TextItem.js";

/**
 * Convierte muchos TextItem (fragmentos) en menos TextItem (líneas).
 * - Agrupa por Y (tolerancia).
 * - Ordena por X dentro de la línea.
 * - Inserta espacios usando un threshold dinámico por línea (basado en gaps X).
 *
 * Nota: Sin métricas de fuente reales, el threshold dinámico suele dar resultados
 * mucho mejores que un "minSpaceGap" fijo.
 */
export class LineGrouper {
  constructor({ yTolerance = 2.5, minSpaceGap = 6, glueGap = 1.5 } = {}) {
    this.yTolerance = yTolerance;
    this.minSpaceGap = minSpaceGap; // fallback si no se puede estimar
    this.glueGap = glueGap; // gaps muy pequeños => pegamos (glyphs)
  }

  /**
   * @param {TextItem[]} items
   * @returns {TextItem[]} líneas
   */
  group(items) {
    const filtered = (items ?? []).filter(
      (i) =>
        i &&
        typeof i.text === "string" &&
        i.text.trim().length > 0 &&
        Number.isFinite(i.x) &&
        Number.isFinite(i.y)
    );
    if (filtered.length === 0) return [];

    // Orden estable (reading order): y desc, x asc
    const sorted = [...filtered].sort((a, b) => {
      const dy = b.y - a.y;
      if (Math.abs(dy) > this.yTolerance) return dy;
      return a.x - b.x;
    });

    // Cluster por Y
    const buckets = [];
    let current = createLineBucket(sorted[0]);

    for (let i = 1; i < sorted.length; i++) {
      const it = sorted[i];
      if (Math.abs(it.y - current.yMean) <= this.yTolerance) {
        addToLineBucket(current, it);
      } else {
        buckets.push(current);
        current = createLineBucket(it);
      }
    }
    buckets.push(current);

    // Finalizar cada línea
    return buckets
      .map((b) => this.#finalizeLine(b))
      .filter((l) => l.text.length > 0);
  }

  #finalizeLine(bucket) {
    bucket.items.sort((a, b) => a.x - b.x);

    // 1) Calcular gaps X entre items consecutivos
    const gaps = [];
    for (let i = 1; i < bucket.items.length; i++) {
      const g = bucket.items[i].x - bucket.items[i - 1].x;
      if (Number.isFinite(g) && g > 0) gaps.push(g);
    }

    // 2) Estimar gap "intra-palabra" (pequeño). Filtramos outliers grandes.
    //    El 8 es heurístico; suele separar bien gaps de kerning vs espacios.
    const smallGaps = gaps.filter((g) => g < 8);

    const avgSmallGap = average(smallGaps);
    // threshold dinámico: si el gap es varias veces el gap promedio de letras, es "espacio"
    const spaceThreshold = avgSmallGap > 0 ? avgSmallGap * 2.5 : this.minSpaceGap;

    let text = "";
    let prevX = null;

    for (const it of bucket.items) {
      const t = normalizeInline(it.text);
      if (!t) continue;

      if (prevX !== null) {
        const gap = it.x - prevX;

        // gaps ultra pequeños => pegar (glyph-by-glyph)
        if (gap < this.glueGap) {
          // nada
        }
        // gap suficientemente grande según threshold dinámico => insertar espacio
        else if (gap > spaceThreshold && text.length > 0 && !text.endsWith(" ")) {
          text += " ";
        }
        // Si no hay gap grande, no forzamos espacio aquí; dejamos que la geometría mande.
      }

      text += t;
      prevX = it.x;
    }

    text = text.replace(/\s+/g, " ").trim();

    return new TextItem({
      text,
      x: bucket.xMin,
      y: bucket.yMean,
    });
  }
}

function createLineBucket(firstItem) {
  return {
    items: [firstItem],
    ySum: firstItem.y,
    count: 1,
    yMean: firstItem.y,
    xMin: firstItem.x,
  };
}

function addToLineBucket(bucket, item) {
  bucket.items.push(item);
  bucket.ySum += item.y;
  bucket.count += 1;
  bucket.yMean = bucket.ySum / bucket.count;
  if (item.x < bucket.xMin) bucket.xMin = item.x;
}

function normalizeInline(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function average(arr) {
  if (!arr || arr.length === 0) return 0;
  let sum = 0;
  for (const n of arr) sum += n;
  return sum / arr.length;
}

/**
 * Heurística opcional (descomentable) si necesitas insertar espacios
 * cuando el PDF no deja gaps geométricos.
 */
function needsSpaceBetween(existing, next) {
  if (!existing || !next) return false;

  const last = existing.slice(-1);
  const first = next[0];

  // No meter espacio antes de puntuación
  if (/^[,.:;)\]}]$/.test(first)) return false;
  // No meter espacio después de apertura
  if (/[(\[{]$/.test(last)) return false;
  
  // No meter espacio si termina o empieza con espacio
  if (last === ' ' || first === ' ') return false;

  const isLetter = (c) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(c);
  const isDigit = (c) => /[0-9]/.test(c);

  // Solo agregar espacio entre letra y letra si uno es mayúscula
  // Esto ayuda con casos como "aplicableVigente" pero no rompe palabras normales
  if (isLetter(last) && isLetter(first)) {
    return /[A-Z]/.test(first) || /[A-ZÁÉÍÓÚÜÑ]/.test(first);
  }

  // digit->letter o letter->digit => sí espacio
  if (isDigit(last) !== isDigit(first)) return true;

  return false;
}
