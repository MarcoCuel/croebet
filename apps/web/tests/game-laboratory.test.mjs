import { test } from 'node:test';
import { OrthographicCamera, Vector3, Euler } from 'three';
import assert from 'node:assert/strict';
import { handPlacements, handWindow, seatPlacements, sceneBounds, fitCamera, worldHandPose, foregroundSeat, pileRotation } from '../three/table/layout.ts';
import { resolveTableLayout, adaptiveHandWindow } from '../three/table/adaptive-layout.ts';
import { constrainDeckTransform, constrainDiscardTransform, pileBounds, poseBounds } from '../three/table/pile-transform.ts';
import { constrainDeckPosition, moveDeckByPixels } from '../three/table/deck-placement.ts';
import { createCardGeometry } from '../three/table/card-geometry.ts';
import { TablePile } from '../three/table/pile.ts';
import { arcPosition, cardMotionUpdate, consumeCardMotion, distributionDelay, easedProgress, raisedCardPosition } from '../three/table/motion.ts';
import { parseSettings, defaultSettings, initialState, laboratoryReducer } from '../features/games/laboratory/model.ts';
const options = { layout: 'fan', width: 5.5, curve: 1.2, spacing: 0.76, overlap: 0.35, tilt: 14, scale: 1.15, orientation: 0 };

test('leque mantém bordas tangentes ao mesmo arco e cada carta inteiramente à frente da anterior', () => {
  const paper = createCardGeometry(0.004);
  try {
    for (const count of [2, 7, 15, 26]) for (const angle of [25, 36, 65]) {
      const layout = resolveTableLayout({ players: 4, viewer: 0, counts: Array(12).fill(count), width: 1200, height: 700, angle, deck: [-1.5, 0.035, -0.6] });
      const poses = handPlacements(Math.min(count, layout.hands[0].visibleLimit), layout.hands[0]);
      const normal = new Vector3(0, Math.sin(angle * Math.PI / 180), Math.cos(angle * Math.PI / 180));
      const up = new Vector3(0, normal.z, -normal.y);
      let previousFront = -Infinity;
      for (const pose of poses) {
        const rotation = new Euler(...pose.rotation, 'YXZ');
        const depths = [];
        for (const [mesh, offset] of [[paper.face, 0.0022], [paper.edge, 0], [paper.backFace, -0.0022]]) {
          const vertices = mesh.getAttribute('position');
          for (let i = 0; i < vertices.count; i++) {
            const point = new Vector3().fromBufferAttribute(vertices, i);
            if (mesh === paper.backFace) point.applyEuler(new Euler(0, Math.PI, 0));
            point.z += offset;
            depths.push(point.multiplyScalar(pose.scale).applyEuler(rotation).add(new Vector3(...pose.position)).dot(normal));
          }
        }
        assert.ok(Math.min(...depths) > previousFront, 'a carta seguinte não pode atravessar ou ficar atrás da anterior');
        previousFront = Math.max(...depths);
      }
      for (let i = 1; i < poses.length; i++) {
        const previous = poses[i - 1], current = poses[i];
        const displacement = new Vector3(...current.position).sub(new Vector3(...previous.position));
        const tangent = Math.atan2(displacement.dot(up), displacement.x);
        assert.ok(Math.abs(tangent - (previous.rotation[2] + current.rotation[2]) / 2) < 1e-8, 'centros e inclinações devem seguir o mesmo arco');
      }
    }
  } finally { for (const geometry of Object.values(paper)) geometry.dispose(); }
});

