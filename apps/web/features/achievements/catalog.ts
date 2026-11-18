import { Coins, Flame, PlayingCards, Tickets } from "lucide-react";

// Presentation data, like the rankings. Replace with account statistics when
// completed games, results and daily visits are recorded by the platform.
export const achievementGroups = [
  {
    id: "presenca",
    title: "Presença marcada",
    Icon: Flame,
    current: 4,
    unit: "dias seguidos",
    milestones: [
      { description: "Entre por 3 dias seguidos.", target: 3 },
      { description: "Entre por 7 dias seguidos.", target: 7 },
      { description: "Entre por 30 dias seguidos.", target: 30 },
    ],
  },
  {
    id: "partidas",
    title: "Só mais uma",
    Icon: PlayingCards,
    current: 18,
    unit: "partidas",
    milestones: [
      { description: "Complete sua primeira partida.", target: 1 },
      { description: "Complete 50 partidas.", target: 50 },
      { description: "Complete 250 partidas.", target: 250 },
    ],
  },
  {
    id: "perdas",
    title: "A casa agradece",
    Icon: Coins,
    current: 2350,
    unit: "Croins perdidos",
    milestones: [
      { description: "Perca 1.000 Croins.", target: 1000 },
      { description: "Perca 10.000 Croins.", target: 10000 },
      { description: "Perca 50.000 Croins.", target: 50000 },
    ],
  },
  {
    id: "palpites",
    title: "Palpiteiro",
    Icon: Tickets,
    current: 6,
    unit: "apostas",
    milestones: [
      { description: "Faça sua primeira aposta.", target: 1 },
      { description: "Faça 25 apostas.", target: 25 },
      { description: "Faça 100 apostas.", target: 100 },
    ],
  },
];
