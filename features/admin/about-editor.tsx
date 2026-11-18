"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { richTextPlainText } from "@/lib/rich-text";
import { aboutDocument } from "@/features/about/content";
import { useSiteConfig } from "@/features/admin/site-config";

export function AboutEditor() {
  const { config, save } = useSiteConfig();
  const [document, setDocument] = useState(() => aboutDocument(config.about));
  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!richTextPlainText(document).trim()) {
          toast.error("Escreva o conteúdo da página antes de salvar.");
          return;
        }
        await save({ ...config, about: { ...config.about, document } });
      }}
    >
      <RichTextEditor
        label="Conteúdo da página Sobre"
        initialValue={document}
        onChange={setDocument}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Salvar Sobre</Button>
        <Button asChild variant="secondary">
          <Link href="/sobre">Ver página</Link>
        </Button>
      </div>
    </form>
  );
}
