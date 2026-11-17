export function StudioLighting() {
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 4, 5]} intensity={3} />
      <directionalLight position={[-3, 1, -2]} intensity={1} />
    </>
  );
}
