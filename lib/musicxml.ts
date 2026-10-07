import { groupMeta, InstrumentGroup, instruments } from "@/lib/orchestra-data";

export type ScorePart = {
  id: string;
  name: string;
  instrumentId: string;
  group: InstrumentGroup;
  mappingWarning?: string;
};

export type NoteEvent = {
  id: string;
  partId: string;
  instrumentId: string;
  group: InstrumentGroup;
  measure: number;
  startBeat: number;
  durationBeats: number;
  midi: number;
  velocity: number;
  articulation?: string;
};

export type ParsedScore = {
  title: string;
  composer?: string;
  tempo: number;
  beatsPerMeasure: number;
  beatType: number;
  measureCount: number;
  totalBeats: number;
  measureStarts: number[];
  measureDurations: number[];
  parts: ScorePart[];
  events: NoteEvent[];
  warnings: string[];
};

const pitchClass: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const dynamics: Record<string, number> = { ppp: 28, pp: 38, p: 50, mp: 62, mf: 78, f: 94, ff: 108, fff: 118 };

const aliases: Array<{ id: string; expressions: RegExp[] }> = [
  { id: "flute", expressions: [/flute/i, /piccolo/i, /长笛/, /短笛/] },
  { id: "oboe", expressions: [/oboe/i, /english horn/i, /双簧管/, /英国管/] },
  { id: "clarinet", expressions: [/clarinet/i, /单簧管/, /黑管/] },
  { id: "bassoon", expressions: [/bassoon/i, /contrabassoon/i, /大管/, /巴松/] },
  { id: "horn", expressions: [/(french )?horn/i, /圆号/] },
  { id: "trumpet", expressions: [/trumpet/i, /小号/] },
  { id: "trombone", expressions: [/trombone/i, /长号/] },
  { id: "tuba", expressions: [/tuba/i, /大号/] },
  { id: "timpani", expressions: [/timpani/i, /定音鼓/] },
  { id: "percussion", expressions: [/percussion/i, /drum/i, /cymbal/i, /打击乐/, /小军鼓/, /大鼓/, /镲/] },
  { id: "violin1", expressions: [/violin\s*(i|1|Ⅰ)(\b|$)/i, /第一小提琴/] },
  { id: "violin2", expressions: [/violin\s*(ii|2|Ⅱ)(\b|$)/i, /第二小提琴/] },
  { id: "viola", expressions: [/viola/i, /中提琴/] },
  { id: "cello", expressions: [/cello/i, /violoncello/i, /大提琴/] },
  { id: "bass", expressions: [/double bass/i, /contrabass/i, /低音提琴/] },
];

function text(node: Element | null | undefined, tag: string): string | undefined {
  return node?.getElementsByTagName(tag)[0]?.textContent?.trim() || undefined;
}

function directChildren(node: Element): Element[] {
  return Array.from(node.children);
}

function mapPart(name: string, index: number): ScorePart {
  let instrumentId = aliases.find((entry) => entry.expressions.some((expression) => expression.test(name)))?.id;
  if (!instrumentId && /violin|小提琴/i.test(name)) instrumentId = index % 2 ? "violin2" : "violin1";
  const fallbackIds = ["violin1", "violin2", "viola", "cello", "flute", "clarinet", "horn", "trumpet"];
  const fallback = !instrumentId;
  instrumentId ??= fallbackIds[index % fallbackIds.length];
  const instrument = instruments.find((item) => item.id === instrumentId) ?? instruments[0];
  return {
    id: "",
    name,
    instrumentId,
    group: instrument.group,
    mappingWarning: fallback ? `未识别“${name}”，暂映射到${instrument.name}` : undefined,
  };
}

function pitchToMidi(note: Element, transpose: number): number | null {
  const pitch = note.getElementsByTagName("pitch")[0];
  const unpitched = note.getElementsByTagName("unpitched")[0];
  const source = pitch || unpitched;
  if (!source) return null;
  const step = text(source, pitch ? "step" : "display-step") ?? "C";
  const octave = Number(text(source, pitch ? "octave" : "display-octave") ?? 4);
  const alter = Number(text(source, "alter") ?? 0);
  return Math.max(0, Math.min(127, 12 * (octave + 1) + (pitchClass[step] ?? 0) + alter + transpose));
}

function articulationFor(note: Element): string | undefined {
  const articulations = note.getElementsByTagName("articulations")[0];
  return articulations?.firstElementChild?.localName || undefined;
}

