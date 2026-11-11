import type { Metadata } from "next";
// Fonts are bundled from npm so the site works on an offline lab network.
import "@fontsource/titillium-web/400.css";
import "@fontsource/titillium-web/600.css";
import "@fontsource/titillium-web/700.css";
import "@fontsource/titillium-web/900.css";
import "@fontsource/titillium-web/400-italic.css";
import "@fontsource/titillium-web/700-italic.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "FunPro GP",
  description: "FunPro Grand Prix: a Formula 1 themed coding contest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
