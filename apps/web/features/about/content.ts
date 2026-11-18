import type { RichTextDocument, RichTextNode } from "@/lib/rich-text";

export const defaultAbout = {
  title: "Seu azar.\nNosso negócio.",
  intro:
    "Você traz a confiança.\nA gente fica com os Croins.\nCada um contribui com o que tem.",
  sections: [
    {
      title: "Uma casa com princípios. E interesses.",
      paragraphs: [
        "A Croebet reúne jogos de cassino, palpites da comunidade e gente absolutamente convencida de que descobriu um método. Gostamos especialmente dessa última parte.",
        "Sob a administração da Croezinha, trabalhamos para que todo Croin encontre seu lugar. De preferência, no caixa da casa. Você pode discordar dessa filosofia. Inclusive, é o que torna tudo mais interessante.",
      ],
    },
    {
      title: "Todo Croin tem seu lugar",
      paragraphs: [
        "Operamos exclusivamente com Croins. Você ganha, aposta e tenta multiplicar. A casa acompanha cada movimento com um interesse perfeitamente desinteressado. Principalmente quando os Croins voltam para cá.",
      ],
    },
    {
      title: "Ganhar é possível. Não precisa exagerar.",
      paragraphs: [
        "Às vezes, alguém ganha. Respeitamos as regras, creditamos os Croins e seguimos em frente com a discrição que esse momento desagradável exige. Não espere fogos do departamento financeiro.",
        "Para quem perde, também há reconhecimento. O ranking de maiores perdedores existe porque certas contribuições merecem mais do que um simples obrigado.",
      ],
    },
    {
      title: "O chat tem sempre um especialista",
      paragraphs: [
        "Que horas começa a live? Vai ter peruca? Quanto tempo de atraso? Opinião nunca faltou. Agora ela pode vir acompanhada de Croins. A convicção continua sendo sua. O resultado costuma ter outras ideias.",
      ],
    },
  ],
};

export type AboutContent = typeof defaultAbout & {
  document?: RichTextDocument;
};

export function aboutDocument(about: AboutContent): RichTextDocument {
  if (about.document) return about.document;
  const lines = (text: string): RichTextDocument =>
    text
      .split("\n")
      .flatMap(
        (line, i): RichTextDocument =>
          i === 0 ? [line] : [{ tag: "br", children: [] }, line],
      );
  return [
    { tag: "h1", children: lines(about.title) },
    { tag: "p", children: lines(about.intro) },
    ...about.sections.flatMap((section, index): RichTextNode[] => {
      const children: RichTextDocument = [
        { tag: "h2", children: [section.title] },
        ...section.paragraphs.map(
          (paragraph): RichTextNode => ({
            tag: "p",
            children: lines(paragraph),
          }),
        ),
      ];
      return index === 1 ? [{ tag: "blockquote", children }] : children;
    }),
  ];
}
