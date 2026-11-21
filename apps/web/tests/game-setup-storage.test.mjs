import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readGamePreferences,saveGamePreferences} from '../features/games/setup-storage.ts';

test('preferências são independentes por jogo e aceitam o formato já salvo',()=>{
 const data=new Map([['croebet:flip7:setup',JSON.stringify({count:5,mode:'vengeance',brutal:true})]]);
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 assert.deepEqual(readGamePreferences('flip7',storage),{count:5,options:{mode:'vengeance',brutal:true}});
 saveGamePreferences('love-letter',6,{mode:'modern'},storage);
 assert.deepEqual(readGamePreferences('love-letter',storage),{count:6,options:{mode:'modern',brutal:false}});
 assert.equal(readGamePreferences('flip7',storage).count,5);
 assert.throws(()=>saveGamePreferences('love-letter',6,{mode:'classic'},storage));
 assert.equal(readGamePreferences('love-letter',storage).count,6);
 data.set('croebet:love-letter:setup','invalid');
 assert.deepEqual(readGamePreferences('love-letter',storage),{count:2,options:{mode:'classic',brutal:false}});
});
