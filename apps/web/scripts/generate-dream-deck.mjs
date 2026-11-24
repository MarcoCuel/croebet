// Original paper-cut illustrations. Render the contact sheets with the site's sharp dependency.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("../public/games/dixit/", import.meta.url));
await mkdir(dir, { recursive: true });
const palettes = [
  ["#376c82", "#afdbd2", "#ffe0a3", "#284d68", "#609ead"],
  ["#a15453", "#f5ab73", "#ffdeaa", "#673c51", "#ca8062"],
  ["#357c6d", "#b4dba4", "#fdd88b", "#2c555b", "#599575"],
  ["#384a75", "#70c6b3", "#f7dcbb", "#3c4768", "#7384a1"],
  ["#325779", "#7fb5bf", "#ffc49d", "#304961", "#63899c"],
  ["#843f68", "#e29981", "#ffe4a5", "#563956", "#a7657a"],
  ["#303552", "#90708c", "#ffcf89", "#312f46", "#635173"],
];
const path = (d, fill, stroke = "none", w = 2) =>
  '<path d="' +
  d +
  '" fill="' +
  fill +
  '" stroke="' +
  stroke +
  '" stroke-width="' +
  w +
  '" stroke-linecap="round" stroke-linejoin="round"/>';
const circ = (x, y, r, c) =>
  '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c + '"/>';
