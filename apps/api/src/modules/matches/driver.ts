/** The executor owns persistence; the driver owns rules and public projections. */
export type GameDriver<State, View, Setup, Action> = {
  rulesVersion: number;
  /** Persisted updated_at anchors the server-side reaction interval. */
  deferredAutomaticMs?: number;
  create: (setup: Setup, username: string) => State;
  parse: (value: unknown) => State;
  project: (state: State) => View;
  apply: (state: State, action: Action) => State;
  automatic: (state: State) => Action | null;
  finished: (state: State) => boolean;
};

export type GameSetup = {
  setup: {name:string;kind:"human"|"normal"}[];
  options: unknown;
  onlyBots?: boolean;
};
export type GameOutcome = { winners:number[]; humanSeats:number[] };
export type GamePlayerSummary = {name:string;score:number;bot:boolean;winner:boolean};

/** Unknown values cross the registry boundary only through the module's parsers. */
export type MatchDriver<View, Action> = GameDriver<unknown,View,GameSetup,Action> & {
  authorize?: (state:unknown,seat:number,action:Action)=>boolean;
  decision: (state:unknown)=>{seat:number;key:string}|null;
  human: (state:unknown,seat:number)=>boolean;
  replace: (state:unknown,seat:number)=>unknown;
  projectFor: (state:unknown,seat:number|null)=>View;
  eventAction: (action:Action)=>Action;
  outcome: (state:unknown)=>GameOutcome;
  summarize: (view:unknown)=>GamePlayerSummary[];
  snapshotOnly: boolean;
};
