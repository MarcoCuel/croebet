export const motifs = [
  "Uma baleia levando um farol",
  "Uma escada que brota de uma chave",
  "Um bule soprando constelações",
  "Um barco com velas de folha",
  "Um olho dentro de uma concha",
  "Um peixe levando uma cidade",
  "Um relógio que cria raízes",
  "Uma casa com pernas de pássaro",
  "Um guarda-chuva que chove para cima",
  "Um violino que vira árvore",
  "Um trem saindo da lua",
  "Um balão com uma porta na cesta",
];
const settings = [
  "sobre um mar de papel",
  "entre dunas cor de cobre",
  "no jardim suspenso",
  "sob a aurora polar",
  "entre arcos submersos",
  "em uma serra ao entardecer",
  "sobre telhados à meia-noite",
];
export const dreamAlt = (n: number) =>
  motifs[n % 12] + " " + settings[Math.floor(n / 12)];
