import { LcsDiffer } from "./LcsDiffer.js";
import { DiffEntry } from "../models/DiffEntry.js";
import { ComparisonReport } from "../models/ComparisonReport.js";

export class DocumentComparer {
  constructor() {
    this.differ = new LcsDiffer();
  }

  compare(docA, docB) {
    const maxPages = Math.max(docA.pageCount(), docB.pageCount());
    const differences = [];

    for (let p = 1; p <= maxPages; p++) {
      const pageA = docA.getPage(p);
      const pageB = docB.getPage(p);

      const seqA = pageA ? pageA.compareSequence() : [];
      const seqB = pageB ? pageB.compareSequence() : [];

      const ops = this.differ.diff(
        seqA.map(x => x.key),
        seqB.map(x => x.key)
      );

      let iA = 0;
      let iB = 0;

      for (const op of ops) {
        if (op.type === "equal") { iA++; iB++; continue; }

        if (op.type === "delete") {
          const a = seqA[iA];
          differences.push(new DiffEntry({
            page: p,
            kind: "REMOVED",
            anchor: a?.anchor ?? null,
            original: a?.display ?? "",
            evaluated: ""
          }));
          iA++;
          continue;
        }

        if (op.type === "insert") {
          const b = seqB[iB];
          differences.push(new DiffEntry({
            page: p,
            kind: "ADDED",
            anchor: b?.anchor ?? null,
            original: "",
            evaluated: b?.display ?? ""
          }));
          iB++;
          continue;
        }

        if (op.type === "replace") {
          const a = seqA[iA];
          const b = seqB[iB];
          differences.push(new DiffEntry({
            page: p,
            kind: "CHANGED",
            anchor: b?.anchor ?? a?.anchor ?? null,
            original: a?.display ?? "",
            evaluated: b?.display ?? ""
          }));
          iA++; iB++;
          continue;
        }
      }
    }

    return new ComparisonReport({
      pagesCompared: maxPages,
      differences
    });
  }
}