function picture(id) {
  const row = Math.floor(id / 12),
    col = id % 12,
    [sky, air, light, dark, mid] = palettes[row];
  const rust = "#d97656",
    cream = "#ffebc5",
    blue = "#386377",
    ink = "#253747",
    gold = "#efb85c";
  const P = path,
    C = circ;
  const motifs = [
    P(
      "M-66 9 Q-41 -19 1 -9 Q31 -6 45 1 Q63 2 61 -21 Q78 -13 65 3 Q81 0 84 7 Q67 18 48 11 Q3 50 -49 34 Q-65 28 -66 9Z",
      blue,
    ) +
      P("M-59 21 Q-31 29 10 18 Q-16 42 -48 32Z", cream) +
      C(-47, 6, 2.5, ink) +
      P("M-24 -9 L-20 -49 H-9 L-4 -9Z", cream) +
      P("M-22 -32 H-10 L-9 -25 H-23Z", rust) +
      P("M-25 -50 L-14 -60 L-5 -50Z", rust) +
      P("M-18 -48H-12V-41H-18Z", gold),
    P("M-60 26 L30 -24 L36 -14 L28 -9 L35 1 L26 6 L21 -4 L-52 38Z", gold) +
      C(-59, 34, 17, gold) +
      C(-59, 34, 9, blue) +
      P(
        "M0 0 L-28 -58 M14 -8 L-14 -65 M-5 -15 L6 -21 M-12 -29 L0 -36 M-19 -43 L-7 -49 M-25 -55 L-12 -60",
        "none",
        cream,
        4,
      ),
    P(
      "M-40 -4 Q-49 42 -5 40 Q34 41 39 6 L59 -10 L59 -20 L39 -10 Q26 -27 -20 -20Z",
      rust,
    ) +
      P("M-31 -9 Q-72 -24 -61 0 Q-49 17 -40 8", "none", rust, 8) +
      P("M-31 -20 Q0 -36 23 -19Z", cream) +
      C(-3, -30, 4, gold) +
      P("M55 -25 Q37 -51 54 -58 L44 -71 L65 -82", "none", cream, 2) +
      C(44, -71, 3, gold) +
      C(65, -82, 3, cream),
    P("M-65 16 Q0 29 65 8 L37 39 L-34 39Z", rust) +
      P("M0 20 V-55", "none", ink, 4) +
      P("M2 5 Q60 -12 44 -59 Q10 -50 2 5Z", gold) +
      P("M-4 7 Q-44 -3 -39 -36 Q-12 -33 -4 7Z", cream) +
      P("M3 2 L39 -51 M-5 3 L-32 -31", "none", blue),
    P(
      "M-55 24 Q-61 -14 -38 -35 Q-22 -58 1 -43 Q25 -57 41 -30 Q61 -16 50 26 L4 43Z",
      rust,
    ) +
      P("M-45 23 Q0 -17 44 20 Q0 55 -45 23Z", cream) +
      C(0, 19, 13, blue) +
      C(0, 19, 7, ink) +
      C(-3, 16, 2, cream) +
      P(
        "M-38 -28 L-22 0 M-12 -36 L-8 -3 M17 -34 L12 -3 M39 -19 L25 2",
        "none",
        gold,
        3,
      ),
    P("M-62 10 Q-25 -18 24 -7 L59 -28 L54 19 L26 12 Q-23 46 -62 10Z", gold) +
      C(-42, 7, 3, ink) +
      P("M-31 -5V-30H-17V-9 M-15 -10V-48H-2V-10 M1 -12V-32H17V-9", blue) +
      P("M-13 -47 L-8 -58 L-2 -47Z", rust) +
      P("M-27 -24H-21 M-12 -37H-6 M5 -24H12", "none", cream, 3),
    C(0, -12, 36, rust) +
      C(0, -12, 28, cream) +
      P("M0 -33V-12L17 -5", "none", blue, 4) +
      P(
        "M-9 20 Q-11 47 -42 55 M-4 20 Q3 49 -7 64 M5 22 Q20 47 43 47 M-25 44 L-36 39 M24 43 L34 35",
        "none",
        gold,
        5,
      ) +
      C(0, -12, 3, ink),
    P("M-41 -20 L0 -59 L41 -20Z", rust) +
      P("M-31 -23 H32 V19 H-31Z", cream) +
      P("M-12 19 V-7 Q0 -23 10 -7 V19Z", blue) +
      C(20, -12, 5, gold) +
      P(
        "M-17 20 L-20 44 L-40 54 M-20 44 L-20 57 M17 20 L25 36 L48 38 M25 36 L38 47",
        "none",
        ink,
        4,
      ),
    P(
      "M-58 -6 Q-8 -81 57 -8 Q39 -16 27 -4 Q11 -16 0 -4 Q-14 -16 -27 -3 Q-44 -13 -58 -6Z",
      rust,
    ) +
      P("M0 -8 V44 Q-7 60 -17 45", "none", gold, 4) +
      P(
        "M-40 -38 L-40 -53 M-12 -57 L-12 -76 M17 -54 L17 -67 M43 -34 L43 -49",
        "none",
        cream,
        3,
      ),
    P(
      "M-17 -16 Q-43 -13 -28 6 Q-47 29 -21 43 Q0 52 18 36 Q30 18 14 5 Q28 -13 8 -20Z",
      rust,
    ) +
      P("M-8 12 L8 -60", "none", gold, 6) +
      P(
        "M4 -42 Q-23 -47 -24 -64 Q-1 -69 4 -42 M8 -50 Q36 -55 39 -72 Q18 -74 8 -50Z",
        blue,
      ) +
      P("M46 -46 L-39 29", "none", cream, 2),
    C(-20, -22, 32, cream) +
      C(-7, -30, 28, sky) +
      P("M-39 7 H26 V27 H-39Z", blue) +
      P("M20 0 H40 V26 H20Z", rust) +
      P("M25 2 V-13 H34 V2 M-33 4 V-10 H-12 V4Z", blue) +
      C(-24, 29, 8, ink) +
      C(8, 29, 8, ink) +
      C(31, 29, 8, ink) +
      P("M-49 42 H57", "none", gold, 2),
    P(
      "M-40 -39 Q-43 -80 0 -83 Q43 -81 41 -42 Q35 -19 9 -1 H-9 Q-33 -16 -40 -39Z",
      rust,
    ) +
      P("M0 -81 Q-21 -44 -6 -2 H5 Q25 -44 0 -81Z", cream) +
      P("M-13 0 L-10 18 M13 0 L10 18", "none", ink, 3) +
      P("M-15 17 H15 V42 H-15Z", gold) +
      P("M-7 42 V23 Q0 15 7 23 V42Z", blue),
  ];
  let stars = "";
  let seed = id + 123;
  const rnd = () =>
    (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 40; i++) {
    const x = Math.round(rnd() * 240),
      y = Math.round(rnd() * 215);
    stars += C(x, y, 0.4 + rnd() * 1.4, light);
  }
  const layers = [
    P("M0 210 Q30 168 60 203 T126 208 T190 203 T260 198 V330 H0Z", mid) +
      P("M0 248 Q46 207 90 247 T183 244 T264 239 V330H0Z", dark),
    P("M0 235Q80 135 170 213L240 169V330H0Z", mid) +
      P("M0 254Q96 312 160 226Q200 176 240 202V330H0Z", dark),
    P(
      "M0 193 Q55 225 89 181 L70 235 L42 244Z M144 204 Q200 237 245 184 L226 239 L184 256Z",
      mid,
    ) + P("M0 277 Q55 223 100 262 T240 256V330H0Z", dark),
    P("M0 119 Q72 12 140 91 T240 42 L240 77 Q192 132 134 105 T0 153Z", air) +
      P("M0 260L51 201L86 231L130 178L195 248L240 213V330H0Z", mid),
    P(
      "M0 210Q22 174 48 210V265H35V216Q24 191 12 216V271H0Z M150 216Q177 142 215 211V277H196V217Q177 177 166 220V277H150Z",
      mid,
    ) + P("M0 274Q100 250 240 271V330H0Z", dark),
    P("M0 229L38 195L57 219L105 173L171 234L214 187L240 211V330H0Z", mid) +
      P("M0 267L68 229L115 252L169 217L240 260V330H0Z", dark),
    P(
      "M0 256V211L21 194L43 209V229L77 202L104 222V243L145 210L172 226V201L199 177L240 209V330H0Z",
      dark,
    ),
  ];
  let grass = "";
  for (let i = 0; i < 26; i++) {
    const x = ~~(rnd() * 240),
      y = 276 + ~~(rnd() * 43);
    grass += P(
      "M" + x + " " + y + " l" + (2 + ~~(rnd() * 7)) + " -3",
      "none",
      mid,
      1,
    );
  }
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" width="240" height="320"><defs><linearGradient id="s" x2=".4" y2="1"><stop stop-color="' +
    sky +
    '"/><stop offset="1" stop-color="' +
    air +
    '"/></linearGradient></defs><rect width="240" height="320" fill="url(#s)"/>' +
    stars +
    C(35 + ~~(rnd() * 165), 45 + ~~(rnd() * 58), 16 + rnd() * 19, light) +
    layers[row] +
    '<g transform="translate(' +
    (102 + ~~(rnd() * 34)) +
    " " +
    (143 + ~~(rnd() * 46)) +
    ") rotate(" +
    (-12 + ~~(rnd() * 23)) +
    ')">' +
    motifs[col] +
    "</g>" +
    grass +
    '<rect x="6" y="6" width="228" height="308" rx="7" fill="none" stroke="' +
    cream +
    '" opacity=".46"/></svg>'
  );
}
for (let n = 0; n < 84; n++)
  await sharp(Buffer.from(picture(n)))
    .webp({ quality: 84 })
    .toFile(dir + n + ".webp");
