import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServerAuthVerifier } from "@/server/auth";
import { ConvexStorageRepository } from "@/server/storage/convex-storage";
import { HttpClient } from "@/lib/http-client";
afterEach(() => vi.unstubAllEnvs());
it("runtime verifier does not accept forged test identities", async () => {
  vi.stubEnv("CLERK_SECRET_KEY", "");
  const verifier = new ServerAuthVerifier();
  for (const token of ["test-user-admin", "user_test_victim"]) {
    const req = new NextRequest("https://example.test/api/meals", { headers: { authorization: `Bearer ${token}` } });
    expect(await verifier.verifyRequest(req)).toBeNull();
  }
});
it("live storage fails closed instead of silently selecting memory", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", ""); vi.stubEnv("NOURISH_BACKEND_SECRET", "");
  expect(() => new ConvexStorageRepository().listMealsByDate("user", "2026-10-26")).toThrow();
});
it("loads all pages including meals beyond the first 50", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = String(input);
    const body = url.includes("/api/meals") ? (url.includes("cursor=") ? { meals: [{ id: "older" }], nextCursor: null } : { meals: Array.from({ length: 50 }, (_, i) => ({ id: String(i) })), nextCursor: "49" }) : url.includes("goals") ? { goal: {} } : { recipes: [] };
    return Response.json(body);
  });
  try { const data = await new HttpClient().load(); expect(data.meals).toHaveLength(51); expect(data.meals.at(-1)?.id).toBe("older"); }
  finally { fetchMock.mockRestore(); }
});
