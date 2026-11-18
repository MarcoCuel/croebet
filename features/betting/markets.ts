export type Market = {
  id: string;
  question: string;
  category: string;
  criterion: string;
} & (
  | { type: "number"; unit: string }
  | { type: "choice" | "binary"; options: string[] }
);

export const markets: Market[] = [
  {
    id: "atraso",
    question: "Quantos minutos a live vai atrasar?",
    category: "Horários",
    criterion: "Palpite no número inteiro de minutos entre o horário anunciado e o início da transmissão. Zero significa sem atraso.",
    type: "number",
    unit: "minutos",
  },
  {
    id: "peruca",
    question: "Ela vai começar a live de peruca?",
    category: "Na live",
    criterion: "Sim corresponde ao uso de peruca no início da transmissão. Colocar uma peruca depois do início não corresponde a esse palpite.",
    type: "binary",
    options: ["Sim", "Não"],
  },
  {
    id: "duracao-live",
    question: "Quanto tempo a live vai durar?",
    category: "Na live",
    criterion: "Palpite na duração entre o início e o fim da transmissão. Os limites superiores pertencem à faixa anterior: exatamente 1 hora fica em Até 1 hora; exatamente 2 horas fica em 1 a 2 horas.",
    type: "choice",
    options: ["Até 1 hora", "1 a 2 horas", "2 a 4 horas", "Mais de 4 horas"],
  },
];
