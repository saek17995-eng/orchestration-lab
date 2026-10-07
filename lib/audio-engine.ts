import { InstrumentGroup, instruments } from "@/lib/orchestra-data";
import { NoteEvent } from "@/lib/musicxml";

type Voice = AudioScheduledSourceNode;

export class OrchestraAudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private voices = new Set<Voice>();
  private volume = .72;

  async resume() {
    this.ensureContext();
    if (this.context?.state === "suspended") await this.context.resume();
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .02);
  }

  stopAll() {
    for (const voice of this.voices) { try { voice.stop(); } catch { /* already stopped */ } }
    this.voices.clear();
  }

  play(event: NoteEvent, seconds: number) {
    this.ensureContext();
    const context = this.context;
    const destination = this.master;
    if (!context || !destination || context.state !== "running") return;
    const instrument = instruments.find((item) => item.id === event.instrumentId) ?? instruments[0];
    if (event.group === "percussion" && event.instrumentId === "percussion") {
      this.playNoise(event.velocity, destination);
      return;
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const panner = context.createStereoPanner();
    const now = context.currentTime;
    const duration = Math.max(.06, Math.min(8, seconds));
    const peak = Math.min(.045, .008 + event.velocity / 127 * .026);
    const attack = event.group === "strings" ? .055 : event.group === "brass" ? .025 : .015;
    oscillator.type = this.waveform(event.group);
    oscillator.frequency.setValueAtTime(440 * 2 ** ((event.midi - 69) / 12), now);
    if (event.group === "brass") oscillator.detune.setValueAtTime(-4, now);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(event.group === "strings" ? 2600 : event.group === "brass" ? 3400 : 5200, now);
    filter.Q.value = event.group === "woodwinds" ? 1.8 : .7;
    panner.pan.value = Math.max(-.85, Math.min(.85, instrument.position[0] / 5.5));
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + attack);
    gain.gain.setValueAtTime(peak, Math.max(now + attack, now + duration * .72));
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(filter).connect(gain).connect(panner).connect(destination);
    this.track(oscillator);
    oscillator.start(now);
    oscillator.stop(now + duration + .03);
  }

  private ensureContext() {
    if (this.context) return;
    this.context = new AudioContext({ latencyHint: "interactive" });
    this.master = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.master.gain.value = this.volume;
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 5;
    this.master.connect(this.compressor).connect(this.context.destination);
  }

  private waveform(group: InstrumentGroup): OscillatorType {
    if (group === "woodwinds") return "sine";
    if (group === "brass") return "sawtooth";
    if (group === "strings") return "triangle";
    return "sine";
  }

  private playNoise(velocity: number, destination: AudioNode) {
    const context = this.context!;
    const length = Math.floor(context.sampleRate * .12);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "bandpass"; filter.frequency.value = 1800; filter.Q.value = .8;
    gain.gain.value = Math.min(.04, velocity / 127 * .035);
    source.buffer = buffer; source.connect(filter).connect(gain).connect(destination);
    this.track(source); source.start();
  }

  private track(voice: Voice) {
    this.voices.add(voice);
    voice.addEventListener("ended", () => this.voices.delete(voice), { once: true });
  }
}
