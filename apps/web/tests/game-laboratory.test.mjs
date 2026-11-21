import { test } from 'node:test';
import { OrthographicCamera, Vector3, Euler } from 'three';
import assert from 'node:assert/strict';
import { handPlacements, handWindow, seatPlacements, sceneBounds, fitCamera, viewHandOptions, surfacePlacement, worldHandPose, foregroundSeat } from '../three/table/layout.ts';
import { createCardGeometry } from '../three/table/card-geometry.ts';
import { TablePile } from '../three/table/pile.ts';
import { arcPosition, easedProgress } from '../three/table/motion.ts';
import { parseSettings, defaultSettings, initialState, laboratoryReducer } from '../features/games/laboratory/model.ts';
const options = { layout: 'fan', width: 5.5, curve: 1.2, spacing: 0.76, overlap: 0.35, tilt: 14, scale: 1.15, orientation: 0 };

test('mãos vazias, únicas e grandes mantêm posições finitas e largura limitada', () => {
  for (const count of [0, 1, 7, 20, 50, 1000]) {
    for (const layout of ['line', 'fan']) {
      const cards = handPlacements(count, { ...options, layout });
      assert.equal(cards.length, count);
      assert.ok(cards.every(card => [...card.position, ...card.rotation, card.scale].every(Number.isFinite)));
      if (count) assert.ok(cards.at(-1).position[0] - cards[0].position[0] <= options.width + 1e-9);
      if (layout === 'line') assert.ok(cards.every(card => card.rotation[2] === 0));
    }
  }
  assert.equal(handPlacements(1, options)[0].position[0], 0);
  assert.ok(handWindow(1000, 9, 0.5).length > handWindow(1000, 2, 1.8).length);
  assert.ok(handWindow(1000, 9, 0.5).length > 20);
  const last = handWindow(1000, 5, 1, 999);
  assert.equal(last.start + last.length, 1000);
});

test('câmera ortográfica enquadra retrato/paisagem e preserva tamanho independente da profundidade', () => {
  for (const players of [2, 3, 4, 6, 8, 12]) for (const viewer of [0, players - 1]) {
    const seats = seatPlacements(players, viewer, 4, 3.2, 5.5);
    assert.equal(seats[0].seat, viewer); assert.equal(seats[0].position[0], 0); assert.ok(seats[0].position[2] > 0);
    assert.equal(new Set(seats.map(seat => seat.seat)).size, players);
    const points = sceneBounds(seats, { ...options, scale: 1.8, curve: 3 }, Array(12).fill(1000), 36);
    for (const aspect of [0.4, 0.7, 1, 1.8, 2.4]) for (const angle of [25, 36, 65]) {
      const fit = fitCamera(points, aspect, angle); const pitch = angle * Math.PI / 180;
      const camera = new OrthographicCamera(fit.left, fit.right, fit.top, fit.bottom, 0.1, 250);
      camera.position.fromArray(fit.position); camera.lookAt(...fit.target); camera.updateMatrixWorld();
      for (const point of points) {
        const projected = new Vector3(...point).project(camera);
        assert.ok(Math.abs(projected.x) <= 1 + 1e-8);
        assert.ok(Math.abs(projected.y) <= 1 + 1e-8);
        assert.ok(Math.abs(projected.z) <= 1);
      }
      // An equal card moved toward the back must keep exactly the same screen width.
      const center = new Vector3(...fit.target);
      const near = center.clone().add(new Vector3(0, Math.sin(pitch) * 3, Math.cos(pitch) * 3));
      const far = center.clone().sub(new Vector3(0, Math.sin(pitch) * 3, Math.cos(pitch) * 3));
      const width = position => position.clone().add(new Vector3(0.72, 0, 0)).project(camera).x - position.clone().project(camera).x;
      assert.ok(Math.abs(width(near) - width(far)) < 1e-9);
    }
  }
});

