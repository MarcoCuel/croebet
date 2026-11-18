import type { Metadata } from "next";
import { AdminAccess } from "@/features/admin/admin-access";

export const metadata: Metadata = { title: "Visão geral · Admin · Croebet" };

export default function Admin() {
  return <AdminAccess />;
}
