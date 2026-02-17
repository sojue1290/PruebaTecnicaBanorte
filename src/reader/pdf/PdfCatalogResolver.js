export class PdfCatalogResolver {
  findCatalog(objects) {
    for (const obj of objects) {
      if (/\/Type\s*\/Catalog\b/.test(obj.body)) {
        return obj;
      }
    }
    return null;
  }

  getPagesRootRef(catalogObj) {
    const match = catalogObj.body.match(/\/Pages\s+(\d+)\s+(\d+)\s+R/);
    if (!match) return null;
    return Number(match[1]);
  }
}
