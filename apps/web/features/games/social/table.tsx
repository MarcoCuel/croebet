"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Coins,
  Crown,
  Eye,
  Fingerprint,
  Hourglass,
  Landmark,
  Layers,
  MapPin,
  Search,
  Sparkles,
  Vote,
} from "lucide-react";
import type { Choice, SocialAction, SocialView } from "@croebet/shared";
import {
  CardFace,
  portraitRoles,
  siteArt,
  type TableAssets,
} from "./card-face";

type SurfaceProps = {
  view: SocialView;
  seat?: number;
  version: number;
  name: string;
  busy: boolean;
  live: boolean;
  onPlay: (action: SocialAction) => void;
  assets?: TableAssets;
  controls?: ReactNode;
  children?: ReactNode;
};
const suits = {
  coup: Crown,
  dixit: Sparkles,
  "secret-hitler": Landmark,
  spyfall: Fingerprint,
};

function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0),
      timer = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [until]);
  const seconds =
    now === null ? null : Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <span className="ct-time" data-short={seconds !== null && seconds < 60}>
      <Hourglass size={14} />
      {seconds === null
        ? "—"
        : Math.floor(seconds / 60) +
          ":" +
          String(seconds % 60).padStart(2, "0")}
    </span>
  );
}
function Track({
  title,
  count,
  max,
  side,
}: {
  title: string;
  count: number;
  max: number;
  side: string;
}) {
  return (
    <div
      className="ct-track"
      data-side={side}
      aria-label={title + " " + count + " de " + max}
    >
      <b>{title}</b>
      <div>
        {Array.from({ length: max }, (_, i) => (
          <i key={i} data-filled={i < count}>
            {i < count ? <Vote size={13} /> : i + 1}
          </i>
        ))}
      </div>
    </div>
  );
}
export function CardPile({ game }: { game: SocialView["game"] }) {
  return (
    <span className="ct-pile" aria-hidden="true">
      <CardFace game={game} back />
    </span>
  );
}
function CourtCoins() {
  return (
    <span className="ct-coins" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
function Seats({ v, seat }: { v: SocialView; seat?: number }) {
  return (
    <ul className="ct-seats" aria-label="Jogadores na mesa">
      {v.players.map((p, i) => {
        const active = v.phase !== "over" && i === v.turn;
        const funds = v.table?.kind === "court" ? v.table.seats[i] : undefined;
        return (
          <li
            key={i}
            data-turn={active}
            data-out={!p.active}
            aria-current={active ? "step" : undefined}
          >
            <span className="ct-avatar" aria-hidden="true">
              {p.name.slice(0, 1)}
            </span>
            <span>
              <strong>
                {p.name}
                {i === seat && p.name !== "Você" ? " · você" : ""}
              </strong>
              {funds ? (
                <small title={p.detail}>
                  <span key={funds.coins} className="ct-coin-count">
                    <Coins size={12} />
                    {funds.coins}
                  </span>
                  <span
                    aria-label={funds.hidden + " influências ocultas"}
                    className="ct-mini-hand"
                  >
                    {Array.from({ length: funds.hidden }, (_, n) => (
                      <i key={n} />
                    ))}
                  </span>
                  {!!funds.revealed.length && (
                    <span>{funds.revealed.join(", ")}</span>
                  )}
                </small>
              ) : (
                <small>{p.detail}</small>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
function Board({
  v,
  assets,
  live,
}: {
  v: SocialView;
  assets: TableAssets;
  live: boolean;
}) {
  if (v.game === "secret-hitler" && v.table?.kind === "parliament")
    return (
      <div className="ct-legislature">
        <Track
          title="Liberais"
          count={v.table.liberal}
          max={5}
          side="liberal"
        />
        <Track
          title="Fascistas"
          count={v.table.fascist}
          max={6}
          side="fascist"
        />
        <small>Eleições frustradas · {v.table.failed}/3</small>
        <p>{v.board[2]}</p>
      </div>
    );
  if (v.game === "dixit")
    return (
      <div className="ct-center">
        {!v.images.length && <CardPile game="dixit" />}
        <div>
          <small>{v.board[0]}</small>
          <blockquote>{v.board[1]?.replace(/^Pista: /, "")}</blockquote>
        </div>
      </div>
    );
  if (v.game === "spyfall")
    return (
      <div className="ct-center">
        <div className="ct-evidence">
          <CardFace game="spyfall" assets={assets} />
        </div>
        <div>
          <small>{v.board[0]}</small>
          {v.deadline !== null && live && <Countdown until={v.deadline} />}
          <blockquote>
            {v.phase === "answer" || v.phase === "vote"
              ? v.board[1]
              : v.heading}
          </blockquote>
        </div>
      </div>
    );
  return (
    <div className="ct-center">
      <span className="ct-court-bank">
        <CardPile game={v.game} />
        {v.game === "coup" && <CourtCoins />}
      </span>
      <div>
        {v.board
          .filter(Boolean)
          .map((line, i) =>
            i === 0 ? <small key={i}>{line}</small> : <p key={i}>{line}</p>,
          )}
      </div>
    </div>
  );
}
function Dossier({ v, assets }: { v: SocialView; assets: TableAssets }) {
  if (!v.notes.length) return null;
  return (
    <details className="ct-private">
      <summary>
        <Eye size={16} />
        Seu dossiê privado
      </summary>
      <div className="ct-private-content">
        {v.notes.map((line, i) => {
          const role = portraitRoles.indexOf(
            line.replace(/^Influência · /, ""),
          );
          return role >= 0 && v.game === "coup" ? (
            <CardFace key={i} game="coup" index={role} assets={assets} />
          ) : (
            <p key={i}>{line}</p>
          );
        })}
      </div>
    </details>
  );
}
const groupLabels: Record<string, string> = {
  steal: "Extorquir",
  kill: "Assassinar",
  coup: "Aplicar golpe",
  accuse: "Fazer acusação",
  guess: "Adivinhar o local",
};
function Actions({
  v,
  assets,
  seat,
  busy,
  onPlay,
}: {
  v: SocialView;
  assets: TableAssets;
  seat: number;
  busy: boolean;
  onPlay: SurfaceProps["onPlay"];
}) {
  const [text, setText] = useState(""),
    [pick, setPick] = useState<string | null>(null);
  const [claim, setClaim] = useState<string | null>(null);
  const label = v.choices.find((c) => c.input)?.input;
  const send = (c: Choice) => {
    if (!busy && (!c.input || text.trim()))
      onPlay({
        type: "social-choice",
        game: v.game,
        seat,
        key: c.key,
        ...(c.input ? { text: text.trim() } : {}),
      });
  };
  const selected = v.choices.find((c) => c.key === pick);
  const numbered =
    v.game === "dixit" && v.phase === "vote" && v.images.length > 0;
  const faceOptions = v.choices.filter(
    (c) =>
      c.art !== undefined ||
      c.key.startsWith("policy:") ||
      (v.game === "coup" && c.key.startsWith("card:")),
  );
  const faceKeys = new Set(faceOptions.map((o) => o.key));
  const claims =
    v.game === "coup" && v.phase === "action"
      ? [
          { key: "tax", title: "Tributo", role: 0 },
          { key: "kill", title: "Assassinato", role: 1 },
          { key: "steal", title: "Extorsão", role: 2 },
          { key: "exchange", title: "Troca", role: 3 },
        ]
          .map((item) => ({
            ...item,
            options: v.choices.filter((c) => c.key.split(":")[0] === item.key),
          }))
          .filter((item) => item.options.length)
      : [];
  const claimKeys = new Set(
    claims.flatMap((item) => item.options.map((c) => c.key)),
  );
  const groups = new Map<string, Choice[]>();
  for (const c of v.choices.filter(
    (o) => !faceKeys.has(o.key) && !claimKeys.has(o.key),
  )) {
    const prefix = c.key.split(":")[0],
      group = groupLabels[prefix] ? prefix : "";
    const list = groups.get(group) ?? [];
    list.push(c);
    groups.set(group, list);
  }
  function ordinary(c: Choice) {
    return (
      <Button
        variant="outline"
        className="ct-action"
        key={c.key}
        data-action={c.key}
        disabled={busy || (!!c.input && !text.trim())}
        onClick={() => send(c)}
      >
        {c.label}
      </Button>
    );
  }
  const cards = numbered
    ? v.images.map((art, i) => ({
        art,
        number: i + 1,
        c: faceOptions.find((c) => c.art === art),
      }))
    : faceOptions.map((c, i) => ({ art: c.art, number: i + 1, c }));
  return (
    <div className="ct-actions">
      {!!claims.length && (
        <div className="ct-hand ct-claims" aria-label="Ações por personagem">
          {claims.map((item) => (
            <Button
              variant="outline"
              key={item.key}
              className="ct-hand-card"
              aria-pressed={claim === item.key}
              disabled={busy}
              onClick={() =>
                item.options.length === 1
                  ? send(item.options[0])
                  : setClaim(item.key)
              }
            >
              <CardFace game="coup" index={item.role} assets={assets} />
              <small>{item.title}</small>
            </Button>
          ))}
        </div>
      )}
      {claim && (
        <div className="ct-buttons" aria-label="Escolher adversário">
          {claims.find((item) => item.key === claim)?.options.map(ordinary)}
        </div>
      )}
      {label && (
        <label className="ct-input">
          {label}
          <Input
            maxLength={180}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              label === "Sua pista"
                ? "Escreva uma pista para a mesa…"
                : undefined
            }
          />
        </label>
      )}
      {!!cards.length && (
        <div
          className="ct-hand"
          aria-label={numbered ? "Galeria da mesa" : "Cartas para escolher"}
        >
          {cards.map(({ c, art, number }) => {
            const index =
              art ??
              (v.game === "coup"
                ? Math.max(0, portraitRoles.indexOf(c?.label ?? ""))
                : Number(c?.label.includes("Fascista")));
            return (
              <Button
                variant="outline"
                className="ct-hand-card"
                key={c?.key ?? "image-" + art}
                disabled={!c || busy}
                aria-label={
                  (c?.label ?? "Imagem " + number) +
                  (art !== undefined && !numbered ? " · " + number : "")
                }
                aria-pressed={!!c && pick === c.key}
                onClick={() => c && setPick(c.key)}
                style={
                  {
                    "--angle": (number - (cards.length + 1) / 2) * 1.6 + "deg",
                  } as CSSProperties
                }
              >
                <CardFace game={v.game} index={index} assets={assets} />
                <small>
                  {art === undefined
                    ? c?.label
                    : numbered
                      ? "Imagem " + number
                      : number.toString().padStart(2, "0")}
                </small>
              </Button>
            );
          })}
        </div>
      )}
      {selected && (
        <div className="ct-confirm">
          {selected.art !== undefined && (
            <CardFace game="dixit" index={selected.art} assets={assets} />
          )}
          <Button
            variant="outline"
            className="ct-action ct-primary"
            disabled={busy || (!!selected.input && !text.trim())}
            onClick={() => send(selected)}
          >
            {selected.label}
            <ArrowRight size={16} />
          </Button>
        </div>
      )}
      {!!groups.size && (
        <div className="ct-buttons">
          {Array.from(groups, ([group, list]) =>
            group && list.length > 1 ? (
              <details className="ct-menu" key={group}>
                <summary>{groupLabels[group]}</summary>
                <div>{list.map(ordinary)}</div>
              </details>
            ) : (
              list.map(ordinary)
            ),
          )}
        </div>
      )}
    </div>
  );
}
export function SocialSurface({
  view: v,
  seat,
  version,
  name,
  busy,
  live,
  onPlay,
  assets = siteArt,
  controls,
  children,
}: SurfaceProps) {
  const Suit = suits[v.game],
    canAct = live && seat !== undefined && !!v.choices.length;
  const locations =
    v.game === "spyfall"
      ? v.board.find((l) => l.startsWith("Locais possíveis: "))
      : undefined;
  const last = v.log.at(-1);
  return (
    <section
      className="ct-table"
      data-family={v.game}
      aria-label={"Mesa de " + name}
    >
      <header className="ct-header">
        <span className="ct-emblem">
          <Suit />
        </span>
        <div>
          <small>Rodada {v.round}</small>
          <h2>{name}</h2>
        </div>
        {controls}
      </header>
      <div className="ct-felt">
        <Seats v={v} seat={seat} />
        <div className="ct-rail">
          <Board v={v} assets={assets} live={live} />
          {v.images.length > 0 && (!canAct || v.phase !== "vote") && (
            <div className="ct-gallery">
              {v.images.map((art, i) => (
                <figure key={art}>
                  <CardFace game="dixit" index={art} assets={assets} />
                  <figcaption>
                    {v.phase === "reveal" || v.phase === "over"
                      ? (v.board[i + 2] ?? i + 1)
                      : i + 1}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {last && (
            <p key={last} className="ct-event" aria-live="polite">
              {last}
            </p>
          )}
        </div>
      </div>
      <div className="ct-dock">
        <div className="ct-prompt">
          <span data-ready={canAct}>
            {v.phase === "over"
              ? "Resultado"
              : canAct
                ? v.turn === seat
                  ? "Sua vez"
                  : "Reagir"
                : "Na mesa"}
          </span>
          <h3>{v.heading}</h3>
        </div>
        {canAct && seat !== undefined && (
          <Actions
            key={version}
            v={v}
            assets={assets}
            seat={seat}
            busy={busy}
            onPlay={onPlay}
          />
        )}
        {live && !canAct && v.phase !== "over" && (
          <p className="ct-wait">Aguardando {v.players[v.turn]?.name}…</p>
        )}
        {!!v.hand.length &&
          !v.choices.some(
            (c) => c.art !== undefined && c.key.startsWith("card:"),
          ) && (
            <details className="ct-private">
              <summary>
                <Layers size={16} />
                Sua mão · {v.hand.length} imagens
              </summary>
              <div className="ct-gallery">
                {v.hand.map((i) => (
                  <CardFace key={i} game="dixit" index={i} assets={assets} />
                ))}
              </div>
            </details>
          )}
        <Dossier key={seat ?? "watch"} v={v} assets={assets} />
        {locations && (
          <details className="ct-private">
            <summary>
              <MapPin size={16} />
              Consultar os 30 locais
            </summary>
            <div className="ct-places">
              {locations
                .slice("Locais possíveis: ".length)
                .split(" · ")
                .map((p) => (
                  <span key={p}>
                    <Search size={12} />
                    {p}
                  </span>
                ))}
            </div>
          </details>
        )}
        {children}
      </div>
    </section>
  );
}
