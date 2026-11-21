import { getGameDefinition, gameOptionsSchema, type GameOptions } from "@croebet/shared";

export function readGamePreferences(game:string,storage?:Storage):{count:number;options:GameOptions} {
  const definition=getGameDefinition(game);
  if(!definition)throw Error("Jogo não registrado.");
  const fallback={count:definition.minPlayers,options:gameOptionsSchema.parse(definition.defaults)};
  try {
    const source=storage ?? window.localStorage;
    const raw=source.getItem(`croebet:${game}:setup`);
    if(!raw)return fallback;
    const saved:unknown=JSON.parse(raw);
    if(!saved || typeof saved!=="object")return fallback;
    const options=gameOptionsSchema.parse(definition.options.parse("options" in saved?saved.options:saved && Object.fromEntries(Object.entries(saved).filter(([key])=>key!=="count"))));
    const count="count" in saved?Number(saved.count):NaN;
    return Number.isInteger(count) && count>=definition.minPlayers && count<=definition.maxPlayers(options)?{count,options}:fallback;
  }catch{return fallback;}
}
export function saveGamePreferences(game:string,count:number,options:unknown,storage:Storage=window.localStorage) {
  const definition=getGameDefinition(game);
  if(!definition)throw Error("Jogo não registrado.");
  const validated=definition.options.parse(options);
  if(!Number.isInteger(count)||count<definition.minPlayers||count>definition.maxPlayers(validated))throw Error("Quantidade inválida.");
  // Retain the established flat format for existing clients.
  storage.setItem(`croebet:${game}:setup`,JSON.stringify({count,...gameOptionsSchema.parse(validated)}));
}
