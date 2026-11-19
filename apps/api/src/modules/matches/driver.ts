/** The match executor knows persistence and commands; a driver owns game rules. */
export type GameDriver<State, View, Setup, Action> = {
  rulesVersion: number;
  create: (setup: Setup, username: string) => State;
  parse: (value: unknown) => State;
  project: (state: State) => View;
  apply: (state: State, action: Action) => State;
  automatic: (state: State) => Action | null;
  finished: (state: State) => boolean;
};
