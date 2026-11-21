import { z } from "zod";
import { flip7OptionsSchema, flip7ActionSchema, flip7EventActionSchema, flip7ViewSchema } from "./flip7.js";
import { loveOptionsSchema, loveActionSchema, loveViewSchema } from "./love-letter.js";

export type SettingField = {
  key: string; label: string; ariaLabel?: string; badgeLabel?:string; badgeVariant?:"default"|"secondary";
  type: "select" | "switch";
  choices?: {value:string;label:string;shortLabel?:string}[];
  visibleWhen?: {key:string;value:string};
  reset?: Record<string,boolean>;
};
export type GameDefinition = {
  options: z.ZodType; action: z.ZodType; view: z.ZodType;
  defaults: Record<string,string|boolean>;
  developmentOnly: boolean; croins: boolean; replay: boolean; kickDuringPlay:boolean; tableTurnSound:boolean;
  minPlayers: number; maxPlayers: (options:unknown)=>number;
  settings: SettingField[];
};

// Explicit registration keeps unreviewed catalog entries from executing code.
export const gameDefinitions = {
  flip7: {
    options:flip7OptionsSchema, action:flip7ActionSchema, view:flip7ViewSchema,
    defaults:{mode:"classic",brutal:false}, developmentOnly:false,croins:true,replay:true,kickDuringPlay:true,tableTurnSound:true,
    minPlayers:2,maxPlayers:()=>12,
    settings:[
      {key:"mode",label:"Modo",ariaLabel:"Modo do Flip7",type:"select",reset:{brutal:false},choices:[{value:"classic",label:"Clássico"},{value:"vengeance",label:"A vingança nunca é plena",shortLabel:"Vingança"}]},
      {key:"brutal",label:"Modo Brutal",badgeLabel:"Brutal",badgeVariant:"default",type:"switch",visibleWhen:{key:"mode",value:"vengeance"}},
    ],
  },
  "love-letter": {
    options:loveOptionsSchema,action:loveActionSchema,view:loveViewSchema,
    defaults:{mode:"classic",brutal:false},developmentOnly:true,croins:false,replay:false,kickDuringPlay:false,tableTurnSound:false,
    minPlayers:2,maxPlayers:(options:unknown)=>loveOptionsSchema.parse(options).mode==="classic"?4:6,
    settings:[{key:"mode",label:"Modo",ariaLabel:"Modo do Love Letter",type:"select",choices:[{value:"classic",label:"Clássico"},{value:"modern",label:"Moderno"}]}],
  },
} satisfies Record<string,GameDefinition>;
export const gameIdSchema=z.enum(Object.keys(gameDefinitions) as [keyof typeof gameDefinitions,...(keyof typeof gameDefinitions)[]]);
export type GameId=z.infer<typeof gameIdSchema>;
export const gameOptionsSchema=z.union([flip7OptionsSchema,loveOptionsSchema]);
export const gameActionSchema=z.union([flip7ActionSchema,loveActionSchema]);
export type GameOptions=z.infer<typeof gameOptionsSchema>;
export type GameAction=z.infer<typeof gameActionSchema>;
export type GameEngineAction=GameAction|{type:"step"|"draw"|"stay"|"next"};
export const gameViewSchema=z.union([flip7ViewSchema,loveViewSchema]);
export const gameEventActionSchema=z.union([flip7EventActionSchema,loveActionSchema]);
export type GameView=z.infer<typeof flip7ViewSchema>|z.infer<typeof loveViewSchema>;
export function getGameDefinition(slug:string):GameDefinition|null {
  return Object.hasOwn(gameDefinitions,slug)?gameDefinitions[slug as GameId]:null;
}
export function settingValue(options:unknown,key:string):unknown {
  return options && typeof options==="object"?Reflect.get(options,key):undefined;
}
export function visibleSettings(definition:GameDefinition,options:unknown) {
  return definition.settings.filter(field=>!field.visibleWhen || settingValue(options,field.visibleWhen.key)===field.visibleWhen.value);
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
