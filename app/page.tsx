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
      <section className="grid min-h-[clamp(440px,42vw,560px)] place-items-center rounded-b-panel bg-surface bg-[radial-gradient(ellipse_at_50%_108%,var(--color-hero-glow)_0,var(--color-hero-halo)_30%,transparent_63%)] px-5 pt-[115px] pb-[66px] text-center" aria-labelledby="hero-title">
        <div data-enter>
          <h1 className="display-heading max-w-[14ch]" id="hero-title">O cassino onde <em className="text-accent not-italic">até o saldo</em> é piada.</h1>
          <p className="mx-auto mt-[22px] text-balance text-muted">Jogos de sorte, previsões duvidosas e dinheiro de mentira.</p>
          <Link className="button button-lg mt-[26px]" href="/jogos">Explorar jogos <ArrowUpRightIcon className="size-5" aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="mt-[38px]" aria-labelledby="about-title">
        <h2 className="section-heading" id="about-title" data-enter>Como funciona a Croebet</h2>
        <div className="mt-3.5 grid grid-cols-3 gap-3.5 max-[720px]:grid-cols-1">
          {highlights.map(({ title, description, Icon }) => (
            <article className="relative isolate min-h-[210px] overflow-hidden rounded-panel bg-surface p-[clamp(20px,3vw,33px)] nth-2:bg-card-oracle nth-3:bg-card-luck max-[720px]:min-h-[155px]" key={title} data-enter>
              <h3 className="text-[clamp(21px,2.7vw,36px)] leading-[1.08] font-bold tracking-[-.045em]">{title}</h3>
              <p className="mt-2.5 max-w-[26ch] text-card-copy">{description}</p>
              <Icon className="absolute right-[13px] -bottom-[47px] -z-10 size-[180px] -rotate-[14deg] text-accent/20" weight="fill" aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
