export type Market = {
  id: string;
  topic: string;
  question: string;
} & (
  | { type: "number"; unit: string }
  | { type: "choice" | "binary"; options: string[] }
);

export const markets: Market[] = [
  {
    id: "atraso",
    topic: "Palpite em minutos",
    question: "Quantos minutos a live vai atrasar?",
    type: "number",
    unit: "minutos",
  },
  {
    id: "proxima-live",
    topic: "Escolha uma opção",
    question: "Quando vai ser a próxima live?",
    type: "choice",
    options: ["De manhã", "À tarde", "À noite", "De madrugada"],
  },
  {
    id: "peruca",
    topic: "Sim ou não",
    question: "Ela vai começar a live de peruca?",
    type: "binary",
    options: ["Sim", "Não"],
  },
];