test('preferências migram presets anteriores e recusam valores corrompidos', () => {
  assert.deepEqual(parseSettings(defaultSettings), defaultSettings);
  const { tilt, overlap, ...legacy } = defaultSettings;
  assert.equal(parseSettings(legacy).tilt, tilt); assert.equal(parseSettings(legacy).overlap, overlap);
  for (const value of [null, {}, { ...defaultSettings, viewer: 8 }, { ...defaultSettings, angle: NaN },
    { ...defaultSettings, counts: Array(12).fill(1001) }, { ...defaultSettings, players: 4.5 },
    { ...defaultSettings, shadows: 'sim' }, { ...defaultSettings, layout: 'unknown' }, { ...defaultSettings, scale: Infinity }]) assert.equal(parseSettings(value), null);
});
const identities = state => [...state.hands.flat(), ...state.deck, ...state.discard].map(card => card.id).sort();
test('comprar, distribuir, virar, descartar, trocar, recolher e embaralhar preservam cartas e identidades', () => {
  let state = initialState(defaultSettings); const ids = identities(state);
  const apply = action => { const previous = state; state = laboratoryReducer(state, action); assert.deepEqual(identities(state), ids); assert.equal(new Set(identities(state)).size, ids.length); assert.notEqual(previous, state); };
  const bought = state.deck.at(-1).id;
  apply({ type: 'draw', seat: 0 }); assert.equal(state.hands[0].at(-1).id, bought);
  apply({ type: 'deal', players: 4, count: 3 }); assert.equal(state.cue.ids.length, 12);
  const persistentMotion = state.motions[bought];
  apply({ type: 'flip', seat: 0, id: bought }); assert.ok(state.flipped.includes(bought));
  const another = state.hands[0][0].id; const counterpart = state.hands[1].at(-1).id;
  apply({ type: 'swap', seat: 0, target: 1, id: another });
  assert.equal(state.hands[1].at(-1).id, another); assert.ok(state.hands[0].some(card => card.id === counterpart));
  const motionBeforeUnrelated = state.motions[another];
  apply({ type: 'discard', seat: 0, id: bought }); assert.equal(state.discard.at(-1).id, bought);
  assert.deepEqual(state.motions[another], motionBeforeUnrelated); assert.ok(persistentMotion);
  apply({ type: 'collect', players: 4 }); assert.ok(state.hands.slice(0, 4).every(hand => hand.length === 0)); assert.equal(state.discard.length, 0);
  apply({ type: 'shuffle', order: state.deck.map((_, i) => state.deck.length - i - 1) });
  assert.equal(laboratoryReducer(state, { type: 'shuffle', order: [0, 0] }), state);
});

test('trajetórias arqueadas preservam os extremos e respeitam atraso e duração', () => {
  const from = [0, 0, 0], to = [4, 1, 2];
  assert.deepEqual(arcPosition(from, to, 0, 2), from);
  const end = arcPosition(from, to, 1, 2); assert.ok(end.every((n, i) => Math.abs(n - to[i]) < 1e-9));
  assert.ok(arcPosition(from, to, 0.5, 2)[1] > 2);
  assert.equal(easedProgress(0.2, 1, 0.3), 0); assert.equal(easedProgress(1.3, 1, 0.3), 1);
});


test('pilhas representativas permanecem compactas, sólidas e limitadas após recolher cartas', () => {
  for (const count of [0, 1, 16, 104, 1000]) {
    const cards = Array.from({ length: count }, (_, i) => ({ id: `pile:${i}`, value: i % 10 }));
    const pile = TablePile({ cards, position: [0, 0.01, 0], height: defaultSettings.pileHeight, faceUp: false });
    assert.ok(pile.length <= 16);
    for (let i = 1; i < pile.length; i++) {
      const lowerTop = pile[i - 1].pose.position[1] + 0.002;
      const upperBottom = pile[i].pose.position[1] + 0.002 - pile[i].thickness;
      assert.ok(Math.abs(lowerTop - upperBottom) < 1e-9);
    }
    if (count) assert.ok(pile.at(-1).pose.position[1] <= 0.61);
  }
  assert.equal(parseSettings({ ...defaultSettings, pileHeight: 0.022 }).pileHeight, defaultSettings.pileHeight);
});


test('cada observador recebe a mesma composição com sua mão em primeiro plano e adversários legíveis', () => {
  for (const players of [2, 3, 4, 6, 8, 12]) {
    const reference = seatPlacements(players, 0, 4, 3.2, 5.5);
    for (let viewer = 0; viewer < players; viewer++) {
      const seats = seatPlacements(players, viewer, 4, 3.2, 5.5);
      assert.equal(seats[0].seat, viewer);
      seats.forEach((seat, place) => {
        assert.deepEqual(seat.position, reference[place].position);
        assert.equal(seat.seat, (viewer + place) % players);
        if (place) {
          assert.ok(seat.position[2] < 1e-9);
          // At least 79% of the face width remains visible instead of a side-on hand.
          assert.ok(Math.cos(seat.angle) > 0.79);
        }
      });
    }
    assert.ok(viewHandOptions(options, true, 36).scale > viewHandOptions(options, false, 36).scale);
  }
  const seats = seatPlacements(4, 0, 4, 3.2, 5.5);
  const right = worldHandPose({ position: [1, 0, 0], rotation: [0, 0, 0], scale: 1 }, seats[1]);
  const left = worldHandPose({ position: [1, 0, 0], rotation: [0, 0, 0], scale: 1 }, seats[3]);
  assert.ok(right.position[0] > seats[1].position[0] && right.position[2] > seats[1].position[2]);
  assert.ok(left.position[0] > seats[3].position[0] && left.position[2] < seats[3].position[2]);
});

test('superfície fica fora do ajuste de câmera e continua além do primeiro plano', () => {
  const seats = seatPlacements(4, 0, 4, 3.2, 5.5);
  const bounds = sceneBounds(seats, options, Array(12).fill(1000), 36);
  for (const aspect of [0.4, 1, 1.8, 2.4]) {
    const fit = fitCamera(bounds, aspect, 36);
    const surface = surfacePlacement(fit, 4, 3.2);
    assert.ok(surface.centerZ + surface.depth > fit.position[2]);
    assert.ok(surface.centerZ - surface.depth < -3.2);
    assert.ok(surface.radius > 4);
  }
});


