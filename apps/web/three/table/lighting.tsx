export function TableLighting({ ambient, intensity, shadows }: { ambient: number; intensity: number; shadows: boolean }) {
  return <>
    <ambientLight intensity={ambient} />
    <directionalLight position={[-3, 8, 3]} intensity={intensity} castShadow={shadows}
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12}
      shadow-camera-near={0.5} shadow-camera-far={30} shadow-normalBias={0.018} shadow-bias={-0.00015} shadow-radius={4} />
    <hemisphereLight intensity={0.35} />
  </>;
}
