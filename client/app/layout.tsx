import type { Metadata } from "next";
import "./globals.css";
 
export const metadata: Metadata = {
  title: "Sparrow Protocol | Yield Layer on Portaldot",
  description: "Isolated margin trading and money market on Portaldot",
};
 
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
 