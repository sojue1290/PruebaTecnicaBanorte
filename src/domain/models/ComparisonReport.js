export class ComparisonReport {
  constructor({ generatedAt, differences = [], pagesCompared = 0 } = {}) {
    this.generatedAt = generatedAt ?? new Date().toISOString();
    this.differences = differences;
    this.summary = {
      pagesCompared: Number(pagesCompared),
      diffs: differences.length,
    };
  }
}
