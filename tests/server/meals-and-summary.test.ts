import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as createMeal, GET as getMeals } from "@/app/api/meals/route";
import { PATCH as updateMeal, DELETE as deleteMeal } from "@/app/api/meals/[id]/route";
import { GET as getSummary } from "@/app/api/summary/route";
import { defaultStorage } from "@/server/storage/in-memory";

describe("Meal Write Path, Idempotency and Daily Summaries", () => {
  const user = "test-user-meals";

  beforeEach(() => {
    defaultStorage.clearAll();
  });

  it("calculates meal nutrients on the server and attaches immutable snapshots", async () => {
    const req = new NextRequest("http://localhost:3000/api/meals", {
      method: "POST",
      headers: {
        authorization: `Bearer ${user}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        date: "2026-10-25",
        timezone: "Asia/Kolkata",
        type: "Breakfast",
        title: "Morning Rotis",
        inputType: "manual",
        items: [
          {
            foodId: "roti-chapati-cooked",
            grams: 70, // 2 rotis
            confirmed: true,
            // Client deliberately attempts to send fake macros
            nutrients: { kcal: 9999, protein: 999, carbs: 999, fat: 999 },
          },
        ],
      }),
    });

    const res = await createMeal(req);
    expect(res.status).toBe(201);

    const { meal } = await res.json();
    expect(meal.items.length).toBe(1);

    // Verify server recalculated from authoritative source (roti per 100g = 297 kcal)
    // 70g = 207.9 kcal, NOT client's 9999!
    expect(meal.items[0].nutrients.kcal).toBeCloseTo(207.9, 1);
    expect(meal.items[0].nutrients.protein).toBeCloseTo(6.6, 1);
    expect(meal.items[0].source).toBe("IFCT 2017, ICMR-NIN");
    expect(meal.items[0].sourceVersion).toBe("2017.1");
    expect(meal.items[0].basis).toBe("cooked");
  });

  it("makes repeated submissions safe with Idempotency-Key deduplication", async () => {
    const idempotencyKey = "unique-client-key-12345";

    const payload = JSON.stringify({
      date: "2026-10-25",
      timezone: "Asia/Kolkata",
      type: "Dinner",
      title: "Idempotent Dal & Rice",
      inputType: "manual",
      items: [
        { foodId: "toor-dal-cooked", grams: 150, confirmed: true },
        { foodId: "white-rice-cooked", grams: 150, confirmed: true },
      ],
    });

    const makeReq = () =>
      new NextRequest("http://localhost:3000/api/meals", {
        method: "POST",
        headers: {
          authorization: `Bearer ${user}`,
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: payload,
      });

    // 1. First submission
    const res1 = await createMeal(makeReq());
    expect(res1.status).toBe(201);
    const data1 = await res1.json();

    // 2. Second repeated submission with same key
    const res2 = await createMeal(makeReq());
    expect(res2.status).toBe(201);
    expect(res2.headers.get("X-Idempotent-Replay")).toBe("true");
    const data2 = await res2.json();

    // Must return the exact same meal ID
    expect(data2.meal.id).toBe(data1.meal.id);

    // Verify meal is NOT duplicated in database
    const listReq = new NextRequest("http://localhost:3000/api/meals?date=2026-10-25", {
      method: "GET",
      headers: { authorization: `Bearer ${user}` },
    });
    const listRes = await getMeals(listReq);
    const { meals } = await listRes.json();
    expect(meals.length).toBe(1);
  });

  it("updates daily summaries correctly across create, edit, and delete lifecycle", async () => {
    // Set custom goal: 2000 kcal, 100g P, 250g C, 60g F
    await defaultStorage.saveGoal(
      user,
      { mode: "maintain", kcal: 2000, protein: 100, carbs: 250, fat: 60 },
      "2026-10-25"
    );

    // Initial summary: 0 consumed, 2000 remaining
    const sumReq1 = new NextRequest("http://localhost:3000/api/summary?date=2026-10-25", {
      method: "GET",
      headers: { authorization: `Bearer ${user}` },
    });
    const sumRes1 = await getSummary(sumReq1);
    const sum1 = await sumRes1.json();
    expect(sum1.consumed.kcal).toBe(0);
    expect(sum1.remaining.kcal).toBe(2000);
    expect(sum1.mealCount).toBe(0);

    // 1. Create meal: 1 glass milk (200g -> 134 kcal, 6.4g P, 9.2g C, 7.8g F)
    const createReq = new NextRequest("http://localhost:3000/api/meals", {
      method: "POST",
      headers: {
        authorization: `Bearer ${user}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        date: "2026-10-25",
        timezone: "Asia/Kolkata",
        type: "Breakfast",
        title: "Morning Milk",
        inputType: "manual",
        items: [{ foodId: "cow-milk-boiled", grams: 200, confirmed: true }],
      }),
    });
    const createRes = await createMeal(createReq);
    const { meal } = await createRes.json();

    // Summary after create
    const sumRes2 = await getSummary(sumReq1);
    const sum2 = await sumRes2.json();
    expect(sum2.consumed.kcal).toBeCloseTo(134, 1);
    expect(sum2.remaining.kcal).toBeCloseTo(2000 - 134, 1);
    expect(sum2.mealCount).toBe(1);

    // 2. Edit meal: change milk portion from 200g to 400g (2 glasses -> 268 kcal)
    const patchReq = new NextRequest(`http://localhost:3000/api/meals/${meal.id}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${user}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        items: [{ foodId: "cow-milk-boiled", grams: 400, confirmed: true }],
      }),
    });
    const patchRes = await updateMeal(patchReq, { params: Promise.resolve({ id: meal.id }) });
    expect(patchRes.status).toBe(200);

    // Summary after edit
    const sumRes3 = await getSummary(sumReq1);
    const sum3 = await sumRes3.json();
    expect(sum3.consumed.kcal).toBeCloseTo(268, 1);
    expect(sum3.remaining.kcal).toBeCloseTo(2000 - 268, 1);

    // 3. Delete meal
    const deleteReq = new NextRequest(`http://localhost:3000/api/meals/${meal.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${user}` },
    });
    const deleteRes = await deleteMeal(deleteReq, { params: Promise.resolve({ id: meal.id }) });
    expect(deleteRes.status).toBe(204);

    // Summary after delete
    const sumRes4 = await getSummary(sumReq1);
    const sum4 = await sumRes4.json();
    expect(sum4.consumed.kcal).toBe(0);
    expect(sum4.remaining.kcal).toBe(2000);
    expect(sum4.mealCount).toBe(0);
  });

  it("handles date and timezone boundaries cleanly without grouping solely by UTC", async () => {
    // Log meal for 2026-10-24
    await createMeal(
      new NextRequest("http://localhost:3000/api/meals", {
        method: "POST",
        headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
        body: JSON.stringify({
          date: "2026-10-24",
          timezone: "Asia/Kolkata",
          type: "Dinner",
          title: "Yesterday Dinner",
          inputType: "manual",
          items: [{ foodId: "roti-chapati-cooked", grams: 70, confirmed: true }],
        }),
      })
    );

    // Log meal for 2026-10-25
    await createMeal(
      new NextRequest("http://localhost:3000/api/meals", {
        method: "POST",
        headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
        body: JSON.stringify({
          date: "2026-10-25",
          timezone: "Asia/Kolkata",
          type: "Dinner",
          title: "Today Dinner",
          inputType: "manual",
          items: [{ foodId: "toor-dal-cooked", grams: 150, confirmed: true }],
        }),
      })
    );

    // Summary for 2026-10-24
    const sum24Res = await getSummary(
      new NextRequest("http://localhost:3000/api/summary?date=2026-10-24&timezone=Asia/Kolkata", {
        method: "GET",
        headers: { authorization: `Bearer ${user}` },
      })
    );
    const sum24 = await sum24Res.json();
    expect(sum24.date).toBe("2026-10-24");
    expect(sum24.mealCount).toBe(1);
    expect(sum24.consumed.kcal).toBeCloseTo(207.9, 1);

    // Summary for 2026-10-25
    const sum25Res = await getSummary(
      new NextRequest("http://localhost:3000/api/summary?date=2026-10-25&timezone=Asia/Kolkata", {
        method: "GET",
        headers: { authorization: `Bearer ${user}` },
      })
    );
    const sum25 = await sum25Res.json();
    expect(sum25.date).toBe("2026-10-25");
    expect(sum25.mealCount).toBe(1);
    expect(sum25.consumed.kcal).toBeCloseTo(156.0, 1);
  });

  it("preserves historical meal snapshots when catalog nutrition changes", async () => {
    // 1. Log a meal using current roti (297 kcal / 100g)
    const createRes = await createMeal(
      new NextRequest("http://localhost:3000/api/meals", {
        method: "POST",
        headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
        body: JSON.stringify({
          date: "2026-10-25",
          timezone: "Asia/Kolkata",
          type: "Lunch",
          title: "Historic Roti Meal",
          inputType: "manual",
          items: [{ foodId: "roti-chapati-cooked", grams: 100, confirmed: true }],
        }),
      })
    );
    const { meal } = await createRes.json();
    expect(meal.items[0].nutrients.kcal).toBe(297);

    // 2. Future catalog update occurs (e.g. food database updated to 350 kcal)
    const currentRoti = await defaultStorage.findFoodById("roti-chapati-cooked");
    await defaultStorage.importFoods([
      {
        ...currentRoti!,
        per100g: { ...currentRoti!.per100g, kcal: 350 },
        sourceVersion: "2027.1",
      },
    ]);

    // 3. Fetch historic meal again
    const fetchReq = new NextRequest(`http://localhost:3000/api/meals/${meal.id}`, {
      method: "GET",
      headers: { authorization: `Bearer ${user}` },
    });
    const fetchRes = await getMeals(fetchReq);
    const { meals } = await fetchRes.json();
    const fetchedMeal = meals.find((m: { id: string }) => m.id === meal.id);

    // Historic snapshot is preserved at 297 kcal and was NOT rewritten!
    expect(fetchedMeal.items[0].nutrients.kcal).toBe(297);
    expect(fetchedMeal.items[0].sourceVersion).toBe("2017.1");
  });
});
