import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Conquistas · Croebet" };

export default function Conquistas() {
  redirect("/");
}
