import type { Metadata } from "next";
import "./style.css";
export const metadata: Metadata = { title: "Brainbight — Admin", description: "Brainbight operational dashboard." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
