import { CalendarDays, Coins, Flame, PlayingCards, Tickets } from "lucide-react";

// Presentation data, like the rankings. Replace with account statistics when
// completed games, results and daily visits are recorded by the platform.
export const achievementGroups = [
  {
    id: "presenca",
    title: "Presença marcada",
    description: "A gente sabia que você ia voltar.",
    Icon: Flame,
    current: 4,
    unit: "dias",
    achievements: [
      { title: "Voltou mesmo", description: "Entre por 3 dias seguidos.", target: 3 },
      { title: "Cliente da semana", description: "Entre por 7 dias seguidos.", target: 7 },
      { title: "Já pode pedir a chave", description: "Entre por 30 dias seguidos.", target: 30 },
    ],
  },
  {
    id: "partidas",
    title: "Na mesa de jogo",
    description: "Experiência você já tem. Sorte é outra conversa.",
    Icon: PlayingCards,
    current: 18,
    unit: "partidas",
    achievements: [
      { title: "Primeira rodada", description: "Complete sua primeira partida.", target: 1 },
      { title: "Só mais uma", description: "Complete 50 partidas nos jogos.", target: 50 },
      { title: "Parte da mobília", description: "Complete 250 partidas nos jogos.", target: 250 },
    ],
  },
  {
    id: "perdas",
    title: "A casa agradece",
    description: "Seus Croins encontraram um novo lar.",
    Icon: Coins,
    current: 2350,
    unit: "Croins",
    achievements: [
      { title: "Pequeno investidor", description: "Acumule 1.000 Croins em perdas.", target: 1000 },
      { title: "Patrocinador da casa", description: "Acumule 10.000 Croins em perdas.", target: 10000 },
      { title: "Sócio sem benefícios", description: "Acumule 50.000 Croins em perdas.", target: 50000 },
    ],
  },
  {
    id: "palpites",
    title: "Palpite é o que não falta",
    description: "Ter opinião nunca foi o problema.",
    Icon: Tickets,
    current: 6,
    unit: "apostas",
    achievements: [
      { title: "Tenho um palpite", description: "Faça sua primeira aposta em um evento.", target: 1 },
      { title: "Especialista em achismo", description: "Faça 25 apostas em eventos.", target: 25 },
      { title: "Fonte: minha cabeça", description: "Faça 100 apostas em eventos.", target: 100 },
    ],
  },
];

export const achievementStats = [
  { label: "Dias seguidos", value: 4, Icon: CalendarDays },
  { label: "Partidas jogadas", value: 18, Icon: PlayingCards },
  { label: "Croins perdidos", value: 2350, Icon: Coins },
];
