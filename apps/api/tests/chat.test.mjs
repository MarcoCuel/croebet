import { test } from "node:test";
import assert from "node:assert/strict";
import { chatSendSchema, chatSyncQuerySchema, chatMuteSchema } from "@croebet/shared";
import { randomUUID } from "node:crypto";
test("chat valida texto simples, limites de cursor e períodos de moderação",()=>{
  assert.equal(chatSendSchema.parse({requestId:randomUUID(),text:"  Olá 👋  "}).text,"Olá 👋");
  for(const text of ["", "   ", "a".repeat(501)])assert.equal(chatSendSchema.safeParse({requestId:randomUUID(),text}).success,false);
  for(const after of ["-1","1e3","01","9223372036854775808"])assert.equal(chatSyncQuerySchema.safeParse({after}).success,false);
  assert.equal(chatSyncQuerySchema.parse({after:"9223372036854775807"}).after,"9223372036854775807");
  assert.equal(chatMuteSchema.safeParse({minutes:999}).success,false);
});
