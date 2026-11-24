"use client";
import type {GameId} from "@croebet/shared";
import type {GamePresentation} from "./game-module";
import {presentation as flip7} from "./flip7/module";
import {presentation as solo} from "./solo/module";
import {presentation as loveLetter} from "./love-letter/module";

import {presentation as social} from "./social/module";
export const gamePresentations:Record<GameId,GamePresentation>={coup:social,dixit:social,"secret-hitler":social,spyfall:social,flip7,"love-letter":loveLetter,solo};
