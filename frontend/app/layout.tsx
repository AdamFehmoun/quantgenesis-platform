import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuantGenesis",
  description: "Plateforme de stratégies algorithmiques",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
