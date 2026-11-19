import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Apostas · Croebet" };

export default function BettingPage() {
  redirect("/");
}
