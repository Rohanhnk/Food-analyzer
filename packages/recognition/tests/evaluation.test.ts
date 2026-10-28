import { expect, it } from "vitest";
import { evaluationCases } from "../evaluation/cases";
import { evaluate } from "../evaluation/metrics";
it("provides 60 uniquely identified, explicitly synthetic cases", () => {
  expect(evaluationCases).toHaveLength(60);
  expect(new Set(evaluationCases.map(c => c.id)).size).toBe(60);
  expect(evaluationCases.every(c => c.groundTruth === "synthetic-text-annotation")).toBe(true);
});
it("separates unrun, failed, recognition and amount errors", () => {
  const cases = evaluationCases.slice(0, 3);
  const report = evaluate(cases, { [cases[0].id]: { result: { foods: [{ name: "chapati", quantity: 3, unit: "piece", basis: null, warnings: [] }, { name: "invented", quantity: null, unit: null, basis: null, warnings: [] }], warnings: [] } }, [cases[1].id]: { error: "timeout" } });
  expect(report).toMatchObject({ attempted: 2, completed: 1, failed: 1, unrun: 1, recognition: { truePositives: 1, falsePositives: 1, falseNegatives: 1 }, declaredAmounts: { compared: 1, exact: 0 }, measuredPortionMaeGrams: null, nutrientMae: null });
});
it("does not report accuracy for an unexecuted run", () => {
  const report = evaluate(evaluationCases, {});
  expect(report.recognition.precision).toBeNull(); expect(report.recognition.recall).toBeNull();
  expect(report.attempted).toBe(0); expect(report.unrun).toBe(60);
});
