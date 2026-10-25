import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_clerk_id", ["clerkId"]),

  foods: defineTable({
    id: v.string(), // canonical identifier
    name: v.string(),
    aliases: v.array(v.string()),
    category: v.string(),
    basis: v.union(v.literal("raw"), v.literal("cooked"), v.literal("as-served")),
    per100g: v.object({
      kcal: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
      fiber: v.optional(v.number()),
      sugar: v.optional(v.number()),
      sodium: v.optional(v.number()),
    }),
    standardServing: v.optional(
      v.object({
        unit: v.string(),
        grams: v.number(),
        description: v.optional(v.string()),
      })
    ),
    alternateServings: v.optional(
      v.array(
        v.object({
          unit: v.string(),
          grams: v.number(),
          description: v.optional(v.string()),
        })
      )
    ),
    source: v.string(),
    sourceVersion: v.string(),
    sourceId: v.optional(v.string()),
    attribution: v.string(),
    notes: v.optional(v.string()),
  })
    .index("by_food_id", ["id"])
    .index("by_category", ["category"]),

  recipes: defineTable({
    id: v.string(),
    ownerId: v.string(),
    name: v.string(),
    cookedYieldGrams: v.number(),
    rawTotalGrams: v.optional(v.number()),
    ingredients: v.array(
      v.object({
        id: v.string(),
        foodId: v.string(),
        name: v.string(),
        grams: v.number(),
        nutrients: v.object({
          kcal: v.number(),
          protein: v.number(),
          carbs: v.number(),
          fat: v.number(),
        }),
        source: v.string(),
        sourceVersion: v.string(),
        basis: v.union(v.literal("raw"), v.literal("cooked"), v.literal("as-served")),
        confirmed: v.boolean(),
      })
    ),
    version: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_recipe_id", ["ownerId", "id"]),

  meals: defineTable({
    id: v.string(),
    ownerId: v.string(),
    date: v.string(), // YYYY-MM-DD local date
    timezone: v.string(),
    type: v.union(v.literal("Breakfast"), v.literal("Lunch"), v.literal("Dinner"), v.literal("Snack")),
    title: v.string(),
    inputType: v.union(v.literal("manual"), v.literal("text"), v.literal("image")),
    imageId: v.optional(v.string()),
    items: v.array(
      v.object({
        id: v.string(),
        foodId: v.string(),
        name: v.string(),
        grams: v.number(),
        nutrients: v.object({
          kcal: v.number(),
          protein: v.number(),
          carbs: v.number(),
          fat: v.number(),
        }),
        source: v.string(),
        sourceVersion: v.string(),
        basis: v.union(v.literal("raw"), v.literal("cooked"), v.literal("as-served")),
        confirmed: v.boolean(),
        snapshot: v.optional(v.any()), // immutable provenance snapshot
      })
    ),
    createdAt: v.string(), // UTC ISO
    updatedAt: v.string(),
  })
    .index("by_owner_date", ["ownerId", "date"])
    .index("by_owner", ["ownerId"])
    .index("by_owner_meal_id", ["ownerId", "id"]),

  goals: defineTable({
    ownerId: v.string(),
    effectiveDate: v.string(), // YYYY-MM-DD
    mode: v.union(v.literal("cut"), v.literal("maintain"), v.literal("bulk")),
    kcal: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    createdAt: v.string(),
  })
    .index("by_owner_date", ["ownerId", "effectiveDate"])
    .index("by_owner", ["ownerId"]),

  images: defineTable({
    id: v.string(),
    ownerId: v.string(),
    storageId: v.string(),
    originalName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    status: v.union(v.literal("pending"), v.literal("analyzed"), v.literal("deleted")),
    createdAt: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_id", ["ownerId", "id"]),

  idempotencyKeys: defineTable({
    ownerId: v.string(),
    key: v.string(),
    statusCode: v.number(),
    responseBody: v.string(),
    createdAt: v.string(),
  })
    .index("by_owner_key", ["ownerId", "key"]),
});
