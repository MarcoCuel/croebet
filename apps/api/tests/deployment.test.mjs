import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDeploymentMatches } from '../dist/modules/matches/deployment.js';
import { matchDriver } from '../dist/modules/games/flip7/driver.js';
import { loveDriver } from '../dist/modules/games/love-letter/driver.js';

const setup = [{name:'Ana',kind:'human'},{name:'Beto',kind:'human'}];
const row = (game_slug,driver,options) => ({game_slug,rules_version:driver.rulesVersion,status:'playing',options,state:driver.create({setup,options},'Ana')});
const client = rows => ({query:async sql=>{assert.ok(sql.startsWith('select '));return {rows};}});
test('deploy aceita snapshots ativos de ambos os jogos sem executar ou alterar estados',async()=>{
  const flip = row('flip7',matchDriver,{mode:'vengeance',brutal:true});
  const love = row('love-letter',loveDriver,{mode:'classic',brutal:false});
  const rows = [flip,love,{...flip,status:'lobby',state:null}];
  const before = structuredClone(rows);
  assert.equal(await validateDeploymentMatches(client(rows)),3);
  assert.deepEqual(rows,before);
});
test('deploy recusa regras, jogo, opções e estado incompatíveis sem expor dados privados',async()=>{
  const valid = row('flip7',matchDriver,{mode:'classic',brutal:false});
  for(const change of [{rules_version:2},{game_slug:'missing'},{options:{}},{state:{secret:'private-deck'}}]){
    await assert.rejects(validateDeploymentMatches(client([{...valid,...change}])),error=>{
      assert.match(error.message,/não é compatível/);
      assert.equal(error.message.includes('private-deck'),false);
      return true;
    });
  }
});
