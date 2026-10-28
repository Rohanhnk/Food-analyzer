import type { RecognitionResult } from "../src/types";
import type { EvaluationCase } from "./cases";
export type Observation = { result?: RecognitionResult; error?: string; latencyMs?: number };
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export function evaluate(cases: EvaluationCase[], observations: Record<string, Observation>) {
  let tp = 0, fp = 0, fn = 0, failed = 0, completed = 0, comparedAmounts = 0, exactAmounts = 0, gramCount = 0, gramError = 0, basisCount = 0, basisCorrect = 0;
  const latency: number[] = [];
  for (const entry of cases) {
    const observation = observations[entry.id];
    if (!observation) continue;
    if (observation.latencyMs !== undefined) latency.push(observation.latencyMs);
    if (!observation.result) { failed++; fn += entry.expected.length; continue; }
    completed++;
    const unmatched = [...observation.result.foods];
    for (const expected of entry.expected) {
      const names = [expected.name, ...expected.aliases].map(normalize);
      const index = unmatched.findIndex(f => names.includes(normalize(f.name)) && (entry.expected.filter(e => e.name === expected.name).length === 1 || f.basis === expected.basis));
      if (index < 0) { fn++; continue; }
      tp++; const [actual] = unmatched.splice(index, 1);
      comparedAmounts++;
      if (actual.quantity === expected.quantity && actual.unit === expected.unit) exactAmounts++;
      if (expected.basis !== null) { basisCount++; if (actual.basis === expected.basis) basisCorrect++; }
      if (expected.unit === "g" && actual.unit === "g" && expected.quantity !== null && actual.quantity !== null) { gramCount++; gramError += Math.abs(actual.quantity - expected.quantity); }
    }
    fp += unmatched.length;
  }
  return { corpusSize: cases.length, attempted: completed + failed, completed, failed, unrun: cases.length - completed - failed,
    recognition: { truePositives: tp, falsePositives: fp, falseNegatives: fn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null },
    declaredAmounts: { compared: comparedAmounts, exact: exactAmounts, accuracy: comparedAmounts ? exactAmounts / comparedAmounts : null, gramComparisons: gramCount, gramMae: gramCount ? gramError / gramCount : null },
    basis: { compared: basisCount, correct: basisCorrect },
    measuredPortionMaeGrams: null, nutrientMae: null,
    latencyMs: latency.length ? { count: latency.length, mean: latency.reduce((a, b) => a + b, 0) / latency.length } : null,
    limitations: ["Synthetic text annotations, not weighed meals or real photo observations.", "Name scoring uses explicit aliases; inspect false negatives for legitimate alternate names.", "Amount metrics are conditional on matched foods; inspect recall alongside them.", "Photo recognition, measured portion error and downstream nutrient error require independently collected references."],
  };
}
