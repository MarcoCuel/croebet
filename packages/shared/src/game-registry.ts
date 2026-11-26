import { z } from "zod";
import { flip7OptionsSchema, flip7ActionSchema, flip7EventActionSchema, flip7ViewSchema } from "./flip7.js";
import { soloOptionsSchema, soloActionSchema, soloViewSchema } from "./solo.js";
import { loveOptionsSchema, loveActionSchema, loveViewSchema } from "./love-letter.js";

export type SettingField = {
  key: string; label: string; ariaLabel?: string; badgeLabel?:string; badgeVariant?:"default"|"secondary";
  type: "select" | "switch";
  choices?: {value:string;label:string;shortLabel?:string}[];
  visibleWhen?: {key:string;value:string};
  reset?: Record<string,boolean>;
};
export type GameMedia = {
  /** Efeito padrão de movimento de carta (compra, troca, roubo). */
  card: boolean;
  /** Aviso de que a decisão atual pertence ao jogador. */
  turn: boolean;
  /** Obrigatório quando algum slot está desligado; nunca silencia sem justificativa. */
  reason?: string;
};
export type GameDefinition = {
  options: z.ZodType; action: z.ZodType; view: z.ZodType;
  defaults: Record<string,string|boolean>;
  developmentOnly: boolean; croins: boolean; replay: boolean; kickDuringPlay:boolean; media:GameMedia;
  minPlayers: number; maxPlayers: (options:unknown)=>number;
  settings: SettingField[];
};

