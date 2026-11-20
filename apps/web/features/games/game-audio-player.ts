// Asset silence must not become a variable delay between a visual cue and its sound.
export function prepareAudioCue(buffer: AudioBuffer) {
  let peak = 0;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  for (const samples of channels) for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (!peak) return null;
  const threshold = peak * 0.04;
  let first = buffer.length;
  let last = -1;
  for (const samples of channels) {
    for (let index = 0; index < samples.length; index++) {
      if (Math.abs(samples[index]) < threshold) continue;
      first = Math.min(first, index);
      last = Math.max(last, index);
    }
  }
  const offset = Math.max(0, first / buffer.sampleRate - 0.004);
  const end = Math.min(buffer.duration, (last + 1) / buffer.sampleRate + 0.02);
  return { buffer, offset, duration: end - offset };
}

export function createGameAudioPlayer(context: AudioContext, destination: AudioNode) {
  const sources = new Set<AudioBufferSourceNode>();
  function stop() {
    for (const source of sources) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    sources.clear();
  }
  function play(cue: ReturnType<typeof prepareAudioCue>) {
    if (!cue || context.state !== "running") return;
    const source = context.createBufferSource();
    source.buffer = cue.buffer;
    source.connect(destination);
    sources.add(source);
    source.onended = () => { sources.delete(source); source.disconnect(); };
    source.start(0, cue.offset, cue.duration);
  }
  return { play, stop };
}
