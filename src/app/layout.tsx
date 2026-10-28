import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AccountBoundary } from "@/components/account-boundary";
import "./globals.css";
export const metadata: Metadata = { title: "Nourish — your personal food diary", description: "Track daily protein, carbohydrates, fat and calories with your own foods and recipes." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const live = process.env.NEXT_PUBLIC_DATA_MODE === "live";
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const content = live ? key ? <ClerkProvider publishableKey={key}><AccountBoundary>{children}</AccountBoundary></ClerkProvider> : <main className="access-screen"><h1>Finish setting up your private tracker</h1><p>Configure Clerk sign-in and your personal account before using live mode. Follow docs/PERSONAL_USE.md, then rebuild the app.</p></main> : children;
  return <html lang="en"><body>{content}</body></html>;
}
