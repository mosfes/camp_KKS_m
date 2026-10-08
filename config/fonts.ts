import { Kanit as FontSans } from "next/font/google";

export const fontSans = FontSans({
  subsets: ["latin", "thai"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const fontSansLight = FontSans({
  subsets: ["latin", "thai"],
  variable: "--font-sans-light",
  weight: "300",
  preload: false,
});
