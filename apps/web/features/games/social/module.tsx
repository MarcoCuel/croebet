"use client";
import { useEffect, useState } from "react";
import {
  socialViewSchema,
  socialSettings,
  type SocialView,
} from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GameTableLayout } from "../game-table-layout";
import { GameControls } from "../game-controls";
import { CancellationNotice } from "../match-cancellation";
import type { GamePresentation, GameTableProps } from "../game-module";
import { PublicEntry } from "../public-entry";
import { SocialFace } from "./face";
const rulesText = {
  coup: [
    "Comece com duas influências. Ganhe uma moeda com Renda, duas com Ajuda, ou três com o Duque. Golpe custa sete e é obrigatório a partir de dez.",
    "Capitão rouba até duas moedas. Assassino custa três e retira uma influência. Embaixador compra duas e devolve duas. Condessa bloqueia assassinato, Duque bloqueia ajuda, Capitão e Embaixador bloqueiam roubo.",
    "Desafiar exige que o outro prove o personagem. Quem perde o desafio escolhe uma influência para revelar. Quem provou sua carta a troca por outra. Bloqueios também podem ser blefes.",
  ],
  dixit: [
    "Quem narra escolhe uma imagem e escreve uma pista. Os demais enviam uma imagem que também combine. Com três jogadores, cada adversário envia duas.",
    "As imagens são embaralhadas. Vote em uma imagem alheia. Se só parte da mesa acertar, narrador e quem acertou ganham três pontos. Se todos ou ninguém acertar, cada adversário ganha dois.",
    "Cada voto em uma imagem enviada por um adversário rende um ponto a ele. Vence a maior soma ao atingir 30 pontos ou acabar o monte.",
  ],
  "secret-hitler": [
    "O presidente indica um chanceler elegível. A chapa precisa de mais da metade dos votos dos vivos. Três eleições frustradas aprovam uma política do monte sem poder executivo.",
    "O presidente recebe três políticas e descarta uma. O chanceler aprova uma das duas restantes. A quinta política fascista libera o veto com a concordância do presidente.",
    "Liberais vencem com cinco políticas ou eliminando Hitler. Fascistas vencem com seis políticas ou elegendo Hitler chanceler depois da terceira política fascista. Investigações revelam filiação, e as trilhas variam com o número inicial de jogadores.",
  ],
  spyfall: [
    "Todos recebem o mesmo local e uma profissão, exceto o espião. Faça uma pergunta a alguém. Quem responde faz a pergunta seguinte e não pode devolvê-la imediatamente.",
    "A rodada dura oito minutos. Cada pessoa pode fazer uma acusação durante o tempo. O acusado se abstém. Uma decisão unânime encerra o caso. O espião também pode arriscar um local.",
    "Após o tempo há uma última sequência de acusações. O espião ganha dois se escapar e quatro se acertar o local ou se um inocente for condenado. Quem o identifica recebe um ponto, com um ponto extra para quem acusou. O maior total após cinco rodadas vence.",
  ],
};
function Clock({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 500);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [deadline]);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <Badge>
      {now
        ? Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0")
        : "8:00"}
    </Badge>
  );
}
function Choices({
  s,
  seat,
  busy,
  play,
}: {
  s: SocialView;
  seat: number;
  busy: boolean;
  play: GameTableProps["play"];
}) {
  const [message, setMessage] = useState("");
  const label = s.choices.find((c) => c.input)?.input;
  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium">
          {label}
          <Input
            className="mt-1"
            maxLength={180}
            value={message}
            placeholder={
              label === "Sua pista"
                ? "Algo que a imagem faz você lembrar…"
                : label
            }
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {s.choices.map((c) => (
          <Button
            key={c.key}
            variant="secondary"
            className={
              c.art !== undefined
                ? "h-auto w-24 flex-col whitespace-normal p-1.5 text-xs"
                : undefined
            }
            disabled={busy || (!!c.input && !message.trim())}
            onClick={() =>
              void play({
                type: "social-choice",
                game: s.game,
                seat,
                key: c.key,
                ...(c.input ? { text: message.trim() } : {}),
              })
            }
          >
            {c.art !== undefined && <SocialFace game="dixit" index={c.art} />}{" "}
            {c.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
function Table({
  game,
  room,
  controls,
  exit,
  viewerId,
  busy,
  play,
  replayControls,
}: GameTableProps) {
  const s = socialViewSchema.parse(room.state),
    seat = room.participants.find((p) => p.userId === viewerId)?.seat;
  return (
    <GameTableLayout
      history={[...s.log].reverse().map((message) => ({ message }))}
    >
      <div className="space-y-4 rounded-panel border border-contrast/10 bg-surface p-4 sm:p-6">
        <CancellationNotice match={room} />
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">
              {game.name} · Rodada {s.round}
            </p>
            <h2 className="text-xl font-bold">{s.heading}</h2>
          </div>
          <GameControls developmentControls={controls}>{exit}</GameControls>
        </header>
        <div className="flex flex-wrap gap-2">
          {s.players.map((p, i) => (
            <span
              key={i}
              className={
                "rounded-lg border p-2 text-sm " +
                (s.phase !== "over" && i === s.turn
                  ? "border-brand"
                  : "border-contrast/10")
              }
            >
              <strong>{p.name}</strong>
              {i === seat ? " · você" : ""}
              <small className="block text-muted">{p.detail}</small>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 rounded-xl bg-contrast/5 p-4 text-sm">
          {s.game !== "dixit" && (
            <div className="w-16 shrink-0 sm:w-20">
              <SocialFace game={s.game} index={s.round - 1} />
            </div>
          )}
          <div className="space-y-1">
            {s.board.filter(Boolean).map((line) =>
              line.startsWith("Locais possíveis: ") ? (
                <details key="locais">
                  <summary className="cursor-pointer">
                    Consultar os 30 locais
                  </summary>
                  <p className="mt-2 leading-relaxed">{line.slice(17)}</p>
                </details>
              ) : (
                <p key={line}>{line}</p>
              ),
            )}
          </div>
          {s.deadline && !replayControls && <Clock deadline={s.deadline} />}
        </div>
        {s.images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {s.images.map((n, i) => (
              <figure key={n}>
                <SocialFace game="dixit" index={n} />
                <figcaption className="text-center text-sm">{i + 1}</figcaption>
              </figure>
            ))}
          </div>
        )}
        {s.notes.length > 0 && (
          <details className="rounded-xl border border-contrast/15 p-3">
            <summary className="cursor-pointer font-semibold">
              Seu dossiê privado
            </summary>
            {s.notes.map((v, i) => (
              <p className="mt-1 text-sm" key={i}>
                {v}
              </p>
            ))}
          </details>
        )}
        {s.hand.length > 0 &&
          !s.choices.some((c) => c.key.startsWith("card:")) && (
            <details>
              <summary className="cursor-pointer">
                Sua mão · {s.hand.length} imagens
              </summary>
              <div className="grid grid-cols-4 gap-2">
                {s.hand.map((n) => (
                  <SocialFace key={n} game="dixit" index={n} />
                ))}
              </div>
            </details>
          )}
        {room.status === "playing" &&
        seat !== undefined &&
        s.choices.length > 0 ? (
          <Choices
            key={room.version}
            s={s}
            seat={seat}
            busy={busy}
            play={play}
          />
        ) : room.status === "playing" ? (
          <p className="text-sm text-muted">
            Aguardando {s.players[s.turn]?.name}.
          </p>
        ) : null}
        {replayControls}
        <details className="pt-2 text-sm">
          <summary className="cursor-pointer font-semibold">Como jogar</summary>
          <p className="my-2">{socialSettings[s.game].purpose}</p>
          <ol className="list-decimal space-y-2 pl-5">
            {rulesText[s.game].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          {s.game === "secret-hitler" && (
            <p className="mt-3 text-sm text-muted">
              Adaptação digital da Croebet de{" "}
              <a className="underline" href="https://www.secrethitler.com/">
                Secret Hitler
              </a>{" "}
              sob a licença{" "}
              <a
                className="underline"
                href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
              >
                CC BY-NC-SA 4.0
              </a>
              .
            </p>
          )}
        </details>
      </div>
    </GameTableLayout>
  );
}
export const presentation: GamePresentation = {
  Entry: PublicEntry,
  managesLive: false,
  Table,
  result: (room) => {
    const s = socialViewSchema.parse(room.state);
    return {
      round: s.round,
      scoreLabel: "pts",
      players: s.players.map((p, i) => ({
        seat: i,
        name: p.name,
        score: p.score,
        winner: s.winners.includes(i),
      })),
    };
  },
};
