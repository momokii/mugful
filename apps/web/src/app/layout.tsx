import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  description:
    "A private shared room for two people who care about each other.",
  title: {
    default: "Mugful | A shared room for two",
    template: "%s | Mugful",
  },
};

export const viewport = { colorScheme: "light dark", themeColor: "#F7F8F6" };

type RootLayoutProperties = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProperties) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
