import assert from "node:assert/strict";
import { test } from "node:test";
import { createGameAudioPlayer, prepareAudioCue } from "../features/games/game-audio-player.ts";

function buffer(channels, sampleRate = 1000) {
  return { numberOfChannels: channels.length, length: channels[0].length, sampleRate, duration: channels[0].length / sampleRate, getChannelData: index => channels[index] };
}
function impulse(length, first, last) {
  const samples = new Float32Array(length);
  samples.fill(0.5, first, last + 1);
  return samples;
}
function engine() {
  const nodes = [];
  const destination = {};
  const context = { state: "running", createBufferSource() {
    const node = { started: null, stopped: 0, disconnected: 0, onended: null, connect(target) { assert.equal(target, destination); }, start(...args) { this.started = args; }, stop() { this.stopped++; }, disconnect() { this.disconnected++; } };
    nodes.push(node);
    return node;
  } };
  return { context, nodes, player: createGameAudioPlayer(context, destination) };
}

test("silêncio do arquivo não atrasa o impacto nem prolonga o efeito até a próxima carta", () => {
  const cue = prepareAudioCue(buffer([impulse(900, 300, 470)]));
  assert.equal(cue.offset, 0.296);
  assert.equal(cue.duration, 0.195);
  const { player, nodes } = engine();
  player.play(cue);
  assert.deepEqual(nodes[0].started, [0, cue.offset, cue.duration]);
});

test("recorte preserva o áudio de todos os canais e ignora ruído baixo nas margens", () => {
  const left = impulse(1000, 400, 500), right = impulse(1000, 100, 800);
  left[0] = 0.001; right[999] = 0.001;
  const cue = prepareAudioCue(buffer([left, right]));
  assert.equal(cue.offset, 0.096);
  assert.ok(Math.abs(cue.duration - 0.725) < 1e-9);
  assert.equal(prepareAudioCue(buffer([new Float32Array(100)])), null);
});

test("pausa ou seek interrompe todos os sons já iniciados e não os retoma na próxima jogada", () => {
  const { player, nodes } = engine();
  const cue = prepareAudioCue(buffer([impulse(500, 0, 300)]));
  player.play(cue); player.play(cue);
  player.stop(); player.stop();
  assert.deepEqual(nodes.map(node => [node.stopped, node.disconnected, node.onended]), [[1, 1, null], [1, 1, null]]);
  player.play(cue);
  assert.equal(nodes.length, 3);
  assert.equal(nodes[2].stopped, 0);
});

test("fontes concluídas são liberadas e não voltam a ser interrompidas", () => {
  const { player, nodes } = engine();
  player.play(prepareAudioCue(buffer([impulse(300, 20, 100)])));
  nodes[0].onended();
  player.stop();
  assert.equal(nodes[0].disconnected, 1);
  assert.equal(nodes[0].stopped, 0);
});

test("áudio ausente ou contexto suspenso não enfileira sons para depois", () => {
  const { player, nodes, context } = engine();
  player.play(null);
  context.state = "suspended";
  player.play(prepareAudioCue(buffer([impulse(300, 20, 100)])));
  context.state = "running";
  assert.equal(nodes.length, 0);
});