test('carta comprada entra no fim da mão e ocupa a camada superior do leque', () => {
  const before = initialState(defaultSettings);
  const purchased = before.deck.at(-1);
  const after = laboratoryReducer(before, { type: 'draw', seat: 0 });
  assert.equal(after.hands[0].at(-1).id, purchased.id);
  const poses = handPlacements(after.hands[0].length, { ...options, tilt: 36 });
  const normal = new Vector3(0, Math.sin(Math.PI / 5), Math.cos(Math.PI / 5));
  const depth = pose => new Vector3(...pose.position).dot(normal);
  assert.ok(poses.slice(0, -1).every(pose => depth(pose) < depth(poses.at(-1))));
});

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
    const points = sceneBounds(seats, seats.map(seat => ({ ...options, width: seat.width, scale: 1.8, curve: 3 })), Array(12).fill(1000));
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
  const legacy = { ...defaultSettings }; delete legacy.numberCardColor;
  assert.equal(parseSettings(legacy).numberCardColor, '#ad158f');
  assert.equal(parseSettings({ ...defaultSettings, numberCardColor: '#239bd0' }).numberCardColor, '#239bd0');
  for (const numberCardColor of ['red', '#fff', null, 123]) assert.equal(parseSettings({ ...defaultSettings, numberCardColor }), null);
  assert.deepEqual(parseSettings({ ...defaultSettings, tilt: 45, overlap: 0.9, scale: 0.5, curve: 3, opponentCurve: 1.6, layout: 'line' }), defaultSettings);
  for (const value of [null, {}, { ...defaultSettings, viewer: 8 }, { ...defaultSettings, angle: NaN },
    { ...defaultSettings, counts: Array(12).fill(1001) }, { ...defaultSettings, players: 4.5 },
    { ...defaultSettings, shadows: 'sim' }, { ...defaultSettings, exposure: NaN }, { ...defaultSettings, deckX: Infinity }]) assert.equal(parseSettings(value), null);
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
          assert.ok(seat.position[2] < seats[0].position[2]);
          // At least 79% of the face width remains visible instead of a side-on hand.
          assert.ok(Math.cos(seat.angle) > 0.79);
        }
      });
    }
    const layout = resolveTableLayout({ players, viewer: 0, counts: Array(players).fill(7), width: 1200, height: 700, angle: 36, deck: [-1.5, 0.035, -0.6] });
    assert.ok(layout.hands[0].scale > layout.hands[1].scale);
  }
  const seats = seatPlacements(4, 0, 4, 3.2, 5.5);
  const right = worldHandPose({ position: [1, 0, 0], rotation: [0, 0, 0], scale: 1 }, seats[1]);
  const left = worldHandPose({ position: [1, 0, 0], rotation: [0, 0, 0], scale: 1 }, seats[3]);
  assert.ok(right.position[0] > seats[1].position[0] && right.position[2] > seats[1].position[2]);
  assert.ok(left.position[0] > seats[3].position[0] && left.position[2] < seats[3].position[2]);
});

