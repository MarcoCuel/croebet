export const markets = [
  {
    id: "congresso",
    topic: "Congresso",
    question: "O projeto vai à votação nesta semana?",
    options: [
      { outcome: "Vai à votação", odds: 180 },
      { outcome: "Fica pra depois", odds: 200 },
    ],
  },
  {
    id: "sabatina",
    topic: "Sabatina",
    question: "A sabatina termina antes das 18h?",
    options: [
      { outcome: "Sim", odds: 220 },
      { outcome: "Não", odds: 165 },
    ],
  },
  {
    id: "debate",
    topic: "Debate",
    question: "O debate passa do horário previsto?",
    options: [
      { outcome: "Passa", odds: 150 },
      { outcome: "Termina no horário", odds: 245 },
    ],
  },
];

export const formatOdds = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
});
