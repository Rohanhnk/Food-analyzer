import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as createMeal, GET as getMeals } from "@/app/api/meals/route";
import { PATCH as updateMeal, DELETE as deleteMeal } from "@/app/api/meals/[id]/route";
import { GET as getSummary } from "@/app/api/summary/route";
import { POST as uploadImage } from "@/app/api/uploads/route";
import { DELETE as deleteImage } from "@/app/api/uploads/[id]/route";
import { GET as getRecipes } from "@/app/api/recipes/route";
import { defaultStorage } from "@/server/storage/in-memory";

describe("Server Authentication and Cross-User Isolation", () => {
  beforeEach(() => {
    defaultStorage.clearAll();
  });

  it("rejects unauthenticated requests with HTTP 401 UNAUTHENTICATED", async () => {
    // Missing Authorization header
    const req = new NextRequest("http://localhost:3000/api/meals", {
      method: "GET",
    });

    const res = await getMeals(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error.code).toBe("UNAUTHENTICATED");
  });

  it("does not trust client-supplied userId without valid token", async () => {
    // Attacker tries to pass ?userId=victim or spoof headers
    const req = new NextRequest("http://localhost:3000/api/summary?date=2026-10-25&userId=victim", {
      method: "GET",
      headers: {
        "x-user-id": "victim",
      },
    });

    const res = await getSummary(req);
    expect(res.status).toBe(401);
  });

  it("enforces strict cross-user isolation: User A cannot read, edit, or delete User B's meals", async () => {
    // 1. User B creates a meal
    const userBToken = "test-user-b";
    const createReq = new NextRequest("http://localhost:3000/api/meals", {
      method: "POST",
      headers: {
        authorization: `Bearer ${userBToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        date: "2026-10-25",
        timezone: "Asia/Kolkata",
        type: "Lunch",
        title: "User B's Private Lunch",
        inputType: "manual",
        items: [{ foodId: "roti-chapati-cooked", grams: 70, confirmed: true }],
      }),
    });

    const createRes = await createMeal(createReq);
    expect(createRes.status).toBe(201);
    const { meal: userBMeal } = await createRes.json();

    // 2. User A attempts to list meals for that date
    const userAToken = "test-user-a";
    const listReq = new NextRequest("http://localhost:3000/api/meals?date=2026-10-25", {
      method: "GET",
      headers: { authorization: `Bearer ${userAToken}` },
    });

    const listRes = await getMeals(listReq);
    expect(listRes.status).toBe(200);
    const { meals: userAMeals } = await listRes.json();
    // User A should see 0 meals
    expect(userAMeals.length).toBe(0);

    // 3. User A attempts to PATCH User B's meal
    const patchReq = new NextRequest(`http://localhost:3000/api/meals/${userBMeal.id}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${userAToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Hacked Title" }),
    });

    const patchRes = await updateMeal(patchReq, { params: Promise.resolve({ id: userBMeal.id }) });
    expect(patchRes.status).toBe(404); // returns 404 because meal does not exist in User A's realm

    // 4. User A attempts to DELETE User B's meal
    const deleteReq = new NextRequest(`http://localhost:3000/api/meals/${userBMeal.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${userAToken}` },
    });

    const deleteRes = await deleteMeal(deleteReq, { params: Promise.resolve({ id: userBMeal.id }) });
    expect(deleteRes.status).toBe(404);

    // Verify User B's meal still exists intact
    const verifyReq = new NextRequest(`http://localhost:3000/api/meals?date=2026-10-25`, {
      method: "GET",
      headers: { authorization: `Bearer ${userBToken}` },
    });
    const verifyRes = await getMeals(verifyReq);
    const { meals: stillThere } = await verifyRes.json();
    expect(stillThere.length).toBe(1);
    expect(stillThere[0].title).toBe("User B's Private Lunch");
  });

  it("enforces strict image isolation: User A cannot delete User B's image", async () => {
    // 1. User B uploads valid JPEG
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const formData = new FormData();
    formData.append("file", new Blob([jpegBuffer], { type: "image/jpeg" }), "b.jpg");

    const uploadReq = new NextRequest("http://localhost:3000/api/uploads", {
      method: "POST",
      headers: { authorization: "Bearer test-user-b" },
      body: formData,
    });

    const uploadRes = await uploadImage(uploadReq);
    expect(uploadRes.status).toBe(201);
    const { imageId } = await uploadRes.json();

    // 2. User A attempts to delete User B's image
    const deleteReq = new NextRequest(`http://localhost:3000/api/uploads/${imageId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer test-user-a" },
    });

    const deleteRes = await deleteImage(deleteReq, { params: Promise.resolve({ id: imageId }) });
    expect(deleteRes.status).toBe(404); // Not found in caller's authorization scope
  });

  it("isolates recipes across independent user identities", async () => {
    await defaultStorage.saveRecipe("test-user-b", {
      id: "recipe-b-secret",
      name: "Secret Recipe B",
      ingredients: [],
      cookedYieldGrams: 200,
    });

    const reqA = new NextRequest("http://localhost:3000/api/recipes", {
      method: "GET",
      headers: { authorization: "Bearer test-user-a" },
    });

    const resA = await getRecipes(reqA);
    const { recipes: recipesA } = await resA.json();
    expect(recipesA.some((r: { id: string }) => r.id === "recipe-b-secret")).toBe(false);
  });
});
