import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireBackend } from "./gateway";
export const uploadUrl = mutation({
  args: { backendSecret: v.string() },
  handler: async (ctx, args) => { requireBackend(args.backendSecret); return ctx.storage.generateUploadUrl(); },
});
export const save = mutation({
  args: { backendSecret: v.string(), record: v.object({ id: v.string(), ownerId: v.string(), storageId: v.string(), originalName: v.string(), mimeType: v.string(), sizeBytes: v.number(), status: v.union(v.literal("pending"), v.literal("analyzed"), v.literal("deleted")), createdAt: v.string() }) },
  handler: async (ctx, args) => { requireBackend(args.backendSecret); await ctx.db.insert("images", args.record); },
});
export const get = query({
  args: { backendSecret: v.string(), ownerId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    const image = await ctx.db.query("images").withIndex("by_owner_id", q => q.eq("ownerId", args.ownerId).eq("id", args.id)).first();
    if (!image || image.status === "deleted") return null;
    return { ...image, url: await ctx.storage.getUrl(image.storageId) };
  },
});
export const remove = mutation({
  args: { backendSecret: v.string(), ownerId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    const image = await ctx.db.query("images").withIndex("by_owner_id", q => q.eq("ownerId", args.ownerId).eq("id", args.id)).first();
    if (!image) return false;
    await ctx.storage.delete(image.storageId); await ctx.db.delete(image._id); return true;
  },
});
export const removeOrphan = mutation({
  args: { backendSecret: v.string(), storageId: v.string() },
  handler: async (ctx, args) => { requireBackend(args.backendSecret); await ctx.storage.delete(args.storageId); },
});
