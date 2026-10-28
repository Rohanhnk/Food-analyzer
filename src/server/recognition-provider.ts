import { MealInterpreter, OpenAIProvider, type ModelProvider } from "@nourish/recognition";
let testProvider: ModelProvider | undefined;
export function setRecognitionTestProvider(provider: ModelProvider) {
  if (process.env.NODE_ENV !== "test") throw new Error("Recognition test injection is unavailable outside tests.");
  testProvider = provider;
}
export function getInterpreter(): MealInterpreter {
  return new MealInterpreter(process.env.NODE_ENV === "test" && testProvider ? testProvider : new OpenAIProvider({
    apiKey: process.env.RECOGNITION_API_KEY ?? "",
    model: process.env.RECOGNITION_MODEL ?? "gpt-4.1-mini",
  }));
}
