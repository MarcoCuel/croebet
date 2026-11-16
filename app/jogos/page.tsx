import type { Metadata } from "next";
import Link from "next/link";
import { games, upcoming } from "./catalogo";

export const metadata: Metadata = { title: "Jogos | Croebet" };

export default function Games() {
  return (
    <main className="shell inner">
      <header data-enter>
        <h1 className="display-heading">Nossos jogos</h1>
        <p className="mt-3.5 text-muted">Escolha sua próxima superstição.</p>
      </header>
      <ul className="mt-7 grid grid-cols-4 gap-3.5 max-[720px]:grid-cols-2">
        {games.map(({ slug, name, type, Icon, cover }) => (
          <li key={slug} data-enter>
            <Link className="group block rounded-panel" href={`/jogos/${slug}`}>
              <div className={`game-cover group-hover:brightness-[1.14] ${cover}`} aria-hidden="true">
                <Icon weight="fill" />
              </div>
              <div className="px-0.5 pt-3 pb-[5px]">
                <h2 className="text-[clamp(16px,2vw,22px)] leading-[1.18] font-bold">{name}</h2>
                <p className="mt-1 text-sm text-muted">{type}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <section className="mt-[42px]" aria-labelledby="upcoming-title">
        <h2 className="section-heading" id="upcoming-title">Em breve</h2>
        <ul className="mt-3 grid grid-cols-3 gap-2.5 max-[720px]:grid-cols-2">{upcoming.map((name) => <li className="rounded-xl bg-surface p-3.5 text-muted" key={name}>{name}</li>)}</ul>
      </section>
    </main>
  );
}
