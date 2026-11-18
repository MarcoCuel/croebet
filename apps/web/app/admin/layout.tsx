import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Admin · Croebet",
  description: null,
  robots: { index: false, follow: false },
};
export default function AdminLayout({ children }: { children: ReactNode }) {
  // Replace with verified server authorization when the backend is integrated.
  if (process.env.NODE_ENV !== "development") notFound();
  return <PageShell>{children}</PageShell>;
}
