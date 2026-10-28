import { LIMITS, RecognitionError, type ModelProvider, type RecognitionInput, type RecognitionResult } from "./types";
import { validateResult } from "./schema";
export function validateInput(input: RecognitionInput): void {
  if (input.kind === "text") {
    if (typeof input.text !== "string" || !input.text.trim() || input.text.length > LIMITS.textCharacters)
      throw new RecognitionError("INVALID_INPUT", `Enter a meal description between 1 and ${LIMITS.textCharacters} characters.`);
  } else {
    if (!["image/jpeg", "image/png", "image/webp"].includes(input.mimeType) || !input.bytes.length || input.bytes.length > LIMITS.imageBytes)
      throw new RecognitionError("INVALID_INPUT", "Use a JPEG, PNG or WebP image no larger than 5 MB.");
  }
}
export class MealInterpreter {
  constructor(private readonly provider: ModelProvider) {}
  async interpret(input: RecognitionInput): Promise<RecognitionResult> {
    validateInput(input);
    const result = validateResult(await this.provider.interpret(input));
    for (const food of result.foods) {
      // A photograph cannot establish measured mass or liquid volume.
      if (input.kind === "image") {
        if (food.unit === "g" || food.unit === "ml") { food.quantity = null; food.unit = null; }
        food.warnings.push("Photo portions are estimates. Confirm the food, weight, hidden ingredients and cooking oil.");
      }
      if (food.quantity === null) food.warnings.push("Quantity is unknown. Enter a measured weight or confirmed serving.");
      if (food.basis === null) food.warnings.push("Confirm whether the food was weighed raw or cooked.");
    }
    result.warnings.push("Review every food and portion before saving. Recognition does not calculate nutrition.");
    if (!result.foods.length) result.warnings.push("No food was identified. Search and log your meal manually.");
    return result;
  }
  interpretText(text: string) { return this.interpret({ kind: "text", text }); }
  interpretImage(bytes: Uint8Array, mimeType: Extract<RecognitionInput, { kind: "image" }>["mimeType"]) { return this.interpret({ kind: "image", bytes, mimeType }); }
}
