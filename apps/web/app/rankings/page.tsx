import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Rankings · Croebet" };

export default function Rankings() {
  redirect("/");
}
