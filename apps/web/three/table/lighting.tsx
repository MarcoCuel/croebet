export function TableLighting({ ambient, intensity, pointIntensity, pointHeight, deckHeight, shadows, softness, opacity }: {
  ambient: number; intensity: number; pointIntensity: number; pointHeight: number; deckHeight: number;
  shadows: boolean; softness: number; opacity: number;
}) {
  return <>
    <ambientLight intensity={ambient} />
    <hemisphereLight intensity={0.4} />
    <directionalLight position={[0, 10, 0]} intensity={intensity} castShadow={shadows}
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12}
      shadow-camera-near={0.5} shadow-camera-far={30} shadow-normalBias={0.002} shadow-bias={-0.0001}
      shadow-radius={softness} shadow-blurSamples={16} shadow-intensity={opacity} />
    <pointLight position={[-0.85, deckHeight + pointHeight, -0.15]} intensity={pointIntensity} distance={10} decay={2} />
  </>;
}
