export class LcsDiffer {
  diff(a, b) {
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = (a[i] === b[j]) ? (1 + dp[i + 1][j + 1]) : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const ops = [];
    let i = 0, j = 0;

    while (i < n && j < m) {
      if (a[i] === b[j]) { ops.push({ type: "equal" }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: "delete" }); i++; }
      else { ops.push({ type: "insert" }); j++; }
    }
    while (i < n) { ops.push({ type: "delete" }); i++; }
    while (j < m) { ops.push({ type: "insert" }); j++; }

    // merge delete+insert => replace
    // Consume bloques completos de delete/insert contiguos para generar N replaces correctos.
    // Ejemplo: [del, del, ins, ins] -> [replace, replace] (no [del, replace, ins])
    const merged = [];
    let k = 0;
    while (k < ops.length) {
      if (ops[k].type !== "delete" && ops[k].type !== "insert") {
        merged.push(ops[k++]);
        continue;
      }
      let dels = 0, ins = 0, j = k;
      while (j < ops.length && (ops[j].type === "delete" || ops[j].type === "insert")) {
        ops[j].type === "delete" ? dels++ : ins++;
        j++;
      }
      const replaces = Math.min(dels, ins);
      for (let r = 0; r < replaces; r++) merged.push({ type: "replace" });
      for (let r = 0; r < dels - replaces; r++) merged.push({ type: "delete" });
      for (let r = 0; r < ins - replaces; r++) merged.push({ type: "insert" });
      k = j;
    }
    return merged;
  }
}
