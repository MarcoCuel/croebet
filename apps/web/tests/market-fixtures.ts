import type { Market } from "../features/betting/markets";
export const markets: Market[] = [
  {
    id: "atraso",
    question: "Quantos minutos a live vai atrasar?",
    status: "open",
    endsAt: null,
    criterion:
      "Palpite no número inteiro de minutos entre o horário anunciado e o início da transmissão. Zero significa sem atraso.",
    type: "number",
    unit: "minutos",
  },
  {
    id: "peruca",
    question: "Ela vai começar a live de peruca?",
    status: "open",
    endsAt: null,
    criterion:
      "Sim corresponde ao uso de peruca no início da transmissão. Colocar uma peruca depois do início não corresponde a esse palpite.",
    type: "binary",
    options: ["Sim", "Não"],
  },
  {
    id: "duracao-live",
    question: "Quanto tempo a live vai durar?",
    status: "open",
    endsAt: null,
    criterion:
      "Palpite na duração entre o início e o fim da transmissão. Os limites superiores pertencem à faixa anterior: exatamente 1 hora fica em Até 1 hora; exatamente 2 horas fica em 1 a 2 horas.",
    type: "choice",
    options: ["Até 1 hora", "1 a 2 horas", "2 a 4 horas", "Mais de 4 horas"],
  },
];
