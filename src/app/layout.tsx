"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import ThemeSelector from "./ThemeSelector";
import { Button } from "@/components/ui/button";
import "./globals.css";

const models = [
  { name: "Volume & Backlog", href: "/" },
  { name: "CPH Model", href: "/models/cph" },
  { name: "Fix FTE Model", href: "/models/fix-fte" },
  { name: "Fix HC Model", href: "/models/fix-hc" },
  { name: "Billable Hours", href: "/models/billable-hours" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased"
        )}
      >
        <div className="flex flex-col h-screen">
          <header className="sticky top-0 z-50 bg-background p-4 border-b border-border">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-semibold text-foreground">
                Tactical Capacity Insights
              </h1>
              <ThemeSelector />
            </div>
            <nav className="mt-4">
              <div className="flex space-x-1 border-b">
                {models.map((model) => (
                  <Link key={model.href} href={model.href} passHref>
                    <Button
                      variant="ghost"
                      className={cn(
                        "rounded-none rounded-t-md border-b-2",
                        pathname === model.href
                          ? "border-primary text-primary"
                          : "border-transparent"
                      )}
                    >
                      {model.name}
                    </Button>
                  </Link>
                ))}
              </div>
            </nav>
          </header>
          <main className="flex-grow p-4 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