test('adversários mantêm fileiras paralelas e verticais independentemente do leque local', () => {
  for (const layout of ['fan', 'line']) for (const curve of [0, 1.2, 3]) {
    const configured = { ...options, layout, curve, orientation: 45, tilt: 45 };
    const opponent = viewHandOptions(configured, false, 36);
    const cards = handPlacements(7, opponent);
    assert.ok(cards.every(card => card.rotation[2] === 0 && card.rotation[1] === 0));
    assert.ok(cards.every(card => card.position[1] === cards[0].position[1]));
    assert.ok(cards.every(card => Math.abs(card.rotation[0]) <= 8 * Math.PI / 180));
    const local = viewHandOptions(configured, true, 36);
    assert.equal(local.layout, layout);
    assert.equal(local.curve, curve);
  }
});

test('papel curvo preserva cantos, dimensões e faces alinhadas sem curvar as pilhas', () => {
  const flat = createCardGeometry(), curved = createCardGeometry(0.018);
  try {
    const positions = curved.face.getAttribute('position');
    const back = curved.backFace.getAttribute('position');
    let minZ = 0;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      assert.ok(Math.abs(x) <= 0.36 + 1e-6 && Math.abs(y) <= 0.525 + 1e-6);
      assert.ok(Math.abs(z + back.getZ(i)) < 1e-6);
      if (Math.abs(y) > 0.52) assert.ok(Math.abs(z) < 1e-6);
      minZ = Math.min(minZ, z);
    }
    assert.ok(minZ < -0.017 && minZ > -0.019);
    const flatPositions = flat.face.getAttribute('position');
    for (let i = 0; i < flatPositions.count; i++) assert.equal(Math.abs(flatPositions.getZ(i)), 0);
    for (const geometry of Object.values(curved)) {
      assert.ok([...geometry.getAttribute('normal').array].every(Number.isFinite));
    }
  } finally {
    for (const set of [flat, curved]) for (const geometry of Object.values(set)) geometry.dispose();
  }
});


test('presets antigos restauram iluminação suave e novos controles recusam valores inválidos', () => {
  const legacy = { ...defaultSettings, light: 3, ambient: 1.2 };
  for (const key of ['pointLight', 'pointHeight', 'exposure', 'shadowSoftness', 'shadowOpacity']) delete legacy[key];
  const migrated = parseSettings(legacy);
  assert.equal(migrated.light, defaultSettings.light);
  assert.equal(migrated.ambient, defaultSettings.ambient);
  assert.equal(migrated.radius, legacy.radius);
  for (const key of ['pointLight', 'pointHeight', 'exposure', 'shadowSoftness', 'shadowOpacity']) assert.equal(migrated[key], defaultSettings[key]);
  for (const change of [{ pointLight: -1 }, { pointHeight: 0 }, { exposure: 2 }, { shadowSoftness: 0 }, { shadowOpacity: 1 }]) {
    assert.equal(parseSettings({ ...defaultSettings, ...change }), null);
  }
  const customized = { ...defaultSettings, exposure: 0.7, light: 0.9, shadowSoftness: 9, shadowOpacity: 0.2 };
  assert.deepEqual(parseSettings(customized), customized);
});


test('mão local fica no rodapé com a base cortada sem esconder centro ou números', () => {
  for (const aspect of [0.4, 0.7, 1, 1.8, 2.4]) for (const angle of [25, 36, 65]) {
    const seats = seatPlacements(4, 0, 4, 3.2, 5.5);
    const fit = fitCamera(sceneBounds(seats, options, Array(12).fill(1000), angle), aspect, angle);
    const seat = foregroundSeat(seats[0], fit, options, angle);
    const pose = worldHandPose(handPlacements(1, viewHandOptions(options, true, angle))[0], seat);
    const camera = new OrthographicCamera(fit.left, fit.right, fit.top, fit.bottom, 0.1, 250);
    camera.position.fromArray(fit.position); camera.lookAt(...fit.target); camera.updateMatrixWorld();
    const project = y => new Vector3(0, y * pose.scale, 0).applyEuler(new Euler(...pose.rotation, 'YXZ')).add(new Vector3(...pose.position)).project(camera);
    assert.ok(project(-0.525).y < -1, 'base deve ultrapassar a borda inferior');
    assert.ok(project(0.525).y > -1, 'topo deve permanecer dentro da prévia');
    assert.ok(project(0).y > -1 && project(0).y < -0.5, 'valor deve permanecer visível no rodapé');
    assert.ok(Math.abs(project(0).z) < 1, 'carta não deve atravessar o near/far da câmera');
    assert.equal(seat.position[1], seats[0].position[1], 'não enterrar as cartas sob a mesa');
  }
  const oldDefaults = parseSettings({ ...defaultSettings, ambient: 0.55, exposure: 0.85, light: 1.1 });
  assert.equal(oldDefaults.ambient, defaultSettings.ambient);
  assert.equal(oldDefaults.exposure, defaultSettings.exposure);
});
