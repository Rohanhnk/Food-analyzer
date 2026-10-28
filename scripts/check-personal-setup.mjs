import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const checks = [
  ["NEXT_PUBLIC_DATA_MODE", process.env.NEXT_PUBLIC_DATA_MODE === "live"],
  ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", /^pk_(test|live)_/.test(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "") && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("placeholder")],
  ["CLERK_SECRET_KEY", /^sk_(test|live)_/.test(process.env.CLERK_SECRET_KEY ?? "") && !process.env.CLERK_SECRET_KEY?.includes("placeholder")],
  ["PERSONAL_USER_ID", /^user_/.test(process.env.PERSONAL_USER_ID ?? "")],
  ["NEXT_PUBLIC_CONVEX_URL", /^https:\/\/.+\.convex\.cloud\/?$/.test(process.env.NEXT_PUBLIC_CONVEX_URL ?? "") && !process.env.NEXT_PUBLIC_CONVEX_URL?.includes("your-deployment")],
  ["NOURISH_BACKEND_SECRET", (process.env.NOURISH_BACKEND_SECRET?.length ?? 0) >= 32],
  ["APP_ORIGIN", /^https:\/\/[^/]+$|^http:\/\/localhost:\d+$/.test(process.env.APP_ORIGIN ?? "")],
];
for (const [name, okay] of checks) console.log(`${okay ? "OK" : "NEEDS SETUP"}: ${name}`);
console.log("AI: " + (process.env.ENABLE_AI === "true" ? "enabled; requires separate provider configuration" : "disabled (manual logging works without it)"));
console.log("This checks local configuration only, not credentials, database deployment, or connectivity. Never share secret values in chat.");
if (checks.some(([, okay]) => !okay)) process.exitCode = 1;
