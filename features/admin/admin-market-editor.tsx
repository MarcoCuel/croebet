"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSiteConfig } from "@/features/admin/site-config";
import { useMarketActivities } from "@/features/admin/market-activity";
import {
  changeLocalMarketStatus,
  deleteLocalMarket,
  payLocalMarket,
  resolveLocalMarket,
  saveLocalMarket,
} from "@/features/betting/betting-storage";
import {
  marketStatuses,
  type Market,
  type Settlement,
} from "@/features/betting/markets";
import { makeSettlement } from "@/features/betting/settlement";
import { formatBalance } from "@/features/wallet/wallet";

const value = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();
function localDate(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
const tabs = {
  config: "Configuração",
  participants: "Participantes",
  settlement: "Finalização",
} as const;
type Confirmation = "close" | "resolve" | "cancel" | "pay" | "delete" | null;

export function AdminMarketEditor({ id }: { id: string }) {
  const { config } = useSiteConfig();
  const router = useRouter();
  const creating = id === "nova";
  const [draft] = useState<Market>(() => ({
    id: crypto.randomUUID(),
    question: "",
    criterion: "",
    type: "binary",
    options: ["Sim", "Não"],
    status: "draft",
    endsAt: null,
  }));
  const market = creating ? draft : config.markets.find((m) => m.id === id);
  const [tab, setTab] = useState<keyof typeof tabs>("config");
  const [type, setType] = useState<Market["type"]>(market?.type ?? "binary");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const { activities, error } = useMarketActivities(config.markets);
  if (!market) notFound();
  const stats = activities.get(market.id) ?? {
    entries: [],
    legacyCount: 0,
    legacyEntries: [],
    total: 0,
    participants: 0,
  };
  const entries = stats.entries;
  const locked = !!entries.length || !!stats.legacyCount;
  const editable = ["draft", "open", "paused"].includes(market.status);
  const resolved = market.status === "resolved";
  const finished = ["paid", "cancelled"].includes(market.status);
  const resultValue =
    market.type === "number" ? `${Number(result)} ${market.unit}` : result;
  const distribution = [...new Set(entries.map((e) => e.outcome))]
    .map((outcome) => ({
      outcome,
      amount: entries
        .filter((e) => e.outcome === outcome)
        .reduce((sum, e) => sum + e.stake, 0),
    }))
    .sort((a, b) => b.amount - a.amount);
  let preview: Settlement | null = null;
  if (market.status === "closed" && result && !market.settlement)
    try {
      preview = makeSettlement(
        market,
        entries,
        resultValue,
        "preview",
        new Date().toISOString(),
      );
    } catch {
      /* An incomplete result has no preview. */
    }
  const plan = market.settlement ?? preview;
  const paidCount = market.settlement
    ? entries.filter((e) => e.settlementId === market.settlement?.id).length
    : 0;
  async function run(
    action: () => Promise<unknown>,
    message: string,
    after?: () => void,
  ) {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await action();
      setConfirmation(null);
      toast.success(message);
      after?.();
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a operação. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  const confirmations = {
    close: {
      title: "Encerrar o recebimento de apostas?",
      detail:
        "Novos palpites serão bloqueados. Depois, informe o resultado na finalização.",
      button: "Confirmar encerramento",
      action: () => changeLocalMarketStatus(market.id, "closed"),
      success: "Apostas encerradas.",
    },
    resolve: {
      title: "Confirmar este resultado?",
      detail: `Resultado: ${resultValue}. O resultado e os valores calculados ficarão bloqueados. Os Croins serão creditados na etapa de pagamento.`,
      button: "Confirmar apuração",
      action: () => resolveLocalMarket(market.id, resultValue),
      success: "Resultado apurado. Revise e confirme os pagamentos.",
    },
    cancel: {
      title: "Cancelar a aposta e preparar as devoluções?",
      detail: `Serão devolvidos ${formatBalance.format(stats.total)} Croins. A aposta será bloqueada e as devoluções deverão ser confirmadas na próxima etapa.`,
      button: "Preparar devoluções",
      action: () => resolveLocalMarket(market.id, null, true),
      success: "Devoluções preparadas. Confirme o pagamento para concluir.",
    },
    pay: {
      title:
        market.settlement?.kind === "refund"
          ? "Confirmar as devoluções?"
          : "Confirmar os pagamentos?",
      detail: `Total da liquidação: ${formatBalance.format(market.settlement?.total ?? 0)} Croins. Recibos já concluídos não serão pagos novamente.`,
      button: "Confirmar pagamento",
      action: () => payLocalMarket(market.id),
      success: "Liquidação concluída.",
    },
    delete: {
      title: "Excluir esta aposta sem participantes?",
      detail: "Esta ação remove a aposta do catálogo.",
      button: "Excluir aposta",
      action: () => deleteLocalMarket(market.id),
      success: "Aposta excluída.",
    },
  };
  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <h1 className="max-w-[45ch] text-xl font-semibold">
          {creating ? "Nova aposta" : market.question}
        </h1>
        <span className="rounded-lg bg-control px-3 py-1 text-xs">
          {marketStatuses[market.status]}
        </span>
      </div>
      {error && (
        <Card role="alert" className="mb-4">
          {error}
        </Card>
      )}
      {failure && (
        <Card role="alert" className="mb-4 text-sm text-destructive">
          {failure}
        </Card>
      )}
      {!creating && (
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            ["Croins apostados", formatBalance.format(stats.total)],
            ["Participantes", stats.participants],
            ["Palpites", entries.length],
            ["Recibos concluídos", `${paidCount}/${entries.length}`],
          ].map(([label, amount]) => (
            <Card key={label} className="p-4 sm:p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">
                {amount}
              </p>
            </Card>
          ))}
        </div>
      )}
      {!!stats.legacyCount && (
        <Card className="mb-5 text-sm" role="status">
          Há {stats.legacyCount} palpites antigos sem identificação nesta
          pergunta. Eles foram preservados e não entram nos totais nem nos
          pagamentos automáticos. Esses registros exigem conferência separada e
          permanecerão fora desta liquidação.
        </Card>
      )}
      {!creating && (
        <div
          className="mb-5 flex flex-wrap gap-2"
          role="group"
          aria-label="Ações da aposta"
        >
          {market.status === "draft" && (
            <Button
              size="sm"
              disabled={busy || !!error}
              onClick={() =>
                run(
                  () => changeLocalMarketStatus(market.id, "open"),
                  "Aposta publicada.",
                )
              }
            >
              Publicar aposta
            </Button>
          )}
          {market.status === "open" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !!error}
              onClick={() =>
                run(
                  () => changeLocalMarketStatus(market.id, "paused"),
                  "Aposta pausada.",
                )
              }
            >
              Pausar aposta
            </Button>
          )}
          {market.status === "paused" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !!error}
              onClick={() =>
                run(
                  () => changeLocalMarketStatus(market.id, "open"),
                  "Aposta reaberta.",
                )
              }
            >
              Reabrir aposta
            </Button>
          )}
          {["open", "paused"].includes(market.status) && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !!error}
              onClick={() => setConfirmation("close")}
            >
              Encerrar apostas
            </Button>
          )}
        </div>
      )}
      {!creating && (
        <nav
          className="mb-5 flex flex-wrap gap-2"
          aria-label="Seções da aposta"
        >
          {Object.entries(tabs).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={tab === key ? "secondary" : "ghost"}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => {
                setTab(key as keyof typeof tabs);
                setConfirmation(null);
              }}
            >
              {label}
            </Button>
          ))}
        </nav>
      )}
      {confirmation && (
        <Card className="mb-5" aria-label="Confirmar ação">
          <h2 className="font-semibold">{confirmations[confirmation].title}</h2>
          <p className="mt-2 text-sm text-muted">
            {confirmations[confirmation].detail}
            {stats.legacyCount > 0
              ? ` Os ${stats.legacyCount} palpites antigos permanecerão fora desta operação, sem alteração de saldo.`
              : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              loading={busy}
              disabled={!!error}
              variant={
                confirmation === "delete" || confirmation === "cancel"
                  ? "destructive"
                  : "default"
              }
              onClick={() =>
                run(
                  confirmations[confirmation].action,
                  confirmations[confirmation].success,
                  confirmation === "delete"
                    ? () => router.push("/admin/apostas")
                    : undefined,
                )
              }
            >
              {confirmations[confirmation].button}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              Voltar
            </Button>
          </div>
        </Card>
      )}
      {tab === "config" && (
        <Card>
          <form
            key={market.id}
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || error) return;
              const data = new FormData(event.currentTarget);
              let next: Market = market;
              if (!locked && editable) {
                const base = {
                  id: market.id,
                  question: value(data, "question"),
                  criterion: value(data, "criterion"),
                  status: market.status,
                  endsAt: market.endsAt,
                };
                if (type === "number")
                  next = { ...base, type, unit: value(data, "unit") };
                else
                  next = {
                    ...base,
                    type,
                    options:
                      type === "binary"
                        ? ["Sim", "Não"]
                        : value(data, "options")
                            .split("\n")
                            .map((v) => v.trim())
                            .filter(Boolean),
                  };
              }
              if (
                next.type !== "number" &&
                (next.options.length < 2 ||
                  new Set(next.options).size !== next.options.length)
              ) {
                setFailure(
                  "Adicione pelo menos duas opções diferentes, uma por linha.",
                );
                return;
              }
              const end = value(data, "endsAt");
              if (editable)
                next = {
                  ...next,
                  endsAt: end ? new Date(end).toISOString() : null,
                };
              run(
                () => saveLocalMarket(next, creating),
                "Aposta salva.",
                creating
                  ? () => router.replace(`/admin/apostas/${next.id}`)
                  : undefined,
              );
            }}
          >
            {locked && (
              <p className="text-sm text-muted">
                Pergunta, formato e regras ficam bloqueados após o primeiro
                palpite.
              </p>
            )}
            <fieldset
              disabled={locked || !editable || busy || !!error}
              className="grid gap-4"
            >
              <Field>
                Pergunta
                <Input
                  name="question"
                  defaultValue={market.question}
                  required
                  maxLength={200}
                />
              </Field>
              <div>
                <p className="mb-2 text-sm font-semibold">Formato</p>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Formato da aposta"
                >
                  {(
                    [
                      ["binary", "Sim ou não"],
                      ["choice", "Opções"],
                      ["number", "Número"],
                    ] as const
                  ).map(([key, label]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={type === key ? "secondary" : "ghost"}
                      aria-pressed={type === key}
                      onClick={() => setType(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              {type === "choice" && (
                <Field>
                  Opções (uma por linha)
                  <Textarea
                    name="options"
                    defaultValue={
                      market.type === "choice" ? market.options.join("\n") : ""
                    }
                    required
                    maxLength={2000}
                  />
                </Field>
              )}
              {type === "number" && (
                <Field>
                  Unidade
                  <Input
                    name="unit"
                    defaultValue={
                      market.type === "number" ? market.unit : "minutos"
                    }
                    required
                    maxLength={50}
                  />
                </Field>
              )}
              <Field>
                Critério do palpite
                <Textarea
                  name="criterion"
                  defaultValue={market.criterion}
                  required
                  maxLength={3000}
                />
              </Field>
            </fieldset>
            <Field>
              Encerramento (horário local)
              <Input
                type="datetime-local"
                name="endsAt"
                defaultValue={localDate(market.endsAt)}
                disabled={!editable || busy || !!error}
              />
            </Field>
            <p className="text-sm text-muted">
              Premiação por rateio proporcional, sem taxa. Para números, vale o
              acerto exato. Sem vencedores, os valores são devolvidos.
            </p>
            <div className="flex flex-wrap gap-2">
              {editable && (
                <Button type="submit" loading={busy} disabled={!!error}>
                  Salvar aposta
                </Button>
              )}
              <Button asChild variant="secondary">
                <Link href="/admin/apostas">Voltar para apostas</Link>
              </Button>
            </div>
          </form>
          {!creating && !locked && !market.settlement && (
            <Button
              className="mt-5"
              variant="link"
              disabled={busy || !!error}
              onClick={() => setConfirmation("delete")}
            >
              Excluir aposta
            </Button>
          )}
        </Card>
      )}
      {tab === "participants" && (
        <Card>
          <h2 className="mb-4 font-semibold">Participantes</h2>
          {entries.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhum palpite identificado nesta aposta.
            </p>
          ) : (
            <div className="overflow-x-auto" data-lenis-prevent>
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Palpites e pagamentos dos participantes
                </caption>
                <thead className="text-xs text-muted">
                  <tr>
                    {[
                      "Usuário",
                      "Palpite",
                      "Apostou",
                      "Data",
                      "Situação",
                      "Recebeu",
                    ].map((title) => (
                      <th
                        key={title}
                        scope="col"
                        className="px-3 py-3 font-medium whitespace-nowrap"
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-3 py-3">{entry.username}</td>
                      <td className="px-3 py-3">{entry.outcome}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {formatBalance.format(entry.stake)} Croins
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-3">
                        {
                          {
                            pending: "Pendente",
                            won: "Premiada",
                            lost: "Não premiada",
                            refunded: "Devolvida",
                          }[entry.status ?? "pending"]
                        }
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {entry.payout === undefined
                          ? "—"
                          : `${formatBalance.format(entry.payout)} Croins`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {stats.legacyEntries.length > 0 && (
            <div className="mt-5 border-t border-border pt-5">
              <h3 className="mb-3 text-sm font-semibold">
                Registros antigos fora da liquidação
              </h3>
              <ul className="divide-y divide-border">
                {stats.legacyEntries.map((entry, index) => (
                  <li
                    key={index}
                    className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                  >
                    <span>
                      {entry.username} · {entry.outcome}
                    </span>
                    <span>
                      {formatBalance.format(entry.stake)} Croins · Data não
                      registrada
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
      {tab === "settlement" && (
        <div className="grid gap-5">
          <Card>
            <h2 className="mb-4 font-semibold">Distribuição dos palpites</h2>
            {distribution.length === 0 ? (
              <p className="text-sm text-muted">
                Ainda não há valores apostados.
              </p>
            ) : (
              <ul className="grid gap-4">
                {distribution.map((row) => (
                  <li key={row.outcome}>
                    <div className="mb-2 flex justify-between gap-3 text-sm">
                      <span>{row.outcome}</span>
                      <span className="text-muted tabular-nums">
                        {formatBalance.format(row.amount)} Croins ·{" "}
                        {Math.round((row.amount / stats.total) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-control">
                      <div
                        className="h-full bg-brand"
                        style={{
                          width: `${(row.amount / stats.total) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-4 font-semibold">Resultado e pagamentos</h2>
            {!resolved && !finished && market.status !== "closed" && (
              <p className="mb-4 text-sm text-muted">
                Encerre o recebimento de apostas para informar o resultado.
              </p>
            )}
            {market.status === "closed" && (
              <>
                <div className="mb-5">
                  {market.type === "number" ? (
                    <Field>
                      Resultado em {market.unit}
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        max={Number.MAX_SAFE_INTEGER}
                        value={result}
                        onChange={(event) => {
                          setResult(event.currentTarget.value);
                          setConfirmation(null);
                        }}
                      />
                    </Field>
                  ) : (
                    <div
                      role="group"
                      aria-label="Resultado da aposta"
                      className="flex flex-wrap gap-2"
                    >
                      {market.options.map((option) => (
                        <Button
                          key={option}
                          variant={result === option ? "secondary" : "ghost"}
                          aria-pressed={result === option}
                          onClick={() => {
                            setResult(option);
                            setConfirmation(null);
                          }}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            {plan && (
              <>
                <p className="mb-3 text-sm">
                  Resultado: <strong>{plan.result ?? "Cancelamento"}</strong> ·{" "}
                  {plan.kind === "refund"
                    ? "Devolução dos valores apostados"
                    : "Rateio proporcional sem taxa"}
                </p>
                <p className="mb-4 text-sm text-muted">
                  {plan.result && plan.kind === "refund"
                    ? "Nenhum palpite acertou o resultado. Cada participante receberá seu valor de volta."
                    : "O valor recebido inclui a aposta inicial."}
                </p>
                <ul className="mb-5 divide-y divide-border">
                  {plan.allocations.map((allocation) => {
                    const entry = entries.find(
                      (e) => e.id === allocation.predictionId,
                    );
                    return (
                      <li
                        key={allocation.predictionId}
                        className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                      >
                        <span>
                          {allocation.username}
                          <span className="ml-2 text-muted">
                            {entry?.outcome}
                          </span>
                        </span>
                        <span className="tabular-nums">
                          {formatBalance.format(allocation.amount)} Croins
                          {entry?.settlementId === plan.id
                            ? " · Concluído"
                            : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mb-5 font-semibold">
                  Total: {formatBalance.format(plan.total)} Croins
                </p>
              </>
            )}
            {market.status === "closed" && (
              <Button
                disabled={!preview || busy || !!error}
                onClick={() => setConfirmation("resolve")}
              >
                Apurar resultado
              </Button>
            )}
            {resolved && (
              <Button
                loading={busy}
                disabled={!!error}
                onClick={() => setConfirmation("pay")}
              >
                {paidCount > 0
                  ? "Retomar pagamentos"
                  : market.settlement?.kind === "refund"
                    ? "Devolver Croins"
                    : "Pagar vencedores"}
              </Button>
            )}
            {finished && (
              <p className="text-sm font-semibold" role="status">
                {market.status === "cancelled"
                  ? "Aposta cancelada e valores devolvidos."
                  : "Liquidação concluída."}
              </p>
            )}
            {!finished && !resolved && !creating && (
              <div className="mt-5 border-t border-border pt-5">
                <Button
                  variant="link"
                  disabled={busy || !!error}
                  onClick={() => setConfirmation("cancel")}
                >
                  Cancelar aposta e devolver Croins
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
