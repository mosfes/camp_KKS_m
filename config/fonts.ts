import { Kanit as FontSans } from "next/font/google";

export const fontSans = FontSans({
  subsets: ["latin", "thai"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"], //
});
