import Image from "next/image";
import {
  Eye,
  VenetianMask,
  Crown,
  ScrollText,
  Landmark,
  Vote,
  Compass,
  MapPin,
  Radio,
  BriefcaseBusiness,
  Fingerprint,
  KeyRound,
} from "lucide-react";
import type { SocialId } from "@croebet/shared";
import { dreamAlt } from "./art";
const sets = {
  coup: {
    style: "from-[#563043] to-[#bd6246]",
    icons: [Crown, VenetianMask, KeyRound, Eye],
    names: ["Influência", "Corte", "Tesouro", "Desafio"],
  },
  "secret-hitler": {
    style: "from-[#313337] to-[#786954]",
    icons: [Landmark, Vote, ScrollText, Eye],
    names: ["Parlamento", "Votação", "Política", "Dossiê"],
  },
  spyfall: {
    style: "from-[#884524] to-[#d89d4d]",
    icons: [Compass, MapPin, Radio, BriefcaseBusiness, Fingerprint],
    names: ["Investigação", "Destino", "Escuta", "Bagagem", "Identidade"],
  },
};
export function SocialFace({ game, index }: { game: SocialId; index: number }) {
  if (game === "dixit")
    return (
      <Image
        src={"/games/dixit/" + index + ".webp"}
        width={240}
        height={320}
        sizes="(max-width: 640px) 30vw, 160px"
        unoptimized
        alt={dreamAlt(index)}
        className="aspect-[3/4] w-full rounded-lg object-cover"
      />
    );
  const set = sets[game],
    Icon = set.icons[index % set.icons.length];
  return (
    <div
      className={
        "relative grid aspect-[3/4] w-full place-content-center overflow-hidden rounded-xl border border-white/20 bg-linear-to-br text-amber-50 " +
        set.style
      }
    >
      <div className="absolute inset-2 rounded-lg border border-current opacity-40" />
      <Icon className="mx-auto size-9" strokeWidth={1.4} />
      <span className="mt-2 text-center text-xs font-semibold uppercase tracking-wide">
        {set.names[index % set.names.length]}
      </span>
    </div>
  );
}