// Explicit registration keeps unreviewed catalog entries from executing code.
export const gameDefinitions = {
  flip7: {
    options:flip7OptionsSchema, action:flip7ActionSchema, view:flip7ViewSchema,
    defaults:{mode:"classic",brutal:false}, developmentOnly:false,croins:true,replay:true,kickDuringPlay:true,media:{card:true,turn:true},
    minPlayers:2,maxPlayers:()=>12,
    settings:[
      {key:"mode",label:"Modo",ariaLabel:"Modo do Flip7",type:"select",reset:{brutal:false},choices:[{value:"classic",label:"Clássico"},{value:"vengeance",label:"A vingança nunca é plena",shortLabel:"Vingança"}]},
      {key:"brutal",label:"Modo Brutal",badgeLabel:"Brutal",badgeVariant:"default",type:"switch",visibleWhen:{key:"mode",value:"vengeance"}},
    ],
  },
  "love-letter": {
    options:loveOptionsSchema,action:loveActionSchema,view:loveViewSchema,
    defaults:{mode:"classic",brutal:false},developmentOnly:true,croins:false,replay:true,kickDuringPlay:false,media:{card:false,turn:false,reason:"Sons da mesa pendentes; o aviso global de vez cobre o turno."},
    minPlayers:2,maxPlayers:(options:unknown)=>loveOptionsSchema.parse(options).mode==="classic"?4:6,
    settings:[{key:"mode",label:"Modo",ariaLabel:"Modo do Love Letter",type:"select",choices:[{value:"classic",label:"Clássico"},{value:"modern",label:"Moderno"}]}],
  },
  solo: {
    options:soloOptionsSchema,action:soloActionSchema,view:soloViewSchema,
    defaults:{mode:"single",brutal:false},developmentOnly:true,croins:false,replay:true,kickDuringPlay:false,media:{card:false,turn:false,reason:"Sons da mesa pendentes; o aviso global de vez cobre o turno."},
    minPlayers:2,maxPlayers:()=>10,
    settings:[{key:"mode",label:"Duração",type:"select",choices:[{value:"single",label:"Uma rodada"},{value:"rounds3",label:"3 rodadas"},{value:"rounds4",label:"4 rodadas"},{value:"points100",label:"100 pontos"},{value:"points250",label:"250 pontos"},{value:"points500",label:"500 pontos"}]}],
  },
} satisfies Record<string,GameDefinition>;
export const gameIdSchema=z.enum(Object.keys(gameDefinitions) as [keyof typeof gameDefinitions,...(keyof typeof gameDefinitions)[]]);
export type GameId=z.infer<typeof gameIdSchema>;
export const gameOptionsSchema=z.union([flip7OptionsSchema,loveOptionsSchema,soloOptionsSchema]);
export const gameActionSchema=z.union([flip7ActionSchema,loveActionSchema,soloActionSchema]);
export type GameOptions=z.infer<typeof gameOptionsSchema>;
export type GameAction=z.infer<typeof gameActionSchema>;
export type GameEngineAction=GameAction|{type:"step"|"draw"|"stay"|"next"};
export const gameViewSchema=z.union([flip7ViewSchema,loveViewSchema,soloViewSchema]);
export const gameEventActionSchema=z.union([flip7EventActionSchema,loveActionSchema,soloActionSchema]);
export type GameView=z.infer<typeof flip7ViewSchema>|z.infer<typeof loveViewSchema>|z.infer<typeof soloViewSchema>;
export function getGameDefinition(slug:string):GameDefinition|null {
  return Object.hasOwn(gameDefinitions,slug)?gameDefinitions[slug as GameId]:null;
}
/** Standard media applied when a game does not override a slot. */
export const standardGameMedia:GameMedia = { card:true, turn:true };
export function gameMedia(slug:string|null|undefined):GameMedia {
  return (slug ? getGameDefinition(slug)?.media : null) ?? standardGameMedia;
}
export function settingValue(options:unknown,key:string):unknown {
  return options && typeof options==="object"?Reflect.get(options,key):undefined;
}
export function visibleSettings(definition:GameDefinition,options:unknown) {
  return definition.settings.filter(field=>!field.visibleWhen || settingValue(options,field.visibleWhen.key)===field.visibleWhen.value);
}
// Keep the current configuration first; alternatives come from the game's
// declared selectors, including their dependent resets and validation.
function playerConfigurations(definition:GameDefinition,options:unknown):GameOptions[] {
  const configurations=[gameOptionsSchema.parse(definition.options.parse(options))];
  const seen=new Set(configurations.map(value=>JSON.stringify(value)));
  for(let index=0;index<configurations.length;index++){
    const current=configurations[index];
    for(const field of visibleSettings(definition,current)){
      if(field.type!=="select")continue;
      for(const choice of field.choices ?? []){
        if(settingValue(current,field.key)===choice.value)continue;
        const parsed=definition.options.safeParse({...current,...field.reset,[field.key]:choice.value});
        if(!parsed.success)continue;
        const next=gameOptionsSchema.parse(parsed.data),key=JSON.stringify(next);
        if(!seen.has(key)){seen.add(key);configurations.push(next);}
      }
    }
  }
  return configurations;
}
export function maxGamePlayers(definition:GameDefinition,options:unknown):number {
  return Math.max(...playerConfigurations(definition,options).map(value=>definition.maxPlayers(value)));
}
export function gameOptionsForPlayers(definition:GameDefinition,options:unknown,count:number):GameOptions {
  if(!Number.isInteger(count) || count<definition.minPlayers)throw Error("Quantidade inválida de jogadores.");
  const compatible=playerConfigurations(definition,options).find(value=>count<=definition.maxPlayers(value));
  if(!compatible)throw Error("Quantidade inválida de jogadores.");
  return compatible;
}
export function gameSettingBadges(definition:GameDefinition,options:unknown):{label:string;variant:"default"|"secondary"}[] {
  return visibleSettings(definition,options).flatMap(field=>{
    const value=settingValue(options,field.key);
    const label=field.type==="switch"?(value?field.badgeLabel ?? field.label:null):field.choices?.find(c=>c.value===value);
    if(!label)return [];
    return [{label:typeof label==="string"?label:label.shortLabel ?? label.label,variant:field.badgeVariant ?? "secondary"}];
  });
}
export function gameSettingLabels(definition:GameDefinition,options:unknown) {
  return gameSettingBadges(definition,options).map(badge=>badge.label);
}

export const legacyGameIdentity={id:"flip7",name:"Flip 7"} as const;
