import type { SoloCard } from "@croebet/shared";
import { soloCardLabel } from "@croebet/shared";
import { soloCardArtwork } from "./artwork";
import "./physical-card.css";

export function PhysicalSoloCard({ card }: { card?: SoloCard }) {
  const art = card ? soloCardArtwork(card) : null;
  return (
    <span
      className="cs-face"
      data-back={!card}
      role="img"
      aria-label={card ? soloCardLabel(card) : "Carta oculta"}
      style={{ backgroundColor: art?.backgroundColor, color: art?.color }}
    >
      <span className="cs-orbits" aria-hidden="true" />
      <small>{art?.caption ?? "Solo"}</small>
      <strong data-number={card?.kind === "number"}>{art?.text ?? "S"}</strong>
      <i aria-hidden="true">●</i>
    </span>
  );
}
