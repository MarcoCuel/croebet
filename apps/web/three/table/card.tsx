"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, Quaternion, Vector3, type Group } from "three";
import type { CardResources } from "./resources";
import type { CardTarget } from "./motion";
import { arcPosition, easedProgress } from "./motion";

/** Kept under a single scene parent: changing owner/zone never remounts a moving card. */
export function TableCard({ target, resources, reducedMotion, onSelect }: {
  target: CardTarget; resources: CardResources; reducedMotion: boolean; onSelect: (id: string) => void;
}) {
  const ref = useRef<Group>(null); const invalidate = useThree(state => state.invalidate);
  const [hovered, setHovered] = useState(false);
  const animation = useRef({ elapsed: 0, active: false, from: new Vector3(), to: new Vector3(), fromQ: new Quaternion(), toQ: new Quaternion(),
    fromScale: 1, toScale: 1, duration: 0.65, delay: 0, arc: 0, shuffle: false, key: "" });
  const mounted = useRef(false);
  const raised = (target.interactive && hovered) || target.selected;
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
  return <group ref={ref}
    onClick={target.interactive ? event => { event.stopPropagation(); onSelect(target.id); } : undefined}
    onPointerOver={target.interactive ? event => { event.stopPropagation(); setHovered(true); } : undefined}
    onPointerOut={() => setHovered(false)}>
    <mesh geometry={resources.edge} position={[0, 0, -(thickness - 0.004) / 2]} scale={[1, 1, thickness / 0.004]} castShadow receiveShadow><meshStandardMaterial color="#d5d4cf" roughness={0.9} /></mesh>
    <mesh geometry={resources.face} position={[0, 0, 0.0022]} castShadow receiveShadow><meshStandardMaterial map={front} roughness={0.82} metalness={0} /></mesh>
    <mesh geometry={resources.face} position={[0, 0, -thickness + 0.0018]} rotation={[0, Math.PI, 0]} castShadow receiveShadow><meshStandardMaterial map={back} roughness={0.86} metalness={0} /></mesh>
  </group>;
}
