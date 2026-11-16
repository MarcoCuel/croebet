import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { ClubIcon } from "@phosphor-icons/react/dist/ssr/Club";
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/ssr/CurrencyDollar";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import Link from "next/link";

const highlights = [
  { title: "Seu boleto está a salvo", description: "O saldo é fictício. Seu boleto segue sendo um problema de verdade.", Icon: CurrencyDollarIcon },
  { title: "O oráculo tem Wi-Fi", description: "Tarô, lua cheia e bola de cristal. A ciência pediu para ficar de fora.", Icon: SparkleIcon },
  { title: "Azar também dá história", description: "Quando der tudo errado, diga que estava só testando.", Icon: ClubIcon },
];

export default function Home() {
  return (
    <main className="shell -mt-(--header-space)">
      <section className="grid min-h-[clamp(25rem,40vw,30rem)] place-items-center px-5 pt-38 pb-16 text-center max-[38rem]:pt-49" aria-labelledby="hero-title">
        <div data-enter>
          <h1 className="display-heading max-w-[40rem]" id="hero-title">A maior bet <em className="text-accent not-italic">sem vergonha</em> do Brasil</h1>
          <p className="mx-auto mt-5 text-balance text-muted">Jogos de sorte, previsões duvidosas e dinheiro de mentira.</p>
          <Link className="button button-lg mt-6" href="/jogos">Bora jogar <ArrowUpRightIcon className="size-5" aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="about-title">
        <div className="mt-3.5 grid grid-cols-3 gap-3.5 max-[45rem]:grid-cols-1">
          {highlights.map(({ title, description, Icon }) => (
            <article className="relative isolate min-h-75 overflow-hidden rounded-panel bg-surface p-[clamp(1.25rem,3vw,2rem)] nth-2:bg-card-oracle nth-3:bg-card-luck max-[45rem]:min-h-39" key={title} data-enter>
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
