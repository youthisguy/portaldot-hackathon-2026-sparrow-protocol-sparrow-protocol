import type { Metadata } from "next";
import "./globals.css";
import { ChainProvider } from "./context/ChainContext";
import Header from "./components/Header";
import Toasts from "./components/Toasts";
 
export const metadata: Metadata = {
  title: "Sparrow | Yield Layer on Portaldot",
  description: "Isolated margin trading and money market on Portaldot",
};
 
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <ChainProvider>
          <Header />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          <Toasts />
        </ChainProvider>
      </body>
    </html>
  );
}
