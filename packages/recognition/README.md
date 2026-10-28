# Person 4 — meal recognition

Standalone TypeScript package with a provider-independent `ModelProvider`, strict JSON output validation, `MealInterpreter` and an OpenAI adapter. It identifies candidate foods and declared quantities; it never calculates calories or macros. Nutrition lookup and calculation remain in `@nourish/nutrition`.

## Use

```ts
const interpreter = new MealInterpreter(new OpenAIProvider({
  apiKey: process.env.RECOGNITION_API_KEY!,
  model: process.env.RECOGNITION_MODEL ?? "gpt-4.1-mini",
}));
const result = await interpreter.interpretText("2 rotis and 100g paneer");
```

Run this on the server only. `OpenAIProvider` uses Node Buffer for image encoding. There is no runtime mock-provider fallback. Missing configuration returns an explicit service error. Tests inject provider fixtures independently of credentials.

## Contract and limits

Each candidate has `name`, `quantity`, `unit`, `basis` and `warnings`. Quantity/unit are both null when unknown. Units preserve grams, pieces, bowls, cups, teaspoons, tablespoons, millilitres, servings, slices, glasses and plates. Basis is raw/cooked/as-served or null. Extra fields, including calories/macros, are rejected. The schema limits names, warning strings, item counts and numeric ranges.

- Text: 1–4,000 characters; at most 20 detected foods.
- Photos: JPEG/PNG/WebP, up to 5 MB. Backend decoding limits 16 megapixels, corrects orientation, removes metadata and resizes to fit 1536 pixels before the provider call.
- Provider: fixed HTTPS OpenAI Chat Completions endpoint, strict JSON schema, `store: false`, 1,800 output tokens, low-detail vision, 15-second timeout per attempt and one transient retry by default. Maximum configured retries: two. Response-body limit: 128 KiB.
- Retry only transient transport failures, timeouts, HTTP 429 and server errors. Refusals, truncated output, invalid JSON/schema and configuration failures are explicit errors.
- A photo result claiming grams or ml is converted to an unresolved amount with warnings. Piece counts remain estimates requiring review.
- Prompt text and image text are untrusted input. System instructions prohibit instruction overrides and nutrient fabrication. Runtime validation remains mandatory regardless of prompt wording.

Typed package errors: `INVALID_INPUT`, `NOT_CONFIGURED`, `TIMEOUT`, `RATE_LIMITED`, `PROVIDER_FAILURE`, `REFUSAL`, `TRUNCATED`, `INVALID_OUTPUT`. API mapping: 400, 503, 504, 429, 502, 422, 502 and 502 respectively. Public error messages never include raw provider response bodies or API keys.

## Integration

`src/server/recognition-service.ts` validates provider output, matches candidates against the catalog, respects preparation basis, and returns explicit match choices. Unknown and ambiguous dishes are not silently replaced with a top match. No meal is saved during analysis.

Both analysis routes require authentication and consume a per-user analysis rate-limit token. Image IDs are owner-scoped before any provider call. The current limiter is process-local; a distributed quota/cost budget remains required before production scaling.

`HttpClient.analyzePhoto(file)` uploads a temporary image, calls analysis and deletes the upload in `finally`, including on provider failure. Successful analysis waits for cleanup. If cleanup fails, the caller receives an error; server-side retention cleanup is still needed for browser disconnects/network loss. The frontend shows image previews and an explicit Analyze action in live mode. It preserves warnings and asks for manual grams instead of inventing conversions. Demo mode retains its clearly marked local parser and preview-only image input.

## Validation and evaluation

```bash
npm run check
npm run build
npm run evaluate:recognition
```

The default evaluation command performs **no model calls**. It inventories 60 synthetic, manually annotated text descriptions and writes `/tmp/recognition-evaluation.json` with `attempted: 0`, `unrun: 60`, and null accuracy metrics. These annotations are not measured meal references and cannot establish model accuracy.

To evaluate recorded raw responses, pass a JSON object mapping case IDs to schema-conforming recognition results:

```bash
npm run evaluate:recognition -- --responses /path/to/responses.json --output /tmp/report.json
```

For an explicitly requested paid provider evaluation with configured credentials:

```bash
npm run evaluate:recognition -- --live --limit 5 --output /tmp/live-report.json
```

Only `--live` makes API requests. Failed calls remain failures and produce a nonzero exit status; unrun cases are counted separately. Reports include prompt version, model, latency, classification precision/recall, explicit quantity agreement and raw/cooked agreement. Declared-gram error is reported separately from measured-portion error. Photo/real-world portion accuracy and downstream nutrient error remain null until independent reference measurements exist.

See `evaluation/STATUS.md` for current evidence and outstanding corpus work. Run browser smoke tests with the repository's Playwright instructions. Provider contract tests mock HTTP responses; they do not establish real provider compatibility or model accuracy.
