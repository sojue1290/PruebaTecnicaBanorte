export class PdfPageTreeResolver {
  /**
   * @param {PdfObjectIndex} index - tu index (debe tener getObject(id))
   * @param {number} rootPagesId - id del objeto /Pages raíz
   * @returns {Array<{pageObjId:number,width:number,height:number,contentsRefs:number[],xObjectMap:Map<string,number>}>}
   */
  resolve(index, rootPagesId) {
    const pages = [];
    this.#walk(index, rootPagesId, null, pages);
    return pages;
  }

  /**
   * Recorre el árbol /Pages en orden, heredando MediaBox cuando aplica.
   * @param {PdfObjectIndex} index
   * @param {number} objId
   * @param {number[]|null} inheritedMediaBox - [x0 y0 x1 y1] o null
   * @param {Array} outPages
   */
  #walk(index, objId, inheritedMediaBox, outPages) {
    const obj = index.getObject(objId);
    if (!obj) return;

    const body = obj.body;

    const isPage  = /\/Type\s*\/Page\b/.test(body);
    const isPages = /\/Type\s*\/Pages\b/.test(body);

    // MediaBox local si existe; si no, heredado
    let mediaBox = inheritedMediaBox;
    const mbMatch = body.match(/\/MediaBox\s*\[\s*([^\]]+)\]/);
    if (mbMatch) {
      const nums = mbMatch[1].trim().split(/\s+/).map(Number);
      if (nums.length === 4 && nums.every(n => Number.isFinite(n))) {
        mediaBox = nums; // [x0 y0 x1 y1]
      }
    }

    if (isPage) {
      let width = 612, height = 792; // fallback Letter-ish
      if (mediaBox && mediaBox.length === 4) {
        const [, , x1, y1] = mediaBox;
        // en PDF MediaBox es [x0 y0 x1 y1], asumimos x0=y0=0 la mayoría de veces
        width = Number(x1) || width;
        height = Number(y1) || height;
      }

      outPages.push({
        pageObjId: objId,
        width,
        height,
        contentsRefs: extractContentsRefs(body),
        xObjectMap:   extractXObjectMap(body, index)
      });
      return;
    }

    if (isPages) {
      // /Kids [3 0 R 4 0 R ...]
      const kidsMatch = body.match(/\/Kids\s*\[\s*([^\]]+)\]/);
      if (!kidsMatch) return;

      const kidsRaw = kidsMatch[1];
      const refs = kidsRaw.match(/(\d+)\s+(\d+)\s+R/g) || [];

      for (const ref of refs) {
        const id = Number(ref.split(/\s+/)[0]);
        this.#walk(index, id, mediaBox, outPages);
      }
    }
  }
}

/**
 * Extrae referencias a Contents desde el body de una /Page.
 * Soporta:
 *  - /Contents 12 0 R
 *  - /Contents [12 0 R 13 0 R]
 * Devuelve solo objId (ignora gen).
 */
function extractContentsRefs(pageBody) {
  // Caso simple: /Contents 12 0 R
  const single = pageBody.match(/\/Contents\s+(\d+)\s+(\d+)\s+R/);
  if (single) return [Number(single[1])];

  // Caso array: /Contents [12 0 R 13 0 R]
  const arr = pageBody.match(/\/Contents\s*\[\s*([^\]]+)\]/);
  if (!arr) return [];

  const refs = arr[1].match(/(\d+)\s+(\d+)\s+R/g) || [];
  return refs.map(r => Number(r.split(/\s+/)[0]));
}

/**
 * Extrae el mapa nombre->objId de Form XObjects desde /Resources /XObject.
 * Soporta /Resources inline y /Resources como referencia a objeto externo.
 *
 * Ejemplo en el body de /Page:
 *   /Resources << /XObject << /Fm0 15 0 R /Fm1 16 0 R >> >>
 *
 * @param {string} pageBody
 * @param {PdfObjectIndex} index
 * @returns {Map<string, number>}  nombre -> objId
 */
function extractXObjectMap(pageBody, index) {
  const map = new Map();

  // Obtener el bloque de /Resources (inline o referencia)
  let resourcesBody = pageBody;

  const resRef = pageBody.match(/\/Resources\s+(\d+)\s+\d+\s+R/);
  if (resRef) {
    // /Resources es un objeto externo
    const resObj = index.getObject(Number(resRef[1]));
    if (resObj) resourcesBody = resObj.body;
  }

  // Buscar /XObject << ... >> dentro de Resources
  // Puede estar inline o como otra referencia
  const xobjRef = resourcesBody.match(/\/XObject\s+(\d+)\s+\d+\s+R/);
  if (xobjRef) {
    const xobjObj = index.getObject(Number(xobjRef[1]));
    if (xobjObj) resourcesBody = xobjObj.body;
  }

  const xobjInline = resourcesBody.match(/\/XObject\s*<<([\s\S]*?)>>/);
  if (!xobjInline) return map;

  const xobjBlock = xobjInline[1];

  // Parsear pares /Nombre ObjId 0 R
  const refRe = /\/([A-Za-z0-9_.]+)\s+(\d+)\s+\d+\s+R/g;
  let m;
  while ((m = refRe.exec(xobjBlock)) !== null) {
    map.set(m[1], Number(m[2]));
  }

  return map;
}
