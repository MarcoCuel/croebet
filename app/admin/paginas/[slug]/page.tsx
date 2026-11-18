import type { Metadata } from "next";
import { AdminAccess } from "@/features/admin/admin-access";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug === "nova" ? "Nova página" : "Editar página"} · Admin · Croebet` };
}

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <AdminAccess section="pages" pageSlug={slug} />;
}
