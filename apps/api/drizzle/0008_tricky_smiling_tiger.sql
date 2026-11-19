CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"document" jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"show_in_menu" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "page_version_positive" CHECK ("pages"."version" > 0)
);

--> statement-breakpoint
-- Reference content only. Never imports browser-local edits.
INSERT INTO pages (slug,title,document,published,show_in_menu) VALUES
('sobre','Sobre','[{"tag":"h1","children":["Seu azar.",{"tag":"br","children":[]},"Nosso negócio."]},{"tag":"p","children":["Você traz a confiança.",{"tag":"br","children":[]},"A gente fica com os Croins.",{"tag":"br","children":[]},"Cada um contribui com o que tem."]},{"tag":"h2","children":["Uma casa com princípios. E interesses."]},{"tag":"p","children":["A Croebet reúne jogos de cassino, palpites da comunidade e gente absolutamente convencida de que descobriu um método. Gostamos especialmente dessa última parte."]},{"tag":"p","children":["Sob a administração da Croezinha, trabalhamos para que todo Croin encontre seu lugar. De preferência, no caixa da casa. Você pode discordar dessa filosofia. Inclusive, é o que torna tudo mais interessante."]},{"tag":"blockquote","children":[{"tag":"h2","children":["Todo Croin tem seu lugar"]},{"tag":"p","children":["Operamos exclusivamente com Croins. Você ganha, aposta e tenta multiplicar. A casa acompanha cada movimento com um interesse perfeitamente desinteressado. Principalmente quando os Croins voltam para cá."]}]},{"tag":"h2","children":["Ganhar é possível. Não precisa exagerar."]},{"tag":"p","children":["Às vezes, alguém ganha. Respeitamos as regras, creditamos os Croins e seguimos em frente com a discrição que esse momento desagradável exige. Não espere fogos do departamento financeiro."]},{"tag":"p","children":["Para quem perde, também há reconhecimento. O ranking de maiores perdedores existe porque certas contribuições merecem mais do que um simples obrigado."]},{"tag":"h2","children":["O chat tem sempre um especialista"]},{"tag":"p","children":["Que horas começa a live? Vai ter peruca? Quanto tempo de atraso? Opinião nunca faltou. Agora ela pode vir acompanhada de Croins. A convicção continua sendo sua. O resultado costuma ter outras ideias."]}]'::jsonb,true,true),
('termos','Termos de uso','[]'::jsonb,false,false),
('privacidade','Política de privacidade','[]'::jsonb,false,false);
