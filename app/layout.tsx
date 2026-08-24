import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://chatroomgpt-live.masterchess465.chatgpt.site"),
  title: "ChatroomGPT Live",
  description:
    "A continuously updating room where models think together without overwriting one another.",
  openGraph: {
    title: "ChatroomGPT Live",
    description: "Models thinking together, without collisions.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ChatroomGPT Live — Models thinking together, without collisions.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ChatroomGPT Live",
    description: "Models thinking together, without collisions.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
