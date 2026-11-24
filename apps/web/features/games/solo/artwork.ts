import { soloColors, soloCardFace, soloNames, type SoloCard } from "@croebet/shared";
import type { TableArtwork, CardArtwork } from "@/three/table/artwork";
export const soloPalette={red:{background:"#c43c4b",number:"#ffffff"},yellow:{background:"#e6bc41",number:"#352b10"},green:{background:"#28825e",number:"#ffffff"},blue:{background:"#326bb6",number:"#ffffff"}};
export const soloSymbols:Record<SoloCard["kind"],string>={number:"",skip:"×",reverse:"↶",draw2:"+2",swap:"↔",wild:"✦",draw4:"+4",rotate:"↻"};
export function soloCardArtwork(card:SoloCard):CardArtwork{
 const colors=card.color?soloPalette[card.color]:{background:"#303238",number:"#ffffff"};
 return {finish:"orbit",layout:card.kind==="number"?"numeric":"symbol",text:card.number!==null?String(card.number):soloSymbols[card.kind],caption:card.number!==null?["","Um","Dois","Três","Quatro","Cinco","Seis","Sete","Oito","Nove"][card.number]:soloNames[card.kind],backgroundColor:colors.background,color:colors.number,textColor:colors.number};
}
const faces:TableArtwork["faces"]={};
for(const color of soloColors)for(let number=1;number<=9;number++){
 const card:SoloCard={id:"artwork",kind:"number",number,color};faces[soloCardFace(card)]=soloCardArtwork(card);
}
for(const kind of ["skip","reverse","draw2","swap","wild","draw4","rotate"] as const){
 for(const color of ["wild","draw4","rotate"].includes(kind)?[null]:soloColors){const card:SoloCard={id:"artwork",kind,number:null,color};faces[soloCardFace(card)]=soloCardArtwork(card);}
}
export const soloLaboratoryArtwork:TableArtwork={back:{finish:"orbit",text:"Solo",backgroundColor:"#303238",color:"#d5d6d8"},faces:Object.fromEntries(Array.from({length:14},(_,i)=>[String(i),soloCardArtwork({id:"preview",kind:"number",number:i%9+1,color:soloColors[i%4]})]))};
export const soloArtwork:TableArtwork={faces,back:{finish:"orbit",text:"Solo",caption:"",backgroundColor:"#303238",color:"#d5d6d8"}};
