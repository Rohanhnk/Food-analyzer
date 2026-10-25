import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as uploadImage } from "@/app/api/uploads/route";
import { POST as createMeal } from "@/app/api/meals/route";
import { GET as getMeal } from "@/app/api/meals/[id]/route";
import { GET as healthCheck } from "@/app/api/health/route";
import { defaultStorage } from "@/server/storage/in-memory";
import { uploadRateLimiter } from "@/server/rate-limiter";

describe("Photo Pipeline, Error Handling, and Health Checks", () => {
  const user = "test-user-photos";

  beforeEach(() => {
    defaultStorage.clearAll();
    uploadRateLimiter.reset();
  });

  describe("Photo Upload and Validation Pipeline", () => {
    it("rejects unauthenticated uploads with 401", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/jpeg" }));

      const req = new NextRequest("http://localhost:3000/api/uploads", {
        method: "POST",
        body: formData,
      });

      const res = await uploadImage(req);
      expect(res.status).toBe(401);
    });

    it("rejects spoofed files whose magic bytes do not match declared image/jpeg", async () => {
      // Plain text pretending to be JPEG
      const fakeText = "This is a text file masquerading as a JPEG.";
      const formData = new FormData();
      formData.append("file", new Blob([fakeText], { type: "image/jpeg" }), "fake.jpg");

      const req = new NextRequest("http://localhost:3000/api/uploads", {
        method: "POST",
        headers: { authorization: `Bearer ${user}` },
        body: formData,
      });

      const res = await uploadImage(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe("INVALID_INPUT");
      expect(data.error.message).toContain("File content does not match");
    });

    it("accepts valid JPEG and PNG uploads and returns imageId", async () => {
      // Valid JPEG header: FF D8 FF E0 00 10 4A 46 49 46 00 01
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const formData = new FormData();
      formData.append("file", new Blob([jpeg], { type: "image/jpeg" }), "photo.jpg");

      const req = new NextRequest("http://localhost:3000/api/uploads", {
        method: "POST",
        headers: { authorization: `Bearer ${user}` },
        body: formData,
      });

      const res = await uploadImage(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.imageId).toMatch(/^img_/);
    });

    it("rejects oversized uploads with HTTP 413 PAYLOAD_TOO_LARGE", async () => {
      // Create a buffer larger than 10MB
      const hugeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);
      hugeBuffer[0] = 0xff;
      hugeBuffer[1] = 0xd8;
      hugeBuffer[2] = 0xff;

      const formData = new FormData();
      formData.append("file", new Blob([hugeBuffer], { type: "image/jpeg" }), "huge.jpg");

      const req = new NextRequest("http://localhost:3000/api/uploads", {
        method: "POST",
        headers: { authorization: `Bearer ${user}` },
        body: formData,
      });

      const res = await uploadImage(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error.code).toBe("PAYLOAD_TOO_LARGE");
    });

    it("enforces upload rate limiting and returns HTTP 429", async () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

      const sendUpload = async () => {
        const formData = new FormData();
        formData.append("file", new Blob([validJpeg], { type: "image/jpeg" }), "photo.jpg");
        return uploadImage(
          new NextRequest("http://localhost:3000/api/uploads", {
            method: "POST",
            headers: { authorization: `Bearer ${user}` },
            body: formData,
          })
        );
      };

      // Burst 10 allowed uploads
      for (let i = 0; i < 10; i++) {
        const res = await sendUpload();
        expect(res.status).toBe(201);
      }

      // 11th upload should trigger rate limiting (429)
      const rateLimitedRes = await sendUpload();
      expect(rateLimitedRes.status).toBe(429);
      const data = await rateLimitedRes.json();
      expect(data.error.code).toBe("RATE_LIMITED");
    });
  });

  describe("API Error Responses and Edge Cases", () => {
    it("returns 400 for malformed JSON request body", async () => {
      const req = new NextRequest("http://localhost:3000/api/meals", {
        method: "POST",
        headers: {
          authorization: `Bearer ${user}`,
          "content-type": "application/json",
        },
        body: "{ bad_json: invalid ",
      });

      const res = await createMeal(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe("INVALID_INPUT");
    });

    it("returns 400 for invalid dates or negative portion weights", async () => {
      // Bad date
      const badDateRes = await createMeal(
        new NextRequest("http://localhost:3000/api/meals", {
          method: "POST",
          headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
          body: JSON.stringify({
            date: "not-a-date",
            timezone: "Asia/Kolkata",
            type: "Lunch",
            title: "Test",
            inputType: "manual",
            items: [{ foodId: "roti-chapati-cooked", grams: 50 }],
          }),
        })
      );
      expect(badDateRes.status).toBe(400);

      // Negative grams
      const badGramsRes = await createMeal(
        new NextRequest("http://localhost:3000/api/meals", {
          method: "POST",
          headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
          body: JSON.stringify({
            date: "2026-10-25",
            timezone: "Asia/Kolkata",
            type: "Lunch",
            title: "Test",
            inputType: "manual",
            items: [{ foodId: "roti-chapati-cooked", grams: -50 }],
          }),
        })
      );
      expect(badGramsRes.status).toBe(400);
    });

    it("returns 404 for unknown food or meal IDs", async () => {
      // Unknown meal
      const res = await getMeal(
        new NextRequest("http://localhost:3000/api/meals/non-existent-id-12345", {
          method: "GET",
          headers: { authorization: `Bearer ${user}` },
        }),
        { params: Promise.resolve({ id: "non-existent-id-12345" }) }
      );
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error.code).toBe("NOT_FOUND");
    });

    it("returns healthy status from GET /api/health", async () => {
      const res = await healthCheck();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.service).toBe("food-analyzer-api");
    });
  });
});
