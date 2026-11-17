"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useDemoSession } from "@/features/auth/session-context";
import { formatBalance } from "@/features/wallet/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { formatOdds } from "./markets";
import type { Selection } from "./types";

export function PredictionTicket({
  selection,
}: {
  selection: Selection | null;
}) {
  const { username, balance, predictions, openLogin, placePrediction } =
    useDemoSession();
  const [amount, setAmount] = useState("");
  const stake = Number(amount);
  const validStake =
    Number.isSafeInteger(stake) && stake >= 1 && stake <= balance;
  return (
    <Card
      asChild
      className="p-5 sm:p-5 lg:sticky lg:top-[calc(var(--header-height)+1rem)]"
    >
      <section aria-labelledby="ticket-title" id="bilhete" tabIndex={-1}>
        <h2 className="text-xl font-bold" id="ticket-title">
          Seu bilhete
        </h2>
        {selection ? (
          <>
            <p className="mt-3 text-sm text-muted">{selection.market}</p>
            <p className="mt-1 font-semibold">
              {selection.outcome} · {formatOdds.format(selection.odds / 100)}×
            </p>
            {username ? (
              <form
                className="mt-4 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!validStake) return;
                  placePrediction({ ...selection, stake });
                  setAmount("");
                  toast.success("Palpite registrado.");
                }}
              >
                <Field>
                  Valor em Croins
                  <Input
                    type="number"
                    min="1"
                    max={balance}
                    step="1"
                    required
                    value={amount}
                    onChange={(event) => setAmount(event.currentTarget.value)}
                  />
                </Field>
                <p className="text-sm text-muted">
                  Saldo disponível: {formatBalance.format(balance)}{" "}
                  {balance === 1 ? "Croin" : "Croins"}
                </p>
                {validStake && (
                  <p className="text-sm text-muted">
                    Retorno simulado:{" "}
                    {formatBalance.format(
                      Math.floor((stake * selection.odds) / 100),
                    )}{" "}
                    Croins
                  </p>
                )}
                <Button type="submit" disabled={!validStake}>
                  Registrar palpite
                </Button>
              </form>
            ) : (
              <Button
                className="mt-4"
                aria-haspopup="dialog"
                onClick={openLogin}
              >
                Entrar para apostar
              </Button>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Escolha um resultado para montar seu bilhete.
          </p>
        )}
        <div aria-live="polite">
          {predictions.length > 0 && (
            <div className="mt-5 border-t-(length:--border-width-hairline) border-border pt-4">
              <h3 className="font-semibold">Palpites da sessão</h3>
              <ul className="mt-3 grid gap-3 text-sm">
                {predictions.map(({ market, outcome, stake, odds }, index) => (
                  <li key={predictions.length - index}>
                    <p className="font-semibold">{market}</p>
                    <p className="text-muted">
                      {outcome} · {formatOdds.format(odds / 100)}× ·{" "}
                      {formatBalance.format(stake)}{" "}
                      {stake === 1 ? "Croin" : "Croins"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </Card>
  );
}