test('arco adversário é espacial e mantém as cartas verticais, enquanto o leque local se adapta à quantidade', () => {
  for (const count of [1, 2, 7, 20, 50]) {
    const layout = resolveTableLayout({ players: 4, viewer: 0, counts: Array(4).fill(count), width: 1200, height: 700, angle: 36, deck: [-1.5, 0.035, -0.6] });
    const opponent = layout.hands[1];
    const visible = adaptiveHandWindow(count, opponent, 0, false);
    const cards = handPlacements(visible.length, opponent);
    assert.ok(cards.every(card => card.rotation[2] === 0));
    assert.ok(cards.every(card => card.position[1] === cards[0].position[1]));
    assert.ok(cards.every(card => Math.abs(card.rotation[0]) <= 8 * Math.PI / 180));
    assert.equal(layout.hands[0].spatialCurve, 0);
    if (count === 1) assert.equal(layout.hands[0].curve, 0);
    if (count > 1) assert.ok(cards[0].rotation[1] < 0 && cards.at(-1).rotation[1] > 0);
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
      if (Math.abs(Math.abs(y) - 0.525) < 1e-6) assert.ok(Math.abs(z) < 1e-6);
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
  assert.equal(migrated.deckX, legacy.deckX);
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
    const fit = fitCamera(sceneBounds(seats, seats.map(seat => ({ ...options, width: seat.width, tilt: angle })), Array(12).fill(1000)), aspect, angle);
    const seat = foregroundSeat(seats[0], fit, { ...options, tilt: angle }, angle);
    const pose = worldHandPose(handPlacements(1, { ...options, tilt: angle })[0], seat);
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


test('deck fica horizontal e descarte apresenta a face para a câmera sem torções fortes', () => {
  const cards = Array.from({ length: 24 }, (_, i) => ({ id: `pile:${i}`, value: i % 10 }));
  const deck = TablePile({ cards, position: [0, 0, 0], height: 0.004, faceUp: false });
  assert.ok(deck.every(card => Math.abs(card.pose.rotation[2] - Math.PI / 2) < 1e-9));
  for (const angle of [25, 36, 65]) {
    const pile = TablePile({ cards, position: [0.85, 0.6, 0.15], height: 0.004, faceUp: true, rotation: pileRotation(true, angle) });
    const towardCamera = new Vector3(0, Math.sin(angle * Math.PI / 180), Math.cos(angle * Math.PI / 180));
    for (const card of pile) {
      const normal = new Vector3(0, 0, 1).applyEuler(new Euler(...card.pose.rotation, 'YXZ'));
      assert.ok(normal.dot(towardCamera) > 0.999);
      assert.ok(Math.abs(card.pose.rotation[2]) <= 0.025);
    }
  }
});


test('cantos seguem arcos de círculo amostrados e UVs preservam as proporções', () => {
  const geometry = createCardGeometry(0.018);
  try {
    const positions = geometry.face.getAttribute('position'), uv = geometry.face.getAttribute('uv');
    const seen = [new Set(), new Set(), new Set(), new Set()];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i);
      assert.ok(Math.abs(uv.getX(i) - (x / 0.72 + 0.5)) < 1e-6);
      assert.ok(Math.abs(uv.getY(i) - (y / 1.05 + 0.5)) < 1e-6);
      const dx = Math.abs(x) - 0.3, dy = Math.abs(y) - 0.465;
      if (dx > 1e-5 && dy > 1e-5 && Math.abs(dx * dx + dy * dy - 0.06 ** 2) < 1e-7) {
        seen[(x > 0 ? 1 : 0) + (y > 0 ? 2 : 0)].add(y);
      }
    }
    assert.ok(seen.every(corner => corner.size >= 10), 'cada canto precisa de um arco, não um chanfro');
  } finally { for (const mesh of Object.values(geometry)) mesh.dispose(); }
});

test('posição e rotação do deck são persistidas sem recuperar ajustes manuais antigos', () => {
  const configured = { ...defaultSettings, deckX: -3, deckZ: -2.6, deckRotation: -25, deckScale: 1.4 };
  assert.deepEqual(parseSettings(configured), configured);
  const legacy = { ...defaultSettings };
  for (const key of ['deckX', 'deckZ', 'deckRotation', 'deckScale']) delete legacy[key];
  const parsed = parseSettings(legacy);
  for (const key of ['deckX', 'deckZ', 'deckRotation', 'deckScale']) assert.equal(parsed[key], defaultSettings[key]);
  for (const change of [{ deckX: NaN }, { deckZ: -101 }, { deckRotation: 181 }, { deckScale: 0.64 }, { deckScale: 1.81 }]) {
    assert.equal(parseSettings({ ...defaultSettings, ...change }), null);
  }
});

test('regras automáticas respondem a cartas, participantes e viewport sem recuperar ajustes manuais', () => {
  const request = { players: 4, viewer: 0, width: 1200, height: 700, angle: 36, deck: [-1.5, 0.035, -0.6] };
  const one = resolveTableLayout({ ...request, counts: Array(4).fill(1) });
  const seven = resolveTableLayout({ ...request, counts: Array(4).fill(7) });
  const fifty = resolveTableLayout({ ...request, counts: Array(4).fill(50) });
  assert.equal(one.hands[0].curve, 0);
  assert.ok(seven.hands[0].curve > one.hands[0].curve);
  assert.ok(fifty.hands[0].scale < seven.hands[0].scale);
  assert.ok(fifty.hands[0].overlap >= seven.hands[0].overlap);
  assert.deepEqual(one.fit, fifty.fit, 'comprar e descartar não deve disparar zoom de câmera');
  const mobile = resolveTableLayout({ ...request, width: 390, counts: Array(4).fill(50) });
  assert.ok(mobile.hands[0].visibleLimit < fifty.hands[0].visibleLimit);
  for (const players of [2, 3, 4, 6, 8, 12]) for (const count of [0, 1, 7, 50, 1000]) {
    for (const width of [390, 1200, 1800]) {
      const layout = resolveTableLayout({ ...request, players, width, counts: Array(players).fill(count) });
      assert.equal(layout.hands.length, players);
      assert.ok(layout.hands[0].scale >= 1.15);
      assert.ok(layout.hands[0].scale > layout.hands[1].scale);
      layout.hands.forEach((hand, place) => {
        const window = adaptiveHandWindow(count, hand, 999, place === 0);
        assert.ok(window.start >= 0 && window.start + window.length <= count);
        assert.ok(window.length <= hand.visibleLimit);
        const poses = handPlacements(window.length, hand);
        assert.ok(poses.every(pose => [...pose.position, ...pose.rotation, pose.scale].every(Number.isFinite)));
        if (poses.length > 1) assert.ok(poses.at(-1).position[0] - poses[0].position[0] <= hand.width + 1e-8);
      });
    }
  }
});

test('a partir de seis jogadores as laterais abrem para as bordas com espaços equilibrados', () => {
  for (const players of [6, 7, 8, 12]) for (const width of [390, 1200, 1800]) {
    const layout = resolveTableLayout({ players, viewer: 0, counts: Array(players).fill(7), width, height: 700, angle: 36, deck: [-1.5, 0.035, -0.6] });
    const opponents = layout.seats.slice(1), maxX = Math.max(...opponents.map(seat => Math.abs(seat.position[0])));
    assert.equal(opponents[0].position[0], maxX);
    assert.equal(opponents.at(-1).position[0], -maxX);
    const gaps = opponents.slice(1).map((seat, i) => Math.hypot(seat.position[0] - opponents[i].position[0], (seat.position[2] - opponents[i].position[2]) * Math.sin(36 * Math.PI / 180)));
    assert.ok(Math.max(...gaps) / Math.min(...gaps) < 1.4);
    const camera = new OrthographicCamera(layout.fit.left, layout.fit.right, layout.fit.top, layout.fit.bottom, 0.1, 250);
    camera.position.fromArray(layout.fit.position); camera.lookAt(...layout.fit.target); camera.updateMatrixWorld();
    const rectangles = opponents.map((seat, index) => {
      const options = layout.hands[index + 1], window = adaptiveHandWindow(7, options, 0, false);
      const points = handPlacements(window.length, options).flatMap(pose => {
        const world = worldHandPose(pose, seat);
        return [-0.36, 0.36].flatMap(x => [-0.525, 0.525].map(y => new Vector3(x * world.scale, y * world.scale, 0)
          .applyEuler(new Euler(...world.rotation, 'YXZ')).add(new Vector3(...world.position)).project(camera)));
      });
      assert.ok(points.every(point => Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1));
      return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), bottom: Math.min(...points.map(p => p.y)), top: Math.max(...points.map(p => p.y)) };
    });
    for (let i = 1; i < rectangles.length; i++) {
      const a = rectangles[i - 1], b = rectangles[i];
      assert.ok(Math.min(a.right, b.right) <= Math.max(a.left, b.left) || Math.min(a.top, b.top) <= Math.max(a.bottom, b.bottom), 'mãos vizinhas precisam ficar separadas');
    }
  }
});


