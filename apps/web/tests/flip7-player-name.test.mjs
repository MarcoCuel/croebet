import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playerName, gameWithPlayerNames } from '../features/games/flip7/player-name.ts';

test('mesa prioriza nome de exibição por vaga sem modificar estado, bots ou histórico', () => {
  const game = { players: [{ name: 'login1', kind: 'human' }, { name: 'Bot', kind: 'bot' }, { name: 'Excluído', kind: 'human' }], log: [{ message: 'Histórico original' }] };
  const participants = [{ seat: 1, username: 'login2', displayName: 'Pessoa 2' }, { seat: 0, username: 'login1', displayName: 'Pessoa 1' }];
  const before = structuredClone(game);
  const displayed = gameWithPlayerNames(game, participants);
  assert.deepEqual(displayed.players.map(player => player.name), ['Pessoa 1', 'Bot', 'Excluído']);
  assert.deepEqual(game, before);
  assert.equal(displayed.log, game.log);
  assert.equal(playerName({ displayName: '   ', username: 'login' }), 'login');
  assert.equal(playerName({ username: 'convidado' }), 'convidado');
});
