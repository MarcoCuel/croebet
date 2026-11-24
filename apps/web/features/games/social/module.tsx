"use client";
import { socialViewSchema, socialSettings } from "@croebet/shared";
import { GameTableLayout } from "../game-table-layout";
import { GameControls } from "../game-controls";
import { CancellationNotice } from "../match-cancellation";
import type { GamePresentation, GameTableProps } from "../game-module";
import { PublicEntry } from "../public-entry";
import { SocialSurface } from "./table";
import { useTableCue } from "../use-table-cue";

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
  const s = socialViewSchema.parse(room.state);
  const seat = room.participants.find((p) => p.userId === viewerId)?.seat;
  const live = room.status === "playing" && !replayControls;
  const cue =
    s.phase === "over"
      ? "prize"
      : s.phase === "loss" || s.phase === "reveal"
        ? "discard"
        : "slide";
  const balances =
    s.table?.kind === "court"
      ? s.table.seats.map((player) => player.coins).join(",")
      : undefined;
  const audio = useTableCue(
    room.id,
    room.version,
    cue,
    !replayControls,
    balances,
  );
  return (
    <GameTableLayout
      history={[...s.log].reverse().map((message) => ({ message }))}
      initialHistoryVisible={false}
    >
      <CancellationNotice match={room} />
      <SocialSurface
        view={s}
        name={game.name}
        seat={seat}
        version={room.version}
        live={live}
        busy={busy}
        onPlay={play}
        controls={
          <GameControls audio={audio} developmentControls={controls}>
            {exit}
          </GameControls>
        }
      >
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
      </SocialSurface>
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
