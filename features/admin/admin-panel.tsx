"use client";

import { AboutEditor } from "@/features/admin/about-editor";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Coins,
  FileText,
  LayoutDashboard,
  PlayingCards,
  Plus,
  Tickets,
} from "lucide-react";
import { toast } from "sonner";
import { Heading } from "@/components/shared/heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDemoSession } from "@/features/auth/session-context";
import { readWallet } from "@/features/auth/session-storage";
import {
  addCroins,
  formatBalance,
  isPrediction,
} from "@/features/wallet/wallet";
import {
  useSiteConfig,
  type AdminGame,
  type AdminMarket,
} from "@/features/admin/site-config";

const sections = [
  { id: "overview", label: "Visão geral", Icon: LayoutDashboard },
  { id: "games", label: "Jogos", Icon: PlayingCards },
  { id: "markets", label: "Apostas", Icon: Tickets },
  { id: "about", label: "Sobre", Icon: FileText },
  { id: "balance", label: "Saldo", Icon: Coins },
] as const;
type Section = (typeof sections)[number]["id"];
const text = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

export function AdminPanel() {
  const { config, ready, save } = useSiteConfig();
  const { username, openLogin } = useDemoSession();
  const [section, setSection] = useState<Section>("overview");
  const [game, setGame] = useState<AdminGame | null>(null);
  const [market, setMarket] = useState<AdminMarket | null>(null);
  const [deleting, setDeleting] = useState<AdminMarket | null>(null);
  if (!ready) return <p role="status">Carregando painel…</p>;
  if (!username)
    return (
      <Card className="grid justify-items-start gap-4">
        <Heading asChild>
          <h1>Admin</h1>
        </Heading>
        <p className="text-muted">
          Entre na sua conta para acessar o painel local.
        </p>
        <Button onClick={openLogin}>Entrar</Button>
      </Card>
    );

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav
          className="flex flex-wrap gap-1 lg:grid"
          aria-label="Seções do admin"
        >
          {sections.map(({ id, label, Icon }) => (
            <Button
              key={id}
              variant={section === id ? "secondary" : "ghost"}
              className="justify-start"
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Button>
          ))}
        </nav>
        <section
          className="min-w-0"
          aria-label={sections.find((s) => s.id === section)?.label}
        >
          {section === "overview" && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  [
                    "Jogos ativos",
                    config.games.filter((g) => g.enabled).length,
                  ],
                  [
                    "Apostas abertas",
                    config.markets.filter((m) => m.enabled).length,
                  ],
                  ["Páginas editáveis", 1],
                ].map(([label, count]) => (
                  <Card key={label} className="p-5">
                    <p className="text-sm text-muted">{label}</p>
                    <p className="mt-2 text-3xl font-semibold">{count}</p>
                  </Card>
                ))}
              </div>
              <Card className="mt-5">
                <h2 className="font-semibold">A casa está sob seu comando</h2>
                <p className="mt-2 text-sm text-muted">
                  Edite o catálogo, abra ou pause apostas, atualize o Sobre e
                  adicione Croins às contas locais.
                </p>
                <Button asChild variant="link" className="mt-3 px-0">
                  <Link href="/">Ver site</Link>
                </Button>
              </Card>
            </>
          )}
          {section === "games" && (
            <>
              <h2 className="mb-4 text-lg font-semibold">Jogos</h2>
              <div className="grid gap-3">
                {config.games.map((entry) => (
                  <Card
                    key={entry.slug}
                    className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-4"
                  >
                    <div className="min-w-0">
                      <h3 className="font-medium">{entry.name}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {entry.type} · {entry.enabled ? "Ativo" : "Pausado"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setGame(entry)}
                        aria-label={`Editar ${entry.name}`}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          save({
                            ...config,
                            games: config.games.map((g) =>
                              g.slug === entry.slug
                                ? { ...g, enabled: !g.enabled }
                                : g,
                            ),
                          })
                        }
                      >
                        {entry.enabled ? "Pausar" : "Ativar"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
          {section === "markets" && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Apostas</h2>
                <Button
                  size="sm"
                  onClick={() =>
                    setMarket({
                      id: crypto.randomUUID(),
                      question: "",
                      category: "",
                      criterion: "",
                      type: "binary",
                      options: ["Sim", "Não"],
                      enabled: true,
                    })
                  }
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Nova aposta
                </Button>
              </div>
              <div className="grid gap-3">
                {config.markets.map((entry) => (
                  <Card key={entry.id} className="p-4 sm:p-4">
                    <h3 className="font-medium">{entry.question}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {entry.category} · {entry.enabled ? "Aberta" : "Pausada"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setMarket(entry)}
                        aria-label={`Editar ${entry.question}`}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          save({
                            ...config,
                            markets: config.markets.map((m) =>
                              m.id === entry.id
                                ? { ...m, enabled: !m.enabled }
                                : m,
                            ),
                          })
                        }
                      >
                        {entry.enabled ? "Pausar" : "Abrir"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleting(entry)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </Card>
                ))}
                {config.markets.length === 0 && (
                  <Card>Nenhuma aposta cadastrada.</Card>
                )}
              </div>
            </>
          )}
          {section === "about" && (
            <Card>
              <h2 className="mb-5 text-lg font-semibold">Página Sobre</h2>
              <AboutEditor />
            </Card>
          )}
          {section === "balance" && <AdminBalance />}
        </section>
      </div>
      <Dialog
        open={!!game}
        onOpenChange={(open) => {
          if (!open) setGame(null);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Editar jogo</DialogTitle>
          {game && (
            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const updated = {
                  ...game,
                  name: text(form, "name"),
                  type: text(form, "type"),
                  description: text(form, "description"),
                  coverTitle: text(form, "coverTitle")
                    .split("\n")
                    .map((t) => t.trim())
                    .filter(Boolean),
                };
                if (
                  save({
                    ...config,
                    games: config.games.map((g) =>
                      g.slug === game.slug ? updated : g,
                    ),
                  })
                )
                  setGame(null);
              }}
            >
              <Field>
                Nome
                <Input
                  name="name"
                  defaultValue={game.name}
                  required
                  maxLength={100}
                />
              </Field>
              <Field>
                Categoria
                <Input
                  name="type"
                  defaultValue={game.type}
                  required
                  maxLength={100}
                />
              </Field>
              <Field>
                Título na capa
                <Textarea
                  name="coverTitle"
                  defaultValue={game.coverTitle.join("\n")}
                  required
                  maxLength={100}
                />
              </Field>
              <Field>
                Descrição
                <Textarea
                  name="description"
                  defaultValue={game.description}
                  required
                  maxLength={2000}
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setGame(null)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar jogo</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!market}
        onOpenChange={(open) => {
          if (!open) setMarket(null);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>
            {config.markets.some((m) => m.id === market?.id)
              ? "Editar aposta"
              : "Nova aposta"}
          </DialogTitle>
          {market && (
            <MarketForm
              key={market.id}
              market={market}
              onCancel={() => setMarket(null)}
              onSave={(updated) => {
                if (
                  save({
                    ...config,
                    markets: config.markets.some((m) => m.id === updated.id)
                      ? config.markets.map((m) =>
                          m.id === updated.id ? updated : m,
                        )
                      : [...config.markets, updated],
                  })
                )
                  setMarket(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Excluir esta aposta?</DialogTitle>
          <p className="mt-4 text-sm text-muted">
            {deleting?.question} Os palpites já registrados serão preservados no
            histórico.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (
                  save({
                    ...config,
                    markets: config.markets.filter(
                      (m) => m.id !== deleting?.id,
                    ),
                  })
                )
                  setDeleting(null);
              }}
            >
              Excluir aposta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MarketForm({
  market,
  onCancel,
  onSave,
}: {
  market: AdminMarket;
  onCancel: () => void;
  onSave: (market: AdminMarket) => void;
}) {
  const [type, setType] = useState(market.type);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const base = {
      id: market.id,
      enabled: market.enabled,
      question: text(form, "question"),
      category: text(form, "category"),
      criterion: text(form, "criterion"),
    };
    const options =
      type === "binary"
        ? ["Sim", "Não"]
        : text(form, "options")
            .split("\n")
            .map((t) => t.trim())
            .filter(Boolean);
    if (
      type === "choice" &&
      (options.length < 2 || new Set(options).size !== options.length)
    ) {
      toast.error("Adicione pelo menos duas opções diferentes, uma por linha.");
      return;
    }
    onSave(
      type === "number"
        ? { ...base, type, unit: text(form, "unit") }
        : { ...base, type, options },
    );
  }
  return (
    <form className="mt-5 grid gap-4" onSubmit={submit}>
      <Field>
        Pergunta
        <Input
          name="question"
          defaultValue={market.question}
          required
          maxLength={200}
        />
      </Field>
      <Field>
        Categoria
        <Input
          name="category"
          defaultValue={market.category}
          required
          maxLength={100}
        />
      </Field>
      <div>
        <p className="mb-2 text-sm font-medium">Formato</p>
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
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={type === value ? "secondary" : "ghost"}
              aria-pressed={type === value}
              onClick={() => setType(value)}
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
            defaultValue={market.type === "number" ? market.unit : "minutos"}
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
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Salvar aposta</Button>
      </div>
    </form>
  );
}

function AdminBalance() {
  const { username, balance, addBalance } = useDemoSession();
  return (
    <Card>
      <h2 className="text-lg font-semibold">Adicionar saldo</h2>
      <p className="mt-2 text-sm text-muted">
        Croins fictícios. Sua conta: {formatBalance.format(balance)} Croins.
        Informe uma conta que já tenha acessado neste navegador.
      </p>
      <form
        className="mt-5 grid max-w-lg gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const target = text(form, "username");
          const amount = Number(form.get("amount"));
          try {
            const key = `croebet:demo-wallet:${target.toLowerCase()}`;
            const raw = localStorage.getItem(key);
            if (!raw) {
              toast.error("Conta não encontrada neste navegador.");
              return;
            }
            const stored = JSON.parse(raw);
            if (
              !stored ||
              !Number.isSafeInteger(stored.balance) ||
              stored.balance < 0 ||
              typeof stored.lastClaim !== "string" ||
              !Array.isArray(stored.predictions) ||
              !stored.predictions.every(isPrediction)
            ) {
              toast.error("A carteira desta conta contém dados inválidos.");
              return;
            }
            const wallet =
              target.toLowerCase() === username?.toLowerCase()
                ? { ...readWallet(target), balance }
                : readWallet(target);
            const next = addCroins(wallet, amount);
            if (next === wallet) {
              toast.error(
                "Informe um valor inteiro de 1 a 999999, sem exceder o limite de saldo.",
              );
              return;
            }
            if (target.toLowerCase() === username?.toLowerCase())
              addBalance(amount);
            else localStorage.setItem(key, JSON.stringify(next));
            event.currentTarget.reset();
            toast.success(`${amount} Croins adicionados a ${target}.`);
          } catch {
            toast.error("Não foi possível atualizar o saldo.");
          }
        }}
      >
        <Field>
          Nome de usuário
          <Input
            name="username"
            defaultValue={username ?? ""}
            required
            maxLength={100}
          />
        </Field>
        <Field>
          Adicionar Croins de teste
          <Input
            type="number"
            name="amount"
            min={1}
            max={999999}
            step={1}
            required
          />
        </Field>
        <Button type="submit" className="justify-self-start">
          Adicionar
        </Button>
      </form>
    </Card>
  );
}
