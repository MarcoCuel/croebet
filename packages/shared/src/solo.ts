import { z } from "zod";
export const soloColors = ["red", "yellow", "green", "blue"] as const;
export const soloColorSchema = z.enum(soloColors);
export const soloKindSchema = z.enum(["number", "skip", "reverse", "draw2", "swap", "wild", "draw4", "rotate"]);
export const soloCardSchema = z.object({ id:z.string().min(1), kind:soloKindSchema, color:soloColorSchema.nullable(), number:z.number().int().min(1).max(9).nullable() }).strict().superRefine((card,ctx)=>{
 if((card.kind==="number") !== (card.number!==null) || (["wild","draw4","rotate"].includes(card.kind) ? card.color!==null : card.color===null))ctx.addIssue({code:"custom",message:"Carta Solo inválida."});
});
export const soloOptionsSchema = z.object({ mode:z.enum(["single","rounds3","rounds4","points100","points250","points500"]), brutal:z.literal(false).default(false) }).strict();
const seat=z.number().int().min(0).max(9);
export const soloActionSchema=z.discriminatedUnion("type",[
 z.object({type:z.literal("solo-play"),seat,cardId:z.string(),color:soloColorSchema.optional(),target:seat.optional(),solo:z.boolean().default(false)}).strict(),
 z.object({type:z.literal("solo-draw"),seat}).strict(),
 z.object({type:z.literal("solo-pass"),seat}).strict(),
 z.object({type:z.literal("solo-call"),seat}).strict(),
 z.object({type:z.literal("solo-next"),seat}).strict(),
]);
export const soloMoveSchema=z.object({kind:z.enum(["deal","draw","play","swap","rotate","pass","call"]),seat:z.number().int().min(0).max(9),target:z.number().int().min(0).max(9).optional()}).strict();
export const soloViewSchema=z.object({game:z.literal("solo"),mode:soloOptionsSchema.shape.mode,round:z.number().int().positive(),turn:seat,direction:z.union([z.literal(1),z.literal(-1)]),phase:z.enum(["playing","summary","over"]),
 move:soloMoveSchema.nullable().default(null),activeColor:soloColorSchema.nullable(),deckCount:z.number().int().nonnegative(),discard:z.array(soloCardSchema),penalty:z.number().int().nonnegative(),penaltyKind:z.enum(["draw2","draw4"]).nullable(),pendingCall:seat.nullable(),drawn:z.boolean(),winners:z.array(seat),log:z.array(z.string()),
 players:z.array(z.object({name:z.string(),kind:z.enum(["human","normal"]),hand:z.array(soloCardSchema).nullable(),handCount:z.number().int().nonnegative(),points:z.number().int().nonnegative()})).min(2).max(10),legalActions:z.array(soloActionSchema)
}).strict();
export type SoloCard=z.infer<typeof soloCardSchema>;
export type SoloAction=z.infer<typeof soloActionSchema>;
export type SoloView=z.infer<typeof soloViewSchema>;
export type SoloOptions=z.infer<typeof soloOptionsSchema>;
export const soloNames:Record<SoloCard["kind"],string>={number:"Número",skip:"Pular",reverse:"Inverter",draw2:"Comprar duas",swap:"Trocar mãos",wild:"Escolher cor",draw4:"Comprar quatro",rotate:"Rodízio"};
export const soloColorNames:Record<typeof soloColors[number],string>={red:"Vermelho",yellow:"Amarelo",green:"Verde",blue:"Azul"};
export function soloCardLabel(card:SoloCard):string{return `${card.number ?? soloNames[card.kind]}${card.color?` ${soloColorNames[card.color].toLowerCase()}`:""}`;}
export function soloCardFace(card:SoloCard):string{return `solo:${card.color ?? "black"}:${card.kind}:${card.number ?? ""}`;}
export function soloCardPoints(card:SoloCard):number{return card.number ?? ({skip:20,reverse:10,draw2:30,swap:30,wild:40,draw4:50,rotate:40,number:0})[card.kind];}
