export const UNITS = ["g", "piece", "bowl", "cup", "tbsp", "tsp", "ml", "serving", "slice", "glass", "plate"] as const;
export type Unit = typeof UNITS[number];
export type Basis = "raw" | "cooked" | "as-served";
export type DetectedFood = {
  name: string;
  quantity: number | null;
  unit: Unit | null;
  basis: Basis | null;
  warnings: string[];
};
export type RecognitionResult = { foods: DetectedFood[]; warnings: string[] };
export type RecognitionInput = { kind: "text"; text: string } | { kind: "image"; bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" | "image/webp" };
/** Provider returns untrusted JSON. The interpreter validates every response. */
export interface ModelProvider { interpret(input: RecognitionInput): Promise<unknown> }
export type RecognitionErrorCode = "INVALID_INPUT" | "NOT_CONFIGURED" | "TIMEOUT" | "RATE_LIMITED" | "PROVIDER_FAILURE" | "REFUSAL" | "TRUNCATED" | "INVALID_OUTPUT";
export class RecognitionError extends Error {
  constructor(public readonly code: RecognitionErrorCode, message: string) { super(message); this.name = "RecognitionError"; }
}
export const LIMITS = { textCharacters: 4000, imageBytes: 5 * 1024 * 1024, foods: 20, responseBytes: 128 * 1024 } as const;
