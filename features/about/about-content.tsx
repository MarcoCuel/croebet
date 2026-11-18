"use client";

import { RichTextContent } from "@/components/ui/rich-text-content";
import { Heading } from "@/components/shared/heading";
import { Card } from "@/components/ui/card";
import { useSiteConfig } from "@/features/admin/site-config";

export function AboutContent() {
  const {
    config: { about },
  } = useSiteConfig();
  if (about.document)
    return (
      <RichTextContent
        document={about.document}
        className="mx-auto max-w-[46rem]"
      />
    );
  return (
    <div className="mx-auto max-w-[46rem]">
      <header>
        <Heading asChild variant="display">
          <h1 className="whitespace-pre-line">{about.title}</h1>
        </Heading>
        <p className="mt-4 max-w-[55ch] whitespace-pre-line text-lg text-muted">
          {about.intro}
        </p>
      </header>
      {about.sections.map((section, index) => {
        const content = (
          <section aria-labelledby={`about-section-${index}`}>
            <Heading
              id={`about-section-${index}`}
              className={index === 1 ? "text-xl" : undefined}
            >
              {section.title}
            </Heading>
            {section.paragraphs.map((paragraph, i) => (
              <p
                key={i}
                className="mt-3 whitespace-pre-line leading-relaxed text-muted"
              >
                {paragraph}
              </p>
            ))}
          </section>
        );
        return index === 1 ? (
          <Card key={index} className="mt-7 p-5 sm:p-8">
            {content}
          </Card>
        ) : (
          <div key={index} className="mt-10">
            {content}
          </div>
        );
      })}
    </div>
  );
}
