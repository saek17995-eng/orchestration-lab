import { Midi } from "@tonejs/midi";
import { strFromU8, unzipSync } from "fflate";
import { mapScorePart, NoteEvent, ParsedScore, parseMusicXML, ScorePart, TempoChange } from "@/lib/musicxml";

function measureData(totalBeats: number, beatsPerMeasure: number) {
  const count = Math.max(1, Math.ceil(totalBeats / beatsPerMeasure));
  return {
    measureCount: count,
    measureStarts: Array.from({ length: count }, (_, index) => index * beatsPerMeasure),
    measureDurations: Array.from({ length: count }, (_, index) => Math.min(beatsPerMeasure, Math.max(.001, totalBeats - index * beatsPerMeasure))),
  };
}

export function parseMXL(data: ArrayBuffer) {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(data)); }
  catch { throw new Error("MXL 压缩包损坏或不是有效的 ZIP/MXL 文件。"); }
  const containerName = Object.keys(files).find((name) => /(^|\/)META-INF\/container\.xml$/i.test(name));
  let scorePath: string | undefined;
  if (containerName) {
    const container = new DOMParser().parseFromString(strFromU8(files[containerName]), "application/xml");
    scorePath = container.getElementsByTagName("rootfile")[0]?.getAttribute("full-path") ?? undefined;
  }
  scorePath ??= Object.keys(files).find((name) => /\.(musicxml|xml)$/i.test(name) && !/META-INF\//i.test(name));
  if (!scorePath || !files[scorePath]) throw new Error("MXL 中没有找到主 MusicXML 乐谱。");
  return parseMusicXML(strFromU8(files[scorePath]), "MXL");
}

export function parseMIDI(data: ArrayBuffer, fileName = "MIDI 乐谱"): ParsedScore {
  let midi: Midi;
  try { midi = new Midi(data); }
  catch { throw new Error("MIDI 文件结构无效，无法解析。"); }
  const ppq = Math.max(1, midi.header.ppq);
  const signature = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const beatsPerMeasure = Math.max(1, Number(signature[0]) || 4) * 4 / Math.max(1, Number(signature[1]) || 4);
  const beatType = Math.max(1, Number(signature[1]) || 4);
  const parts: ScorePart[] = [];
  const events: NoteEvent[] = [];
  const warnings: string[] = [];
  const playableTracks = midi.tracks.filter((track) => track.notes.length > 0);
  playableTracks.forEach((track, index) => {
    const trackName = track.name?.trim() || track.instrument.name || `MIDI 声部 ${index + 1}`;
    const inferredName = track.instrument.percussion ? `Percussion ${trackName}` : `${trackName} ${track.instrument.name}`;
    const mapped = mapScorePart(inferredName, index);
    const part = { ...mapped, id: `MIDI-${index + 1}`, name: trackName };
    parts.push(part);
    if (part.mappingWarning) warnings.push(part.mappingWarning);
    track.notes.forEach((note, noteIndex) => {
      const startBeat = note.ticks / ppq;
      const durationBeats = Math.max(.03125, note.durationTicks / ppq);
      events.push({
        id: `${part.id}-${noteIndex}`, partId: part.id, instrumentId: part.instrumentId, group: part.group,
        measure: Math.floor(startBeat / beatsPerMeasure) + 1, startBeat, durationBeats,
        midi: note.midi, velocity: Math.max(1, Math.min(127, Math.round(note.velocity * 127))),
      });
    });
  });
  if (!events.length) throw new Error("MIDI 中没有找到可播放的音符轨道。");
  events.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
  const totalBeats = Math.max(...events.map((event) => event.startBeat + event.durationBeats));
  const measures = measureData(totalBeats, beatsPerMeasure);
  const tempoChanges: TempoChange[] = (midi.header.tempos.length ? midi.header.tempos : [{ ticks: 0, bpm: 120 }]).map((tempo) => ({ beat: tempo.ticks / ppq, bpm: tempo.bpm })).sort((a, b) => a.beat - b.beat);
  if (tempoChanges[0].beat > 0) tempoChanges.unshift({ beat: 0, bpm: 120 });
  return {
    title: midi.name?.trim() || fileName.replace(/\.(mid|midi)$/i, ""), sourceFormat: "MIDI", tempo: tempoChanges[0].bpm,
    tempoChanges, beatsPerMeasure, beatType, totalBeats, parts, events, warnings, ...measures,
  };
}

export async function parseScoreFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xml" || extension === "musicxml") return parseMusicXML(await file.text());
  if (extension === "mxl") return parseMXL(await file.arrayBuffer());
  if (extension === "mid" || extension === "midi") return parseMIDI(await file.arrayBuffer(), file.name);
  throw new Error("请选择 .musicxml、.xml、.mxl、.mid 或 .midi 文件。");
}
