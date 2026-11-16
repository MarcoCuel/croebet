"use client";

import { useState } from "react";
import { useDemoSession } from "../navigation";

const markets = [
  {
    topic: "Congresso",
    question: "O projeto vai à votação nesta semana?",
    options: [{ outcome: "Vai à votação", odds: 180 }, { outcome: "Fica pra depois", odds: 200 }],
  },
  {
    topic: "Sabatina",
    question: "A sabatina termina antes das 18h?",
    options: [{ outcome: "Sim", odds: 220 }, { outcome: "Não", odds: 165 }],
  },
  {
    topic: "Debate",
    question: "O debate passa do horário previsto?",
    options: [{ outcome: "Passa", odds: 150 }, { outcome: "Termina no horário", odds: 245 }],
  },
];

const formatNumber = new Intl.NumberFormat("pt-BR");
const formatOdds = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 });
const primaryButton = "button min-h-10 cursor-pointer rounded-xl px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50";

export function Predictions() {
  const { username, balance, predictions, openLogin, placePrediction } = useDemoSession();
  const [selection, setSelection] = useState<{ market: string; outcome: string; odds: number } | null>(null);
  const [amount, setAmount] = useState("");
  const stake = Number(amount);
  const validStake = Number.isSafeInteger(stake) && stake >= 1 && stake <= balance;

  return (
    <div className="mt-7 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(17rem,0.45fr)]">
      <section className="grid gap-3.5" aria-label="Palpites de demonstração">
        {markets.map(({ topic, question, options }) => (
          <article className="rounded-panel bg-surface p-5 sm:p-6" key={question} data-enter>
            <p className="text-sm text-accent">{topic}</p>
            <h2 className="mt-1 text-xl font-bold">{question}</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {options.map(({ outcome, odds }) => (
                <button
                  key={outcome}
                  type="button"
                  className="flex min-h-11 flex-wrap items-center justify-between gap-x-2 rounded-xl bg-control px-3 py-2 text-left text-sm hover:bg-control-hover aria-pressed:border-accent aria-pressed:bg-card-oracle"
                  aria-pressed={selection?.market === question && selection.outcome === outcome}
                  onClick={() => setSelection({ market: question, outcome, odds })}
                >
                  {outcome} <span className="font-semibold tabular-nums text-accent">{formatOdds.format(odds / 100)}×</span>
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-panel bg-surface p-5 sm:p-6" aria-labelledby="ticket-title">
        <h2 className="text-xl font-bold" id="ticket-title">Seu bilhete</h2>
        {selection ? (
          <>
            <p className="mt-3 text-sm text-muted">{selection.market}</p>
            <p className="mt-1 font-semibold">{selection.outcome} · {formatOdds.format(selection.odds / 100)}×</p>
            {username ? (
              <form className="mt-4 grid gap-3" onSubmit={(event) => {
                event.preventDefault();
                if (!validStake) return;
                placePrediction({ ...selection, stake });
                setAmount("");
              }}>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Valor em Croins
                  <input className="min-h-11 w-full rounded-xl border-(length:--border-width-hairline) border-field-border bg-background px-3 text-base" type="number" min="1" max={balance} step="1" required value={amount} onChange={(event) => setAmount(event.currentTarget.value)} />
                </label>
                <p className="text-sm text-muted">Saldo disponível: {formatNumber.format(balance)} {balance === 1 ? "Croin" : "Croins"}</p>
                {validStake && <p className="text-sm text-muted">Retorno simulado: {formatNumber.format(Math.floor(stake * selection.odds / 100))} Croins</p>}
                <button className={primaryButton} type="submit" disabled={!validStake}>Registrar palpite</button>
              </form>
            ) : (
              <button className={`${primaryButton} mt-4`} type="button" aria-haspopup="dialog" onClick={openLogin}>Entrar para apostar</button>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Escolha um resultado para montar seu bilhete.</p>
        )}

        <div aria-live="polite">
          {predictions.length > 0 && (
            <div className="mt-5 border-t-(length:--border-width-hairline) border-border pt-4">
              <h3 className="font-semibold">Palpites da sessão</h3>
              <ul className="mt-3 grid gap-3 text-sm">
                {predictions.map(({ market, outcome, stake, odds }, index) => (
                  <li key={predictions.length - index}>
                    <p className="font-semibold">{market}</p>
                    <p className="text-muted">{outcome} · {formatOdds.format(odds / 100)}× · {formatNumber.format(stake)} {stake === 1 ? "Croin" : "Croins"}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
