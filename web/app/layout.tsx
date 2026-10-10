import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = { title: "Brainbight — Your hands-free space", description: "A calmer way to move through your phone. Voice and gesture accessibility controls, on your terms." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
