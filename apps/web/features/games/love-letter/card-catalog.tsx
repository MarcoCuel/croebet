import { LoveCard, classic, modern, loveRoles } from "./love-card";

export function LoveCardCatalog() {
  return <div className="space-y-8">
    <h1 className="sr-only">Cartas do Love Letter</h1>
    <p className="text-sm text-muted">Frentes, miniaturas e versos usados na mesa.</p>
    {(["classic", "modern"] as const).map(mode => {
      const names = mode === "classic" ? classic : modern;
      const counts = mode === "classic" ? [0,5,2,2,2,2,1,1,1] : [2,6,2,2,2,2,2,1,1,1];
      return <section key={mode} aria-label={mode === "classic" ? "Edição clássica" : "Edição moderna"} className="space-y-4"><h2 className="text-lg font-semibold">{mode === "classic" ? "Clássico · 16 cartas" : "Moderno · 21 cartas"}</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{names.map((name, value) => name && <article key={value} className="space-y-4 rounded-panel bg-surface p-4"><div className="flex items-end gap-3"><LoveCard value={value} mode={mode} /><LoveCard value={value} mode={mode} small /><LoveCard value={value} mode={mode} small compact /></div><h3 className="font-medium">{value} · {name} <span className="text-sm font-normal text-muted">×{counts[value]}</span></h3><p className="text-sm text-muted">{loveRoles[name].effect}</p></article>)}</div><div className="flex flex-wrap items-end gap-4 rounded-panel bg-surface p-4"><LoveCard mode={mode} /><LoveCard mode={mode} small /><LoveCard mode={mode} small compact /><p className="text-sm text-muted">Verso · normal, reduzido e miniatura</p></div></section>;
    })}
  </div>;
}
