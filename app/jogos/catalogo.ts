import { MoonIcon } from "@phosphor-icons/react/dist/ssr/Moon";
import { NumberSevenIcon } from "@phosphor-icons/react/dist/ssr/NumberSeven";
import { SpadeIcon } from "@phosphor-icons/react/dist/ssr/Spade";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";

export const games = [
  { slug: "krepinho", cover: "[--cover:var(--color-cover-krepinho)] text-mark-krepinho", name: "Jogo do Krepinho", type: "Caça-níqueis", Icon: NumberSevenIcon, description: "Três rolos, nenhuma estratégia e a eterna sensação de que agora vai." },
  { slug: "bola-de-cristal", cover: "[--cover:var(--color-cover-crystal)] text-mark-crystal", name: "Bola de Cristal dos Direitos", type: "Revelação", Icon: SparkleIcon, description: "Consulte o oráculo. Ele promete mistério e entrega respostas tão vagas quanto um horóscopo." },
  { slug: "roleta", cover: "[--cover:var(--color-cover-roulette)] text-mark-roulette", name: "Roleta da Lua Cheia", type: "Roleta", Icon: MoonIcon, description: "A lua está cheia e a roleta está girando. Qual dos dois manda na sua sorte?" },
  { slug: "caca-niqueis", cover: "[--cover:var(--color-cover-slots)] text-mark-slots", name: "Caça-Níqueis de Tarô", type: "Caça-níqueis", Icon: SpadeIcon, description: "O tarô embaralhou as cartas e esqueceu de avisar os rolos." },
];

export const upcoming = [
  "Baralho Cigano da Financeirização",
  "Runas do Endividamento",
  "Astrologia do CLT",
  "Sessão Espírita da Previdência",
  "Ritual de Fogo do Salário Mínimo",
  "Poção da Carteira Assinada",
];
