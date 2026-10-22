import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Nourish — a little more balanced", description: "An Indian-food-aware meal and macro tracker. Frontend demo." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
