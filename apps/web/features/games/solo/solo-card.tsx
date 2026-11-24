import type { SoloCard as Card } from "@croebet/shared";
import { PhysicalSoloCard } from "./physical-card";
export function SoloCard({card,small=false}:{card?:Card;small?:boolean}){
  return <div className={small?"w-9 shrink-0":"w-20 shrink-0"}><PhysicalSoloCard card={card}/></div>;
}
