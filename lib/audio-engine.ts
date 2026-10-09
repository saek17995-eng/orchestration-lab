import { Soundfont, type Smplr, type StopFn } from "smplr";
import { InstrumentGroup, instruments } from "@/lib/orchestra-data";
import { NoteEvent } from "@/lib/musicxml";

type Voice = AudioScheduledSourceNode;
export type AudioMode = "samples" | "synth";

const soundfontNames: Record<string, string> = {
  flute: "flute", oboe: "oboe", clarinet: "clarinet", bassoon: "bassoon",
  horn: "french_horn", trumpet: "trumpet", trombone: "trombone", tuba: "tuba",
  timpani: "timpani", percussion: "orchestra_hit", violin1: "violin", violin2: "violin",
  harp: "orchestral_harp",
  viola: "viola", cello: "cello", bass: "contrabass",
};

export class OrchestraAudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private voices = new Set<Voice>();
  private sampleStops = new Set<StopFn>();
  private samplers = new Map<string, Smplr>();
  private loading = new Map<string, Promise<Smplr>>();
  private failedSamples = new Set<string>();
  private volume = .72;
  private mode: AudioMode = "samples";
  private onStatus?: (message: string) => void;

  async resume() {
    this.ensureContext();
    if (this.context?.state === "suspended") await this.context.resume();
  }

  setStatusListener(listener: (message: string) => void) { this.onStatus = listener; }
  setMode(mode: AudioMode) { this.mode = mode; this.onStatus?.(mode === "samples" ? "专业采样音源（MusyngKite SoundFont）" : "离线合成音源"); }
  getMode() { return this.mode; }

  async preload(instrumentIds: string[]) {
    if (this.mode !== "samples") return;
    this.ensureContext();
    const unique = [...new Set(instrumentIds)].filter((id) => id !== "percussion");
    this.onStatus?.(`正在载入 ${unique.length} 种管弦乐采样…`);
    const results = await Promise.allSettled(unique.map((id) => this.loadSampler(id)));
    const loaded = results.filter((item) => item.status === "fulfilled").length;
    this.onStatus?.(loaded ? `采样音源已就绪：${loaded}/${unique.length} 种乐器` : "采样载入失败，已自动使用合成音源");
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .02);
  }

  stopAll() {
    for (const voice of this.voices) { try { voice.stop(); } catch { /* already stopped */ } }
    for (const stop of this.sampleStops) { try { stop(); } catch { /* already stopped */ } }
    this.voices.clear(); this.sampleStops.clear();
  }

  play(event: NoteEvent, seconds: number) {
    this.ensureContext();
    if (!this.context || !this.master || this.context.state !== "running") return;
    const duration = this.articulatedDuration(event, seconds);
    if (this.mode === "samples" && event.instrumentId !== "percussion" && !this.failedSamples.has(event.instrumentId)) {
      const sampler = this.samplers.get(event.instrumentId);
      if (sampler) {
        const stop = sampler.start({ note: event.midi, velocity: event.velocity, duration, ampRelease: event.slurred ? .18 : .08, stopId: event.id });
        this.sampleStops.add(stop); setTimeout(() => this.sampleStops.delete(stop), (duration + 1) * 1000); return;
      }
      void this.loadSampler(event.instrumentId);
    }
    this.playSynth(event, duration);
  }

  private async loadSampler(instrumentId: string) {
    const existing = this.samplers.get(instrumentId); if (existing) return existing;
    const pending = this.loading.get(instrumentId); if (pending) return pending;
    this.ensureContext();
    const context = this.context!, destination = this.master!;
    const instrument = instruments.find((item) => item.id === instrumentId) ?? instruments[0];
    const promise = (async () => {
      try {
        const sampler = Soundfont(context, {
          instrument: soundfontNames[instrumentId] ?? "violin", kit: "MusyngKite", destination,
          volume: 70, pan: Math.max(-.8, Math.min(.8, instrument.position[0] / 5.5)),
        });
        await sampler.ready; this.samplers.set(instrumentId, sampler); return sampler;
      } catch (error) {
        this.failedSamples.add(instrumentId); throw error;
      } finally { this.loading.delete(instrumentId); }
    })();
    this.loading.set(instrumentId, promise); return promise;
  }

  private articulatedDuration(event: NoteEvent, seconds: number) {
    const factor = event.articulation === "staccatissimo" ? .34 : event.articulation === "staccato" ? .55 : event.articulation === "tenuto" ? .98 : event.articulation === "fermata" ? 1.55 : .9;
    return Math.max(.055, Math.min(18, seconds * factor));
  }

  private playSynth(event: NoteEvent, seconds: number) {
    const context = this.context!, destination = this.master!;
    if (event.group === "percussion" && event.instrumentId === "percussion") { this.playNoise(event.velocity, destination); return; }
    const instrument = instruments.find((item) => item.id === event.instrumentId) ?? instruments[0];
    const oscillator = context.createOscillator(), gain = context.createGain(), filter = context.createBiquadFilter(), panner = context.createStereoPanner();
    const now = context.currentTime, duration = Math.max(.06, Math.min(12, seconds));
    const peak = Math.min(.045, .008 + event.velocity / 127 * .026), attack = event.slurred ? .015 : event.group === "strings" ? .055 : event.group === "brass" ? .025 : .015;
    oscillator.type = this.waveform(event.group); oscillator.frequency.setValueAtTime(440 * 2 ** ((event.midi - 69) / 12), now);
    if (event.group === "brass") oscillator.detune.setValueAtTime(-4, now);
    filter.type = "lowpass"; filter.frequency.setValueAtTime(event.group === "strings" ? 2600 : event.group === "brass" ? 3400 : 5200, now); filter.Q.value = event.group === "woodwinds" ? 1.8 : .7;
    panner.pan.value = Math.max(-.85, Math.min(.85, instrument.position[0] / 5.5));
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(peak, now + attack); gain.gain.setValueAtTime(peak, Math.max(now + attack, now + duration * .72)); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(filter).connect(gain).connect(panner).connect(destination); this.track(oscillator); oscillator.start(now); oscillator.stop(now + duration + .03);
  }

  private ensureContext() {
    if (this.context) return;
    this.context = new AudioContext({ latencyHint: "interactive" }); this.master = this.context.createGain(); this.compressor = this.context.createDynamicsCompressor();
    this.master.gain.value = this.volume; this.compressor.threshold.value = -18; this.compressor.knee.value = 18; this.compressor.ratio.value = 5;
    this.master.connect(this.compressor).connect(this.context.destination);
  }
  private waveform(group: InstrumentGroup): OscillatorType { return group === "woodwinds" ? "sine" : group === "brass" ? "sawtooth" : group === "strings" ? "triangle" : "sine"; }
  private playNoise(velocity: number, destination: AudioNode) {
    const context = this.context!, length = Math.floor(context.sampleRate * .16), buffer = context.createBuffer(1, length, context.sampleRate), data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    filter.type = "bandpass"; filter.frequency.value = 1500; filter.Q.value = .8; gain.gain.value = Math.min(.04, velocity / 127 * .035);
    source.buffer = buffer; source.connect(filter).connect(gain).connect(destination); this.track(source); source.start();
  }
  private track(voice: Voice) { this.voices.add(voice); voice.addEventListener("ended", () => this.voices.delete(voice), { once: true }); }
}
