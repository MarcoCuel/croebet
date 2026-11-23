import { soloCardLabel, type SoloCard as Card } from "@croebet/shared";
import { soloCardArtwork } from "./artwork";
export function SoloCard({card,small=false}:{card?:Card;small?:boolean}){
 const art=card?soloCardArtwork(card):{backgroundColor:"#303238",color:"#d5d6d8",text:"Solo",caption:"",layout:"symbol"};
 return <div aria-label={card?soloCardLabel(card):"Carta oculta"} className={`relative isolate aspect-[2/3] shrink-0 overflow-hidden rounded-md shadow-[inset_0_2px_4px_#ffffff26] ${small?"w-9":"w-20"}`} style={{background:art.backgroundColor,color:art.color}}>
 {art.layout==="numeric"?<><span className="absolute top-[8%] left-[12%] text-[0.8em]">{art.caption}</span><span className="absolute top-[10%] right-[12%] size-[10%] rounded-full bg-current"/><span className={`absolute inset-x-0 -bottom-[17%] text-center leading-none tracking-tighter ${small?"text-5xl":"text-[6.3rem]"}`}>{art.text}</span></>:<><span className={`absolute inset-0 flex items-center justify-center ${small?"text-xl":"text-4xl"}`}>{art.text}</span>{!small && <span className="absolute inset-x-1 bottom-3 text-center text-[0.6rem]">{art.caption}</span>}</>}
 </div>;
}
