"use client";
import type {GameId} from "@croebet/shared";
import type {GamePresentation} from "./game-module";
import {presentation as flip7} from "./flip7/module";
import {presentation as loveLetter} from "./love-letter/module";

export const gamePresentations:Record<GameId,GamePresentation>={flip7,"love-letter":loveLetter};
