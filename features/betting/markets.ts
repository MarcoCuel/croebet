export type Market = {
  id: string;
  question: string;
} & (
  | { type: "number"; unit: string }
  | { type: "choice" | "binary"; options: string[] }
);

export const markets: Market[] = [
  {
    id: "atraso",
    question: "Quantos minutos a live vai atrasar?",
    type: "number",
    unit: "minutos",
  },
  {
    id: "proxima-live",
    question: "Quando vai ser a próxima live?",
    type: "choice",
    options: ["De manhã", "À tarde", "À noite", "De madrugada"],
  },
  {
    id: "peruca",
    question: "Ela vai começar a live de peruca?",
    type: "binary",
    options: ["Sim", "Não"],
  },
  {
    id: "duracao-live",
    question: "Quanto tempo a live vai durar?",
    type: "choice",
    options: ["Até 1 hora", "1 a 2 horas", "2 a 4 horas", "Mais de 4 horas"],
  },
];
