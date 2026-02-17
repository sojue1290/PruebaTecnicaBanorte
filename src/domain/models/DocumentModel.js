import { PageModel } from "./PageModel.js";

export class DocumentModel {
  constructor({ pages = [] } = {}) {
    this.pages = pages.map(p => (p instanceof PageModel ? p : new PageModel(p)));
  }

  pageCount() {
    return this.pages.length;
  }

  getPage(pageNumber) {
    return this.pages.find(p => p.pageNumber === pageNumber) ?? null;
  }
}