function dynamicFromDirection(direction: Element, fallback: number): number {
  const soundValue = Number(direction.getElementsByTagName("sound")[0]?.getAttribute("dynamics"));
  if (Number.isFinite(soundValue) && soundValue > 0) return Math.max(1, Math.min(127, Math.round(soundValue * 1.27)));
  const dynamicsNode = direction.getElementsByTagName("dynamics")[0];
  const mark = dynamicsNode?.firstElementChild?.localName;
  return mark && dynamics[mark] ? dynamics[mark] : fallback;
}

export function parseMusicXML(xml: string): ParsedScore {
  const documentNode = new DOMParser().parseFromString(xml, "application/xml");
  if (documentNode.getElementsByTagName("parsererror").length) throw new Error("MusicXML 文件结构无效，无法解析。");
  const root = documentNode.documentElement;
  if (!root || !/score-partwise/i.test(root.localName)) throw new Error("目前支持 score-partwise 格式的 MusicXML。");

  const title = text(root, "work-title") ?? text(root, "movement-title") ?? "未命名乐谱";
  const creators = Array.from(root.getElementsByTagName("creator"));
  const composer = creators.find((item) => item.getAttribute("type") === "composer")?.textContent?.trim();
  const partDefinitions = Array.from(root.getElementsByTagName("score-part")).map((part, index) => {
    const mapped = mapPart(text(part, "part-name") ?? `声部 ${index + 1}`, index);
    return { ...mapped, id: part.getAttribute("id") || `P${index + 1}` };
  });
  const definitionById = new Map(partDefinitions.map((part) => [part.id, part]));
  const warnings = partDefinitions.flatMap((part) => part.mappingWarning ? [part.mappingWarning] : []);
  const events: NoteEvent[] = [];
  const measureStarts: number[] = [];
  const measureDurations: number[] = [];
  let detectedTempo = 96;
  let beatsPerMeasure = 4;
  let beatType = 4;
  let totalBeats = 0;

  const partNodes = directChildren(root).filter((child) => child.localName === "part");
  partNodes.forEach((partNode, partIndex) => {
    const partId = partNode.getAttribute("id") || `P${partIndex + 1}`;
    const part = definitionById.get(partId) ?? { ...mapPart(`声部 ${partIndex + 1}`, partIndex), id: partId };
    let partBeat = 0;
    let divisions = 1;
    let transpose = 0;
    let currentVelocity = 78;
    directChildren(partNode).filter((child) => child.localName === "measure").forEach((measureNode, measureIndex) => {
      let cursor = 0;
      let maxCursor = 0;
      let lastNoteStart = 0;
      for (const child of directChildren(measureNode)) {
        if (child.localName === "attributes") {
          const nextDivisions = Number(text(child, "divisions"));
          if (Number.isFinite(nextDivisions) && nextDivisions > 0) divisions = nextDivisions;
          const chromatic = Number(text(child, "chromatic"));
          if (Number.isFinite(chromatic)) transpose = chromatic;
          const beats = Number(text(child, "beats"));
          const type = Number(text(child, "beat-type"));
          if (partIndex === 0 && Number.isFinite(beats) && beats > 0) beatsPerMeasure = beats;
          if (partIndex === 0 && Number.isFinite(type) && type > 0) beatType = type;
          continue;
        }
        if (child.localName === "direction") {
          const tempo = Number(child.getElementsByTagName("sound")[0]?.getAttribute("tempo") ?? text(child, "per-minute"));
          if (Number.isFinite(tempo) && tempo > 0 && events.length === 0) detectedTempo = tempo;
          currentVelocity = dynamicFromDirection(child, currentVelocity);
          continue;
        }
        if (child.localName === "backup" || child.localName === "forward") {
          const amount = Number(text(child, "duration") ?? 0) / divisions;
          cursor += child.localName === "backup" ? -amount : amount;
          cursor = Math.max(0, cursor);
          maxCursor = Math.max(maxCursor, cursor);
          continue;
        }
        if (child.localName !== "note") continue;
        const isChord = child.getElementsByTagName("chord").length > 0;
        const isGrace = child.getElementsByTagName("grace").length > 0;
        const rawDuration = Number(text(child, "duration") ?? (isGrace ? divisions / 4 : divisions));
        const durationBeats = Math.max(.0625, rawDuration / divisions);
        const noteStart = isChord ? lastNoteStart : cursor;
        if (!isChord) lastNoteStart = noteStart;
        const midi = pitchToMidi(child, transpose);
        if (midi !== null && child.getElementsByTagName("rest").length === 0) {
          const noteVelocity = Number(child.getElementsByTagName("sound")[0]?.getAttribute("dynamics"));
          events.push({
            id: `${partId}-${measureIndex + 1}-${events.length}`,
            partId,
            instrumentId: part.instrumentId,
            group: part.group,
            measure: measureIndex + 1,
            startBeat: partBeat + noteStart,
            durationBeats,
            midi,
            velocity: Number.isFinite(noteVelocity) && noteVelocity > 0 ? Math.min(127, Math.round(noteVelocity * 1.27)) : currentVelocity,
            articulation: articulationFor(child),
          });
        }
        maxCursor = Math.max(maxCursor, noteStart + durationBeats);
        if (!isChord) cursor += durationBeats;
      }
      const nominalLength = beatsPerMeasure * (4 / beatType);
      const measureLength = Math.max(maxCursor, cursor, measureIndex === 0 ? Math.min(nominalLength, maxCursor || nominalLength) : nominalLength);
      if (partIndex === 0) {
        measureStarts.push(partBeat);
        measureDurations.push(measureLength || nominalLength);
      }
      partBeat += measureLength || nominalLength;
    });
    totalBeats = Math.max(totalBeats, partBeat);
  });

  if (!partNodes.length) throw new Error("MusicXML 中没有找到可播放的声部。");
  if (!events.length) throw new Error("MusicXML 中没有找到带音高和时值的音符。");
  events.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
  const measureCount = Math.max(measureStarts.length, ...events.map((event) => event.measure));
  while (measureStarts.length < measureCount) {
    measureStarts.push(measureStarts.at(-1)! + (measureDurations.at(-1) ?? beatsPerMeasure));
    measureDurations.push(beatsPerMeasure);
  }
  return { title, composer, tempo: detectedTempo, beatsPerMeasure, beatType, measureCount, totalBeats, measureStarts, measureDurations, parts: partDefinitions, events, warnings };
}

