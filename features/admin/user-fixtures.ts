// Design fixtures only: these records never read or update local accounts or wallets.
export const userStatuses = { active: "Ativo", suspended: "Suspenso" } as const;
export type UserStatus = keyof typeof userStatuses;

export const exampleUsers = [
  {
    id: "luna",
    name: "Luna",
    username: "lunazinha",
    role: "Usuário",
    status: "active",
    balance: 4280,
    games: 86,
    bets: 24,
    wins: 32,
    joined: "2026-10-02",
    lastSeen: "2026-11-17T23:42:00-03:00",
  },
  {
    id: "pedro",
    name: "Pedro Martins",
    username: "pedrin",
    role: "Moderador",
    status: "active",
    balance: 2150,
    games: 124,
    bets: 38,
    wins: 49,
    joined: "2026-09-18",
    lastSeen: "2026-11-17T23:16:00-03:00",
  },
  {
    id: "bia",
    name: "Beatriz Costa",
    username: "biacosta",
    role: "Usuário",
    status: "active",
    balance: 760,
    games: 42,
    bets: 12,
    wins: 15,
    joined: "2026-10-14",
    lastSeen: "2026-11-17T22:08:00-03:00",
  },
  {
    id: "rafa",
    name: "Rafael Lima",
    username: "rafalima",
    role: "Usuário",
    status: "suspended",
    balance: 120,
    games: 67,
    bets: 19,
    wins: 21,
    joined: "2026-10-05",
    lastSeen: "2026-11-14T19:30:00-03:00",
  },
  {
    id: "nina",
    name: "Nina Souza",
    username: "ninas",
    role: "Administrador",
    status: "active",
    balance: 6930,
    games: 153,
    bets: 45,
    wins: 72,
    joined: "2026-09-12",
    lastSeen: "2026-11-17T21:54:00-03:00",
  },
  {
    id: "gui",
    name: "Guilherme Alves",
    username: "guialves",
    role: "Usuário",
    status: "active",
    balance: 0,
    games: 31,
    bets: 8,
    wins: 7,
    joined: "2026-11-01",
    lastSeen: "2026-11-16T18:22:00-03:00",
  },
] satisfies Array<{
  id: string;
  name: string;
  username: string;
  role: string;
  status: UserStatus;
  balance: number;
  games: number;
  bets: number;
  wins: number;
  joined: string;
  lastSeen: string;
}>;

export type ExampleUser = (typeof exampleUsers)[number];

export function getExampleActivity(user: ExampleUser) {
  const day = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(user.lastSeen));
  return [
    {
      id: "bet",
      title: "Aposta registrada",
      detail: `${day} · 17:10`,
      amount: -100,
      balance: user.balance,
    },
    {
      id: "daily",
      title: "Bônus diário",
      detail: `${day} · 17:06`,
      amount: 100,
      balance: user.balance + 100,
    },
    {
      id: "round",
      title: "Partida de roleta",
      detail: `${day} · 16:52`,
      amount: -50,
      balance: user.balance,
    },
    {
      id: "win",
      title: "Vitória na roleta",
      detail: `${day} · 16:50`,
      amount: 50,
      balance: user.balance + 50,
    },
  ];
}

export const examplePredictions = [
  {
    question: "A Croe vai entrar de peruca na live?",
    choice: "Sim",
    amount: 100,
    status: "Em aberto",
  },
  {
    question: "Quanto tempo a live vai durar?",
    choice: "Mais de 3 horas",
    amount: 50,
    status: "Em aberto",
  },
  {
    question: "Quantos minutos a Croe vai atrasar?",
    choice: "15 minutos",
    amount: 100,
    status: "Finalizada",
  },
];
