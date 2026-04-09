import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gmail Agent Admin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: "2rem" }}>
        {children}
      </body>
    </html>
  );
}
