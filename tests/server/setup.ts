import { beforeEach } from "vitest";
import { setAuthVerifier } from "@/server/auth";
beforeEach(() => setAuthVerifier({ async verifyRequest(req) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  return token?.startsWith("test-user-") ? { userId: token, tokenIdentifier: `test|${token}` } : null;
} }));

import { setRecognitionTestProvider } from "@/server/recognition-provider";
import { analysisRateLimiter } from "@/server/rate-limiter";
beforeEach(() => {
  analysisRateLimiter.reset();
  setRecognitionTestProvider({ async interpret() { return { foods: [
    { name: "roti", quantity: 2, unit: "piece", basis: "cooked", warnings: [] },
    { name: "paneer", quantity: 100, unit: "g", basis: null, warnings: [] },
  ], warnings: ["Test fixture response."] }; } });
});