test('arraste mantém pilha girada e controles inteiros dentro do viewport sem mover a câmera', () => {
  for (const players of [2, 6, 12]) for (const width of [360, 1200, 1800]) for (const angle of [25, 36, 65]) {
    const request = { players, viewer: 0, counts: Array(players).fill(7), width, height: 700, angle, deck: [-1.5, 0.035, -0.6] };
    const layout = resolveTableLayout(request);
    const camera = new OrthographicCamera(layout.fit.left, layout.fit.right, layout.fit.top, layout.fit.bottom, 0.1, 250);
    camera.position.fromArray(layout.fit.position); camera.lookAt(...layout.fit.target); camera.updateMatrixWorld();
    for (const rotation of [-90, -25, 0, 45, 180]) {
      const viewport = { fit: layout.fit, angle, width, height: 700, rotation };
      for (const x of [-1e4, 0, 1e4]) for (const z of [-1e4, 0, 1e4]) {
        const point = constrainDeckPosition({ x, z }, viewport);
        for (const dx of [-0.525, 0.525]) for (const dz of [-0.36, 0.36]) for (const y of [0.033, 0.64]) {
          const projected = new Vector3(dx, 0, dz).applyAxisAngle(new Vector3(0, 1, 0), rotation * Math.PI / 180)
            .add(new Vector3(point.x, y, point.z)).project(camera);
          assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1);
        }
        const label = new Vector3(point.x, 0.06, point.z + 0.95).project(camera);
        assert.ok(Math.abs(label.x) + 60 / width < 1);
        assert.ok(Math.abs(label.y) + 40 / 700 < 1);
      }
    }
    const elsewhere = resolveTableLayout({ ...request, deck: [50, 0.035, 50] });
    assert.deepEqual(elsewhere.fit, layout.fit, 'o enquadramento não deve perseguir o deck');
    const viewport = { fit: layout.fit, angle, width, height: 700, rotation: -18 };
    const moved = moveDeckByPixels({ x: 0, z: 0 }, 30, 40, viewport);
    const start = new Vector3(0, 0.5, 0).project(camera), end = new Vector3(moved.x, 0.5, moved.z).project(camera);
    assert.ok(Math.abs((end.x - start.x) * width / 2 - 30) < 1e-8);
    assert.ok(Math.abs((start.y - end.y) * 700 / 2 - 40) < 1e-8);
  }
});


