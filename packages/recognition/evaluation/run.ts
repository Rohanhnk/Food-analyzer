import { readFile, writeFile } from "node:fs/promises";
import { MealInterpreter, OpenAIProvider, PROMPT_VERSION, validateResult } from "../src/index";
import { evaluationCases } from "./cases";
import { evaluate, type Observation } from "./metrics";
const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const observations: Record<string, Observation> = {};
const live = args.includes("--live");
const responses = flag("--responses");
if (live && responses) throw new Error("Choose either --live or --responses.");
if (responses) {
  const records = JSON.parse(await readFile(responses, "utf8"));
  for (const [id, value] of Object.entries(records)) {
    if (!evaluationCases.some(c => c.id === id)) throw new Error(`Unknown evaluation case ${id}`);
    observations[id] = { result: validateResult(value) };
  }
}
if (live) {
  const limit = Number(flag("--limit") ?? 5);
  if (!Number.isInteger(limit) || limit < 1 || limit > evaluationCases.length) throw new Error("Invalid evaluation limit.");
  const interpreter = new MealInterpreter(new OpenAIProvider({ apiKey: process.env.RECOGNITION_API_KEY ?? "", model: process.env.RECOGNITION_MODEL }));
  for (const entry of evaluationCases.slice(0, limit)) {
    const start = performance.now();
    try { observations[entry.id] = { result: await interpreter.interpretText(entry.text), latencyMs: performance.now() - start }; }
    catch (error) { observations[entry.id] = { error: error instanceof Error ? error.message : "Failed", latencyMs: performance.now() - start }; }
  }
}
const report = { schemaVersion: 1, promptVersion: PROMPT_VERSION, runAt: new Date().toISOString(), mode: live ? "live" : responses ? "recorded-responses" : "inventory-only", model: live ? process.env.RECOGNITION_MODEL ?? "gpt-4.1-mini" : null, ...evaluate(evaluationCases, observations) };
await writeFile(flag("--output") ?? "/tmp/recognition-evaluation.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
