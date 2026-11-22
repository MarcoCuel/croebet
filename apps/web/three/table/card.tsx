"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, Quaternion, Vector3, type Group, type MeshStandardMaterial } from "three";
import type { CardResources } from "./resources";
import type { CardTarget } from "./motion";
import { arcPosition, cardMotionUpdate, consumeCardMotion, easedProgress, routeProgress, raisedCardPosition } from "./motion";

/** Kept under a single scene parent: changing owner/zone never remounts a moving card. */
export function TableCard({ target, resources, motionHistory, reducedMotion, onSelect, onMenu, onPilePointerDown, onMotion, paused = false, timeScale = 1 }: {
  motionHistory: RefObject<Map<string, string>>;
  target: CardTarget; resources: CardResources; reducedMotion: boolean; onSelect: (id: string) => void; onMenu: (id: string, point: { x: number; y: number }) => void; onPilePointerDown?: (event: PointerEvent) => void;
  onMotion?: (id: string, key: string, active: boolean) => void;
  paused?: boolean; timeScale?: number;
}) {
  const ref = useRef<Group>(null); const invalidate = useThree(state => state.invalidate);
  const idleRef = useRef<Group>(null);
  const revealRef = useRef<Group>(null);
  const frontMaterial = useRef<MeshStandardMaterial>(null);
  const backMaterial = useRef<MeshStandardMaterial>(null);
  const reveal = useRef({ initialized: false, hidden: target.hidden, zone: target.zone,
    elapsed: 0, from: 0, to: 0, active: false });
  const face = resources.maps[target.face ?? target.value] ?? resources.maps.back;
  useLayoutEffect(() => {
    const group = revealRef.current; const front = frontMaterial.current; const back = backMaterial.current;
    if (!group || !front || !back) return;
    const a = reveal.current;
    const snap = !a.initialized || reducedMotion;
    if (snap || a.hidden !== target.hidden) {
      a.from = group.rotation.y; a.to = target.hidden ? Math.PI : 0;
      a.elapsed = a.zone !== target.zone ? -(target.motion.delay ?? 0) : 0;
      a.active = !snap && a.from !== a.to;
      if (snap) group.rotation.y = a.to;
    }
    a.initialized = true; a.hidden = target.hidden; a.zone = target.zone;
    // The authorized face stays on the far side during revelation. Keep it only
    // for the closing turn, then replace it with the back when it is out of view.
    if (!target.hidden || !a.active) {
      const artwork = target.hidden ? resources.maps.back : face;
      front.map = artwork;
      back.map = resources.maps.back;
    }
    invalidate();
  }, [target.hidden, target.zone, target.motion.delay, face, resources.maps.back, reducedMotion, invalidate]);
  const [hovered, setHovered] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const touchStart = useRef({ x: 0, y: 0 });
  const cancelHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null; };
  useEffect(() => () => { if (hold.current) clearTimeout(hold.current); }, []);
  useEffect(() => { if (!paused) invalidate(); }, [paused, invalidate]);
  useCursor(hovered && !!target.interactive, target.zone === "hand" ? "pointer" : "grab");
  const animation = useRef({ elapsed: 0, active: false, from: new Vector3(), to: new Vector3(), fromQ: new Quaternion(), toQ: new Quaternion(),
    fromScale: 1, toScale: 1, duration: 0.65, delay: 0, arc: 0, shuffle: false, raised: 0,
    key: "", destination: "", transfer: false, via: null as null | { position: Vector3; quaternion: Quaternion; scale: number }, hold: 0 });
  const motionCallback = useRef(onMotion);
  useLayoutEffect(() => { motionCallback.current = onMotion; });
  useEffect(() => () => motionCallback.current?.(target.id, animation.current.key, false), [target.id]);
  const mounted = useRef(false);
  const raised = Number(!!target.raised) + Number(!!((target.zone === "hand" && target.interactive && hovered) || target.selected));
  const [x, y, z] = target.pose.position; const [rx, ry, rz] = target.pose.rotation;
  const scale = target.pose.scale * (raised ? 1.1 : 1);
  // Depend only on actual destination/motion changes, never the containing snapshot object.
  const destination = `${x}:${y}:${z}:${rx}:${ry}:${rz}:${scale}:${raised}:${target.motion.key}:${reducedMotion}`;
  const latest = useRef({ target, raised, scale, reducedMotion });
  useLayoutEffect(() => { latest.current = { target, raised, scale, reducedMotion }; });
  useLayoutEffect(() => {
    const group = ref.current; if (!group) return;
    const { target: t, raised: lift, scale: size, reducedMotion: reduce } = latest.current;
    const a = animation.current;
    // Effect replay must not restart the same transfer without its original stagger.
    const update = cardMotionUpdate(a, { destination, key: t.motion.key, reducedMotion: reduce });
    if (update === "ignore") return;
    a.destination = destination;
    const newMotion = a.key !== t.motion.key && consumeCardMotion(motionHistory.current, t.id, t.motion.key);
    const returningChoice = a.key.startsWith("choice:") && !t.motion.key.startsWith("choice:");
    const emphasisChanged = a.raised !== lift;
    if (!mounted.current) {
      const origin = newMotion ? t.origin ?? t.pose : t.pose;
      group.position.fromArray(origin.position); group.quaternion.setFromEuler(new Euler(...origin.rotation, "YXZ")); group.scale.setScalar(origin.scale);
      mounted.current = true;
    }
    if (update === "continue") {
      // Resize, hover and other layout updates may retarget the destination, but
      // preserve elapsed time, departure delay, origin and arc for this transfer.
      a.to.fromArray(raisedCardPosition(t.pose, lift * 0.25 * t.pose.scale));
      a.toQ.setFromEuler(new Euler(...t.pose.rotation, "YXZ")); a.toScale = size;
      a.raised = lift;
      invalidate(); return;
    }
    if (a.active && a.key !== t.motion.key) motionCallback.current?.(t.id, a.key, false);
    a.from.copy(group.position); a.fromQ.copy(group.quaternion); a.fromScale = group.scale.x;
    a.to.fromArray(raisedCardPosition(t.pose, lift * 0.25 * t.pose.scale));
    a.toQ.setFromEuler(new Euler(...t.pose.rotation, "YXZ")); a.toScale = size;
    a.duration = emphasisChanged && !newMotion ? Math.min(t.motion.duration, 0.18) : t.motion.duration;
    a.raised = lift;
    a.delay = newMotion ? t.motion.delay ?? 0 : 0;
    a.arc = newMotion ? t.motion.arc : 0; a.shuffle = newMotion && !!t.motion.shuffle;
    a.key = t.motion.key;
    a.via = newMotion && t.motion.via ? { position: new Vector3(...t.motion.via.position), quaternion: new Quaternion().setFromEuler(new Euler(...t.motion.via.rotation, "YXZ")), scale: t.motion.via.scale } : null;
    a.hold = newMotion ? t.motion.hold ?? 0 : 0;
    a.transfer = returningChoice || newMotion && (!!t.origin || a.arc > 0 || a.delay > 0 || a.shuffle);
    a.elapsed = 0; a.active = !reduce;
    motionCallback.current?.(t.id, a.key, (newMotion || returningChoice) && !reduce);
    if (reduce) { group.position.copy(a.to); group.quaternion.copy(a.toQ); group.scale.setScalar(size); }
    invalidate();
  }, [destination, invalidate, motionHistory]);
  useFrame((scene, delta) => {
    const group = ref.current; const a = animation.current; if (!group || paused) return;
    const turn = reveal.current;
    if (turn.active && revealRef.current) {
      turn.elapsed += Math.min(delta, 0.1) * timeScale;
      const progress = easedProgress(turn.elapsed, Math.min(target.motion.duration, 0.4));
      revealRef.current.rotation.y = turn.from + (turn.to - turn.from) * progress;
      turn.active = progress < 1;
      if (!turn.active && turn.hidden) {
        if (frontMaterial.current) frontMaterial.current.map = resources.maps.back;
        if (backMaterial.current) backMaterial.current.map = resources.maps.back;
      }
      invalidate();
    }
    const idle = !target.hidden && !reducedMotion ? target.idle : undefined;
    if (idleRef.current) idleRef.current.rotation.z = idle ? Math.sin(scene.clock.elapsedTime * 2.6 + idle.phase) * idle.angle : 0;
    if (!a.active) { if (idle) invalidate(); return; }
    a.elapsed += Math.min(delta, 0.1) * timeScale;
    const route = routeProgress(a.elapsed, a.duration, a.delay, a.hold, !!a.via);
    const t = route.progress;
    const from = route.leg === 1 && a.via ? a.via.position : a.from;
    const to = route.leg === 0 && a.via ? a.via.position : a.to;
    const fromQ = route.leg === 1 && a.via ? a.via.quaternion : a.fromQ;
    const toQ = route.leg === 0 && a.via ? a.via.quaternion : a.toQ;
    const fromScale = route.leg === 1 && a.via ? a.via.scale : a.fromScale;
    const toScale = route.leg === 0 && a.via ? a.via.scale : a.toScale;
    group.position.fromArray(arcPosition(from.toArray(), to.toArray(), t, a.arc)); group.quaternion.slerpQuaternions(fromQ, toQ, t);
    group.scale.setScalar(fromScale + (toScale - fromScale) * t);
    if (a.shuffle) { group.position.x += Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI) * 0.4; group.rotateZ(Math.sin(t * Math.PI * 2) * 0.12); }
    a.active = !route.done;
    if (!a.active) motionCallback.current?.(target.id, a.key, false);
    if (a.active || idle) invalidate();
  });
  const thickness = target.thickness ?? 0.004;
  const geometry = target.curved === "fan" ? resources.fan : target.curved ? resources.curved : resources.flat;
  return <group ref={ref}
    onClick={target.interactive ? event => { event.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return; } onSelect(target.id); } : undefined}
    onContextMenu={target.interactive ? event => { event.stopPropagation(); event.nativeEvent.preventDefault(); event.nativeEvent.stopPropagation(); onMenu(target.id, { x: event.clientX, y: event.clientY }); } : undefined}
    onPointerDown={target.interactive ? event => {
      if (target.zone !== "hand" && onPilePointerDown) { event.stopPropagation(); onPilePointerDown(event.nativeEvent); return; }
      if (event.pointerType !== "touch") return;
      event.stopPropagation(); cancelHold(); suppressClick.current = false;
      const point = { x: event.clientX, y: event.clientY }; touchStart.current = point;
      hold.current = setTimeout(() => { hold.current = null; suppressClick.current = true; onMenu(target.id, point); }, 500);
    } : undefined}
    onPointerMove={event => { if (Math.hypot(event.clientX - touchStart.current.x, event.clientY - touchStart.current.y) > 12) cancelHold(); }}
    onPointerUp={cancelHold}
    onPointerCancel={cancelHold}
    onPointerOver={target.interactive ? event => { event.stopPropagation(); setHovered(true); } : undefined}
    onPointerOut={() => { setHovered(false); cancelHold(); }}>
    <group ref={idleRef}>
    <group ref={revealRef}>
    <mesh geometry={geometry.edge} position={[0, 0, -(thickness - 0.004) / 2]} scale={[1, 1, thickness / 0.004]} castShadow receiveShadow><meshStandardMaterial color="#d5d4cf" roughness={0.9} /></mesh>
    <mesh geometry={geometry.face} position={[0, 0, 0.0022]} castShadow receiveShadow><meshStandardMaterial ref={frontMaterial} map={resources.maps.back} alphaTest={0.1} emissive="#ffffff" emissiveIntensity={target.glow && !target.hidden ? 0.12 : hovered && target.zone === "deck" ? 0.08 : 0} roughness={0.82} metalness={0} /></mesh>
    <mesh geometry={geometry.backFace} position={[0, 0, -thickness + 0.0018]} rotation={[0, Math.PI, 0]} castShadow receiveShadow><meshStandardMaterial ref={backMaterial} map={resources.maps.back} alphaTest={0.1} roughness={0.86} metalness={0} /></mesh>
    </group>
    </group>
    {target.zone === "staging" && target.label && <Html position={[0, -0.95, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}><span className="block w-max max-w-48 rounded-lg bg-background/95 px-2 py-1 text-center text-xs text-foreground">{target.label}</span></Html>}
    {hovered && target.interactive && target.actionLabel && !target.hidden && <Html position={[0, 0.8, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}><span className="block w-max max-w-64 rounded-lg bg-background/95 px-2 py-1 text-center text-xs text-foreground">{target.actionLabel}</span></Html>}
    {target.interactive && target.zone === "hand" && <Html center zIndexRange={[12, 0]} style={{ pointerEvents: "none" }}><button
      className="pointer-events-auto sr-only focus:not-sr-only focus:whitespace-nowrap focus:rounded-lg focus:bg-background focus:p-2 focus:text-xs"
      aria-label={target.actionLabel ?? `Descartar ${target.label?.toLowerCase() ?? "carta"}`} onClick={() => onSelect(target.id)}
      onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}
      onContextMenu={event => { event.preventDefault(); onMenu(target.id, { x: event.clientX, y: event.clientY }); }}
      onKeyDown={event => { if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); onMenu(target.id, { x: bounds.left, y: bounds.bottom }); } }}
    >{target.actionLabel ?? "Descartar carta"}</button></Html>}
  </group>;
}