test('descarte permanece central e separado de mãos, identificações e deck ao mover, girar e crescer', () => {
  for (const players of [2, 4, 6, 12]) for (const width of [360, 1200, 1800]) for (const height of [512, 700, 900]) {
    for (const angle of [25, 36, 65]) {
      const request = { players, viewer: 0, counts: Array(players).fill(7), width, height, angle, deck: [0, 0.035, 0.15] };
      const layout = resolveTableLayout(request), viewport = { fit: layout.fit, angle, width, height };
      for (const x of [-100, 0, 100]) for (const z of [-100, 0, 100]) for (const rotation of [-45, 0, 90]) {
        const transform = constrainDiscardTransform({ x, z, rotation, scale: 1.8 }, viewport, layout.obstacles);
        const box = pileBounds(transform, 'discard', viewport);
        assert.ok(transform.scale >= 0.65 && transform.scale <= 1.8);
        assert.ok(box.left >= width * 0.24 - 1e-6 && box.right <= width * 0.76 + 1e-6);
        assert.ok(box.top >= height * 0.27 - 1e-6 && box.bottom <= height * 0.8 + 1e-6);
        assert.ok(layout.obstacles.every(o => box.right <= o.left || box.left >= o.right || box.bottom <= o.top || box.top >= o.bottom));
      }
    }
  }
  const settings = { ...defaultSettings, discardX: 1, discardZ: -1, discardRotation: 35, discardScale: 1.5 };
  assert.deepEqual(parseSettings(settings), settings);
  assert.equal(parseSettings({ ...settings, discardScale: 2 }), null);
});


test('arco aproveita largura e altura em telas largas sem distorcer cartas nem reagir à compra', () => {
  for (const players of [3, 4, 6, 8, 12]) for (const angle of [25, 36, 65]) {
    const request = { players, viewer: 0, counts: Array(players).fill(7), height: 550, angle, deck: [-1.5, 0.035, -0.6] };
    let previousX = 0;
    for (const width of [1800, 2560, 3440]) {
      const layout = resolveTableLayout({ ...request, width });
      const outerX = Math.max(...layout.seats.map(seat => Math.abs(seat.position[0])));
      assert.ok(outerX > previousX, 'assentos devem continuar abrindo quando a largura aumenta');
      assert.ok(outerX / layout.fit.right > 0.6, 'laterais não devem se concentrar no centro');
      assert.ok(layout.bounds.every(([x]) => Math.abs(x) < layout.fit.right), 'preservar margens das mãos e identificações');
      assert.equal(layout.hands[0].scale, 1.5 - Math.min(0.12, Math.max(0, players - 4) * 0.015));
      const bought = resolveTableLayout({ ...request, width, counts: request.counts.map(count => count + 1) });
      assert.deepEqual(bought.fit, layout.fit);
      assert.deepEqual(bought.seats, layout.seats);
      previousX = outerX;
    }
    const tall = resolveTableLayout({ ...request, width: 2560, height: 900 });
    const short = resolveTableLayout({ ...request, width: 2560 });
    assert.ok(Math.max(...short.seats.map(seat => Math.abs(seat.position[0]))) > Math.max(...tall.seats.map(seat => Math.abs(seat.position[0]))), 'altura também deve influenciar a disposição');
  }
});