export function measureAtBeat(score: ParsedScore, beat: number): number {
  for (let index = score.measureStarts.length - 1; index >= 0; index -= 1) if (beat >= score.measureStarts[index]) return index + 1;
  return 1;
}

export function lowerBoundEvent(events: NoteEvent[], beat: number): number {
  let low = 0, high = events.length;
  while (low < high) { const middle = (low + high) >>> 1; if (events[middle].startBeat < beat) low = middle + 1; else high = middle; }
  return low;
}

export function analyzeMeasure(score: ParsedScore, measure: number) {
  const measureEvents = score.events.filter((event) => event.measure === measure);
  const instrumentIds = new Set(measureEvents.map((event) => event.instrumentId));
  const densityScore = Math.min(100, Math.round(instrumentIds.size * 8 + measureEvents.length * 1.4));
  const density = densityScore >= 82 ? "高度密集" : densityScore >= 62 ? "密集" : densityScore >= 35 ? "适中" : instrumentIds.size <= 1 ? "单线条" : "稀疏";
  const groupEnergy = Object.fromEntries(Object.keys(groupMeta).map((group) => [group, 0])) as Record<InstrumentGroup, number>;
  for (const event of measureEvents) groupEnergy[event.group] += event.velocity * Math.min(2, event.durationBeats);
  const maxEnergy = Math.max(1, ...Object.values(groupEnergy));
  const balance = Object.fromEntries(Object.entries(groupEnergy).map(([group, value]) => [group, Math.round(value / maxEnergy * 100)])) as Record<InstrumentGroup, number>;
  const loudest = (Object.keys(balance) as InstrumentGroup[]).sort((a, b) => balance[b] - balance[a])[0];
  const alert = densityScore >= 82 ? "织体负荷较高" : balance.brass > 85 && balance.strings < 60 ? "铜管可能遮盖弦乐" : "结构清晰";
  const detail = measureEvents.length
    ? `${instrumentIds.size}个席位、${measureEvents.length}个音符事件。${groupMeta[loudest].name}能量估算最高；建议结合实际音源确认平衡。`
    : "当前小节没有可播放音符。";
  return { density, score: densityScore, alert, detail, balance, eventCount: measureEvents.length };
}
