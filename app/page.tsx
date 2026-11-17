import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import {
  CoinsIcon,
  DiceFiveIcon,
  TrophyIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";

const highlights = [
  {
    title: "Seu dinheiro não nos interessa",
    description:
      "Aceitamos apenas Croins. Seu dinheiro de verdade não vale nada aqui. O nosso também não.",
    Icon: CoinsIcon,
  },
  {
    title: "A casa torce contra você",
    description:
      "Temos roleta, caça-níqueis e blackjack. Você tem esperança. Achamos uma troca justa.",
    Icon: DiceFiveIcon,
  },
  {
    title: "Até perder merece reconhecimento",
    description:
      "Dispute rankings, conquiste emblemas e prove que você consegue ser o pior apostador da comunidade.",
    Icon: TrophyIcon,
  },
];


export default function Home() {
  return (
    <main className="shell -mt-(--header-space)">
      <section className="grid place-items-center px-5 pt-44 pb-20 text-center max-[38rem]:pt-49" aria-labelledby="hero-title">
        <div data-enter>
          <h1 className="display-heading" id="hero-title">A casa de apostas que mais torce pela <em className="text-accent not-italic">sua derrota</em>.</h1>
          <p className="mx-auto mt-5 text-balance text-muted max-w-160">Jogue, aposte e tente multiplicar seus Croins. Temos jogos, rankings e uma equipe inteira dedicada a ver você perder tudo. Mas não desanime, amanhã tem mais.</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link className="button button-lg" href="/login">Vire membro</Link>
            <Link className="button button-lg" href="/jogos">Explorar jogos</Link>
          </div>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="about-title">
        <div className="mt-3.5 grid grid-cols-3 gap-3.5 max-[45rem]:grid-cols-1">
          {highlights.map(({ title, description, Icon }) => (
            <article className="relative isolate min-h-80 overflow-hidden rounded-panel bg-surface p-[clamp(1.25rem,3vw,2rem)] nth-2:bg-card-oracle nth-3:bg-card-luck max-[45rem]:min-h-39" key={title} data-enter>
              <h3 className="text-[clamp(1.25rem,2.7vw,2.25rem)] leading-[1.08] font-bold tracking-[-.045em]">{title}</h3>
              <p className="mt-2.5 max-w-[26ch] text-card-copy">{description}</p>
              <Icon className="absolute right-[2rem] -bottom-[2rem] -z-10 size-[12rem] -rotate-[14deg] text-accent/20" weight="fill" aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