test('escala do deck mantém a pilha girada e os controles no enquadramento e atualiza o obstáculo do descarte', () => {
  for (const width of [360, 1200, 2400]) for (const scale of [0.65, 1, 1.8]) for (const rotation of [-90, -18, 45]) {
    const request = { players: 4, viewer: 0, counts: [2,2,2,2], width, height: 700, angle: 36, deck: [500,0.035,500], deckRotation: rotation, deckScale: scale };
    const layout = resolveTableLayout(request);
    const viewport = { fit: layout.fit, angle: 36, width, height: 700 };
    const t = constrainDeckTransform({ x: 500, z: 500, rotation, scale }, viewport);
    assert.equal(t.scale, scale);
    assert.equal(t.x, layout.deckPosition[0]); assert.equal(t.z, layout.deckPosition[2]);
    const box = pileBounds(t, 'deck', viewport);
    assert.ok(box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= 700);
    assert.deepEqual(layout.obstacles.at(-2), box);
    const fixed = resolveTableLayout({ ...request, deckScale: 1 });
    assert.deepEqual(layout.fit, fixed.fit, 'a escala do deck não deve alterar a câmera');
  }
});

test('tamanho das mãos usa multiplicadores independentes sobre o solver automático, com câmera estável', () => {
  for (const width of [360, 1200, 2400]) for (const players of [2, 6, 12]) for (const count of [1, 7, 50, 1000]) {
    const request = { players, viewer: players - 1, counts: Array(players).fill(count), width, height: 700, angle: 36, deck: [-1.5, 0.035, -0.6] };
    const base = resolveTableLayout(request);
    assert.deepEqual(resolveTableLayout({ ...request, localCardScale: 1, opponentCardScale: 1 }), base);
    const local = resolveTableLayout({ ...request, localCardScale: 1.25 });
    const opponents = resolveTableLayout({ ...request, opponentCardScale: 0.75 });
    assert.ok(Math.abs(local.hands[0].scale / base.hands[0].scale - 1.25) < 1e-10);
    assert.equal(opponents.hands[0].scale, base.hands[0].scale);
    for (let place = 1; place < players; place++) {
      assert.equal(local.hands[place].scale, base.hands[place].scale);
      assert.ok(Math.abs(opponents.hands[place].scale / base.hands[place].scale - 0.75) < 1e-10);
    }
    assert.deepEqual(local.fit, base.fit); assert.deepEqual(opponents.fit, base.fit);
    assert.ok(local.hands[0].width <= base.hands[0].width);
    const window = adaptiveHandWindow(count, local.hands[0], count - 1);
    assert.ok(window.length > 0 && window.start + window.length <= count);
  }
});

test('presets migram e validam multiplicadores das cartas sem recuperar dimensões fixas', () => {
  const legacy = { ...defaultSettings }; delete legacy.localCardScale; delete legacy.opponentCardScale;
  assert.equal(parseSettings(legacy).localCardScale, 1); assert.equal(parseSettings(legacy).opponentCardScale, 1);
  const next = { ...defaultSettings, localCardScale: 1.25, opponentCardScale: 0.75 };
  assert.deepEqual(parseSettings(JSON.parse(JSON.stringify(next))), next);
  for (const key of ['localCardScale', 'opponentCardScale']) for (const value of [NaN, Infinity, 0.49, 1.51, '1.25']) assert.equal(parseSettings({ ...defaultSettings, [key]: value }), null);
});


