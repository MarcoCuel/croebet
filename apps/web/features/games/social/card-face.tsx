import type { CSSProperties } from "react";
import {
  Aperture,
  Crown,
  Eye,
  Fingerprint,
  Landmark,
  ScrollText,
  Stamp,
  Vote,
} from "lucide-react";
import type { SocialId } from "@croebet/shared";
import { dreamAlt } from "./art";
import "./table.css";

export const portraitRoles = [
  "Duque",
  "Assassino",
  "Capitão",
  "Embaixador",
  "Condessa",
];
export type TableAssets = {
  portraits: string;
  dream: (index: number) => string;
};
export const siteArt: TableAssets = {
  portraits: "/games/social/portraits.webp",
  dream: (index) => "/games/dixit/" + index + ".webp",
};
const seals = {
  coup: Crown,
  dixit: Aperture,
  "secret-hitler": Landmark,
  spyfall: Fingerprint,
};
const titles = {
  coup: "Coup",
  dixit: "Dixit",
  "secret-hitler": "Parlamento",
  spyfall: "Spyfall",
};
type FaceProps = {
  game: SocialId;
  index?: number;
  back?: boolean;
  name?: string;
  assets?: TableAssets;
};
export function CardFace({
  game,
  index = 0,
  back = false,
  name,
  assets = siteArt,
}: FaceProps) {
  const Seal = seals[game];
  if (back)
    return (
      <span
        className="ct-card ct-back"
        data-family={game}
        role="img"
        aria-label="Carta de costas"
      >
        <span className="ct-seal">
          <Seal aria-hidden="true" />
        </span>
        <b>{titles[game]}</b>
      </span>
    );
  if (game === "dixit")
    return (
      <span
        className="ct-card ct-dream"
        role="img"
        aria-label={dreamAlt(index)}
        style={{ backgroundImage: `url("${assets.dream(index)}")` }}
      />
    );
  const portrait = game === "coup" ? index % 5 : 5;
  const title =
    name ??
    (game === "coup"
      ? portraitRoles[portrait]
      : game === "spyfall"
        ? "Agente"
        : ["Liberal", "Fascista", "Cédula", "Mandato"][index % 4]);
  if (game === "secret-hitler") {
    const Icon = [Landmark, Stamp, Vote, ScrollText][index % 4];
    return (
      <span
        className="ct-card ct-policy"
        data-policy={index % 4}
        role="img"
        aria-label={title}
      >
        <span className="ct-corner">§</span>
        <Icon aria-hidden="true" />
        <b>{title}</b>
      </span>
    );
  }
  const style = {
    "--portrait": `url("${assets.portraits}")`,
    "--position": `${(portrait % 3) * 50}% ${Math.floor(portrait / 3) * 100}%`,
  } as CSSProperties;
  return (
    <span
      className="ct-card ct-portrait"
      style={style}
      role="img"
      aria-label={title}
    >
      <i aria-hidden="true" />
      <b>
        {game === "spyfall" ? (
          <Eye aria-hidden="true" />
        ) : (
          <Crown aria-hidden="true" />
        )}
        {title}
      </b>
    </span>
  );
}
