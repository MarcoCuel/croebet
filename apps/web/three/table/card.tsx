"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, Quaternion, Vector3, type Group } from "three";
import type { CardResources } from "./resources";
import type { CardTarget } from "./motion";
import { arcPosition, easedProgress } from "./motion";

/** Kept under a single scene parent: changing owner/zone never remounts a moving card. */
export function TableCard({ target, resources, reducedMotion, onSelect, onMenu }: {
  target: CardTarget; resources: CardResources; reducedMotion: boolean; onSelect: (id: string) => void; onMenu: (id: string, point: { x: number; y: number }) => void;
}) {
  const ref = useRef<Group>(null); const invalidate = useThree(state => state.invalidate);
  const [hovered, setHovered] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const touchStart = useRef({ x: 0, y: 0 });
  const cancelHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null; };
  useEffect(() => () => { if (hold.current) clearTimeout(hold.current); }, []);
  useCursor(hovered && !!target.interactive);
  const animation = useRef({ elapsed: 0, active: false, from: new Vector3(), to: new Vector3(), fromQ: new Quaternion(), toQ: new Quaternion(),
    fromScale: 1, toScale: 1, duration: 0.65, delay: 0, arc: 0, shuffle: false, key: "" });
  const mounted = useRef(false);
  const raised = (target.zone !== "deck" && target.interactive && hovered) || target.selected;
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
    if (!mounted.current) {
      const origin = t.origin ?? t.pose;
      group.position.fromArray(origin.position); group.quaternion.setFromEuler(new Euler(...origin.rotation, "YXZ")); group.scale.setScalar(origin.scale);
      mounted.current = true;
    }
    a.from.copy(group.position); a.fromQ.copy(group.quaternion); a.fromScale = group.scale.x;
    a.to.fromArray(t.pose.position); a.to.y += lift ? 0.25 * t.pose.scale : 0;
    a.toQ.setFromEuler(new Euler(...t.pose.rotation, "YXZ")); a.toScale = size;
    const newMotion = a.key !== t.motion.key;
    a.duration = lift && !newMotion ? Math.min(t.motion.duration, 0.22) : t.motion.duration;
    a.delay = newMotion ? t.motion.delay ?? 0 : 0;
    a.arc = newMotion ? t.motion.arc : 0; a.shuffle = newMotion && !!t.motion.shuffle;
    a.key = t.motion.key;
    a.elapsed = 0; a.active = !reduce;
    if (reduce) { group.position.copy(a.to); group.quaternion.copy(a.toQ); group.scale.setScalar(size); }
    invalidate();
  }, [destination, invalidate]);
  useFrame((_, delta) => {
    const group = ref.current; const a = animation.current; if (!group || !a.active) return;
    a.elapsed += Math.min(delta, 0.1);
    const t = easedProgress(a.elapsed, a.duration, a.delay);
    const position = arcPosition(a.from.toArray(), a.to.toArray(), t, a.arc);
    group.position.fromArray(position); group.quaternion.slerpQuaternions(a.fromQ, a.toQ, t);
    group.scale.setScalar(a.fromScale + (a.toScale - a.fromScale) * t);
    if (a.shuffle) { group.position.x += Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI) * 0.4; group.rotateZ(Math.sin(t * Math.PI * 2) * 0.12); }
    a.active = t < 1;
    if (a.active) invalidate();
  });
  const front = target.hidden ? resources.maps[10] : resources.maps[target.value];
  const back = target.revealBack ? front : resources.maps[10];
  const thickness = target.thickness ?? 0.004;
  const geometry = target.curved ? resources.curved : resources.flat;
  return <group ref={ref}
    onClick={target.interactive ? event => { event.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return; } onSelect(target.id); } : undefined}
    onContextMenu={target.interactive ? event => { event.stopPropagation(); event.nativeEvent.preventDefault(); event.nativeEvent.stopPropagation(); onMenu(target.id, { x: event.clientX, y: event.clientY }); } : undefined}
    onPointerDown={target.interactive ? event => {
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
    <mesh geometry={geometry.edge} position={[0, 0, -(thickness - 0.004) / 2]} scale={[1, 1, thickness / 0.004]} castShadow receiveShadow><meshStandardMaterial color="#d5d4cf" roughness={0.9} /></mesh>
    <mesh geometry={geometry.face} position={[0, 0, 0.0022]} castShadow receiveShadow><meshStandardMaterial map={front} emissive="#ffffff" emissiveIntensity={hovered && target.zone === "deck" ? 0.08 : 0} roughness={0.82} metalness={0} /></mesh>
    <mesh geometry={geometry.backFace} position={[0, 0, -thickness + 0.0018]} rotation={[0, Math.PI, 0]} castShadow receiveShadow><meshStandardMaterial map={back} roughness={0.86} metalness={0} /></mesh>
    {target.interactive && target.zone === "hand" && <Html center zIndexRange={[12, 0]} style={{ pointerEvents: "none" }}><button
      className="pointer-events-auto sr-only focus:not-sr-only focus:whitespace-nowrap focus:rounded-lg focus:bg-background focus:p-2 focus:text-xs"
      aria-label={`Descartar ${target.label?.toLowerCase() ?? "carta"}`} onClick={() => onSelect(target.id)}
      onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}
      onContextMenu={event => { event.preventDefault(); onMenu(target.id, { x: event.clientX, y: event.clientY }); }}
      onKeyDown={event => { if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); onMenu(target.id, { x: bounds.left, y: bounds.bottom }); } }}
    >Descartar carta</button></Html>}
  </group>;
}