test('mãos extensas ocupam 90% da largura projetada com margens e paginação adaptativa', () => {
  for (const [width, count] of [[390, 50], [1200, 21], [1418, 21], [2400, 50]]) {
    const request = { players: 4, viewer: 0, counts: [count,7,7,7], width, height: 700, angle: 36, deck: [-1.5,0.035,-0.6] };
    const layout = resolveTableLayout(request);
    const visible = adaptiveHandWindow(count, layout.hands[0], count - 1);
    const boxes = handPlacements(visible.length, layout.hands[0]).map(pose => poseBounds(worldHandPose(pose, layout.localSeat), { fit: layout.fit, width, height: 700, angle: 36 }));
    const left = Math.min(...boxes.map(box => box.left)), right = Math.max(...boxes.map(box => box.right));
    const coverage = (right - left) / width;
    assert.ok(coverage >= 0.88 && coverage <= 0.901, `cobertura de ${coverage} para ${width}px`);
    assert.ok(left >= width * 0.049 && right <= width * 0.951);
    assert.deepEqual(layout.fit, resolveTableLayout({ ...request, counts: [1,7,7,7] }).fit);
  }
});


test('paginar e passar o mouse não repetem a compra; a mesma carta ainda anima em uma nova transferência', () => {
  let state = initialState(defaultSettings);
  const history = new Map();
  const id = state.deck.at(-1).id;
  state = laboratoryReducer(state, { type: 'draw', seat: 0 });
  const key = `${state.motions[id].serial}:${state.motions[id].kind}`;
  assert.equal(consumeCardMotion(history, id, key), true, 'primeira compra deve animar');
  assert.equal(consumeCardMotion(history, id, key), false, 'hover não é uma nova compra');
  // React removes off-page cards; the table, which stays mounted, owns this history.
  assert.equal(consumeCardMotion(history, id, key), false, 'remontar na paginação não deve voltar ao deck');
  state = laboratoryReducer(state, { type: 'discard', seat: 0, id });
  const discard = `${state.motions[id].serial}:${state.motions[id].kind}`;
  assert.equal(consumeCardMotion(history, id, discard), true, 'uma nova ação real continua animando');
  assert.equal(consumeCardMotion(history, id, discard), false);
  assert.equal(consumeCardMotion(history, 'initial', 'layout'), false);
  const unseen = new Map([[id, discard]]);
  assert.equal(consumeCardMotion(unseen, id, discard), false, 'ações fora da janela não são reproduzidas ao paginar');
});


test('curvatura local multiplica o leque automático sem afetar o tamanho, câmera ou oponentes', () => {
  const request = { players: 4, viewer: 2, counts: [7,7,21,7], width: 1200, height: 700, angle: 36, deck: [-1.5,0.035,-0.6] };
  const base = resolveTableLayout(request);
  for (const multiplier of [0, 0.5, 1, 2]) {
    const layout = resolveTableLayout({ ...request, localHandCurve: multiplier });
    assert.equal(layout.hands[0].curve, base.hands[0].curve * multiplier);
    assert.equal(layout.hands[0].scale, base.hands[0].scale);
    assert.deepEqual(layout.hands.slice(1), base.hands.slice(1));
    assert.deepEqual(layout.fit, base.fit);
    const visible = adaptiveHandWindow(21, layout.hands[0]);
    const poses = handPlacements(visible.length, layout.hands[0]);
    if (multiplier === 0) assert.ok(poses.every(pose => pose.rotation[2] === 0));
    const boxes = poses.map(pose => poseBounds(worldHandPose(pose, layout.localSeat), { fit: layout.fit, width: 1200, height: 700, angle: 36 }));
    assert.ok(Math.min(...boxes.map(box => box.left)) >= 1200 * 0.049);
    assert.ok(Math.max(...boxes.map(box => box.right)) <= 1200 * 0.951);
  }
});

test('presets antigos mantêm curvatura padrão e validam os limites do multiplicador', () => {
  const legacy = { ...defaultSettings }; delete legacy.localHandCurve;
  assert.equal(parseSettings(legacy).localHandCurve, 1);
  for (const value of [0, 0.5, 1, 2]) assert.equal(parseSettings({ ...defaultSettings, localHandCurve: value }).localHandCurve, value);
  for (const value of [-0.01, 2.01, NaN, Infinity, '1']) assert.equal(parseSettings({ ...defaultSettings, localHandCurve: value }), null);
});


test('hover desloca a carta no plano do leque mantendo a profundidade e a ordem da mão', () => {
  for (const angle of [25, 36, 65]) {
    const layout = resolveTableLayout({ players: 4, viewer: 0, counts: [21,7,7,7], width: 1200, height: 700, angle, deck: [-1.5,0.035,-0.6] });
    const window = adaptiveHandWindow(21, layout.hands[0]);
    const poses = handPlacements(window.length, layout.hands[0]).map(pose => worldHandPose(pose, layout.localSeat));
    const normal = new Vector3(0, Math.sin(angle * Math.PI / 180), Math.cos(angle * Math.PI / 180));
    for (const pose of poses) {
      const base = new Vector3(...pose.position), hovered = new Vector3(...raisedCardPosition(pose, 0.25 * pose.scale));
      assert.ok(Math.abs(hovered.dot(normal) - base.dot(normal)) < 1e-10);
      const up = new Vector3(0, Math.cos(angle * Math.PI / 180), -Math.sin(angle * Math.PI / 180));
      assert.ok(hovered.sub(base).dot(up) > 0);
      assert.deepEqual(raisedCardPosition(pose, 0), pose.position);
    }
  }
});

test('distribuir começa por quem está na vez e percorre os assentos a cada volta com stagger crescente', () => {
  for (const startSeat of [0, 1, 3]) {
    const before = initialState(defaultSettings);
    const after = laboratoryReducer(before, { type: 'deal', players: 4, count: 3, startSeat });
    assert.equal(after.cue.ids[0], before.deck.at(-1).id);
    const owners = after.cue.ids.map(id => after.hands.findIndex(hand => hand.some(card => card.id === id)));
    assert.deepEqual(owners, Array.from({ length: 12 }, (_, i) => (startSeat + i) % 4));
    after.cue.ids.forEach((id, i) => {
      assert.equal(after.motions[id].order, i);
      if (i) assert.ok(distributionDelay(i, 0.65) > distributionDelay(i - 1, 0.65));
    });
    assert.deepEqual(identities(after), identities(before));
  }
  assert.equal(distributionDelay(0, 0.65), 0);
  assert.ok(distributionDelay(30, 0.65) > distributionDelay(29, 0.65), 'o fim da distribuição não deve sair todo junto');
  assert.equal(distributionDelay(3, 1), distributionDelay(3, 0.5) * 2);
});


test('distribuição preserva saídas em ordem com intervalo curto e voos sobrepostos em todas as voltas', () => {
  for (const duration of [0.15, 0.65, 2]) for (let order = 0; order < 103; order++) {
    const departure = distributionDelay(order, duration);
    const nextDeparture = distributionDelay(order + 1, duration);
    assert.ok(nextDeparture > departure && nextDeparture < departure + duration);
    const previousProgress = easedProgress(nextDeparture, duration, departure);
    assert.ok(previousProgress > 0 && previousProgress < 1);
    assert.equal(easedProgress(nextDeparture, duration, nextDeparture), 0);
  }
});

test('repetir o efeito ou mudar o layout não remove o atraso de uma transferência ativa', () => {
  const running = { destination: 'hand:original', key: '1:deal', active: true, transfer: true };
  assert.equal(cardMotionUpdate(running, { destination: 'hand:original', key: '1:deal', reducedMotion: false }), 'ignore');
  assert.equal(cardMotionUpdate(running, { destination: 'hand:hover', key: '1:deal', reducedMotion: false }), 'continue');
  assert.equal(cardMotionUpdate(running, { destination: 'hand:resize', key: '1:deal', reducedMotion: false }), 'continue');
  assert.equal(cardMotionUpdate(running, { destination: 'discard', key: '2:discard', reducedMotion: false }), 'start');
  assert.equal(cardMotionUpdate(running, { destination: 'hand:reduce', key: '1:deal', reducedMotion: true }), 'start');
  assert.equal(cardMotionUpdate({ ...running, active: false }, { destination: 'hand:hover', key: '1:deal', reducedMotion: false }), 'start');
});
