"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AudioLines, Box, BookOpen, ChevronLeft, ChevronRight, CircleAlert, FileMusic, Gauge, Info, Layers3, LoaderCircle, Mic, Pause, Play, RotateCcw, Search, Sparkles, Square, Upload, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { groupMeta, InstrumentGroup, instruments, instrumentVisualMeta } from "@/lib/orchestra-data";
import { AudioMode, OrchestraAudioEngine } from "@/lib/audio-engine";
import { advanceBeatBySeconds, analyzeMeasure, lowerBoundEvent, measureAtBeat, NoteEvent, ParsedScore, parseMusicXML, secondsBetweenBeats, tempoAtBeat } from "@/lib/musicxml";
import { parseScoreFile } from "@/lib/score-import";
import { BlenderAsset, OrchestraScene } from "./OrchestraScene";

const groups = Object.keys(groupMeta) as InstrumentGroup[];

function ScoreStrip({ score, measure, onSelect }: { score: ParsedScore; measure: number; onSelect: (measure: number) => void }) {
  const byMeasure = useMemo(() => {
    const result = new Map<number, NoteEvent[]>();
    for (const event of score.events) {
      const list = result.get(event.measure) ?? [];
      if (list.length < 18) list.push(event);
      result.set(event.measure, list);
    }
    return result;
  }, [score]);
  return <div className="score-scroll flex gap-1 overflow-x-auto pb-2" aria-label="乐谱小节时间线">
    {Array.from({ length: score.measureCount }, (_, index) => index + 1).map((number) => {
      const active = number === measure;
      const start = score.measureStarts[number - 1] ?? 0;
      const duration = score.measureDurations[number - 1] || score.beatsPerMeasure;
      return <button key={number} onClick={() => onSelect(number)} className={`relative h-24 min-w-24 overflow-hidden rounded-md border px-2 text-left transition ${active ? "border-primary bg-primary/10" : "border-border/70 bg-black/15 hover:border-slate-500"}`} aria-current={active ? "true" : undefined} aria-label={`跳转到第${number}小节`}>
        <span className="absolute right-2 top-1 text-[12px] text-muted-foreground">{number}</span>
        <span className="staff-lines absolute inset-x-2 bottom-3 top-6 opacity-80" />
        {(byMeasure.get(number) ?? []).map((note) => {
          const left = 8 + Math.min(82, Math.max(0, (note.startBeat - start) / duration * 82));
          const top = 30 + (84 - Math.min(84, Math.max(40, note.midi))) * 1.02;
          const width = Math.max(5, Math.min(24, note.durationBeats / duration * 72));
          return <span key={note.id} className="absolute h-1.5 rounded-full shadow-sm" style={{ left: `${left}%`, top: `${top}px`, width: `${width}%`, background: groupMeta[note.group].color }} />;
        })}
        {active && <span className="absolute bottom-2 left-1/2 top-6 w-px bg-primary shadow-[0_0_10px_#d8aa5d]" />}
      </button>;
    })}
  </div>;
}

export function OrchestrationLab() {
  const [score, setScore] = useState<ParsedScore | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [measure, setMeasure] = useState(1);
  const [measureProgress, setMeasureProgress] = useState(0);
  const [speed, setSpeed] = useState(100);
  const [volume, setVolume] = useState(72);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioMode, setAudioMode] = useState<AudioMode>("samples");
  const [audioStatus, setAudioStatus] = useState("专业采样音源待载入");
  const [selectedId, setSelectedId] = useState("violin1");
  const [soloGroup, setSoloGroup] = useState<InstrumentGroup | null>(null);
  const [mutedGroups, setMutedGroups] = useState<InstrumentGroup[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [assistantReply, setAssistantReply] = useState("可以输入“只播放木管组”“从第5小节开始”或“分析这一段”。");
  const [importMessage, setImportMessage] = useState("正在解析真实 MusicXML 示例…");
  const [importError, setImportError] = useState<string | null>(null);
  const [blenderAsset, setBlenderAsset] = useState<BlenderAsset | null>(null);
  const [blenderMessage, setBlenderMessage] = useState("15类Blender乐器模型已载入");

  const playheadBeatRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const eventCursorRef = useRef(0);
  const activeUntilRef = useRef(new Map<string, number>());
  const audioRef = useRef<OrchestraAudioEngine | null>(null);
  const scoreRef = useRef<ParsedScore | null>(null);
  const stateSnapshotRef = useRef({ measure: 1, isPlaying: false, speed: 100, soloGroup: null as InstrumentGroup | null, title: "", noteEvents: 0 });

  const getAudio = () => audioRef.current ??= new OrchestraAudioEngine();
  const selectInstrument = useCallback((id: string) => setSelectedId(id), []);
  const selected = instruments.find((item) => item.id === selectedId) ?? instruments[0];
  const selectedVisual = instrumentVisualMeta[selected.id] ?? { color: groupMeta[selected.group].color, players: 1 };
  const mutedIds = useMemo(() => instruments.filter((item) => mutedGroups.includes(item.group) || (soloGroup && item.group !== soloGroup)).map((item) => item.id), [mutedGroups, soloGroup]);
  const analysis = useMemo(() => score ? analyzeMeasure(score, measure) : { density: "—", score: 0, alert: "等待乐谱", detail: "正在载入MusicXML。", balance: { woodwinds: 0, brass: 0, percussion: 0, strings: 0 } as Record<InstrumentGroup, number>, eventCount: 0 }, [score, measure]);

  useEffect(() => {
    const audio = getAudio(); audio.setStatusListener(setAudioStatus); audio.setMode(audioMode);
  }, [audioMode]);

  const previewMeasure = useCallback((target: number, source = scoreRef.current) => {
    if (!source) return;
    const safe = Math.max(1, Math.min(source.measureCount, target));
    const beat = source.measureStarts[safe - 1] ?? 0;
    playheadBeatRef.current = beat;
    eventCursorRef.current = lowerBoundEvent(source.events, beat);
    activeUntilRef.current.clear();
    getAudio().stopAll();
    setMeasure(safe);
    setMeasureProgress(0);
    setActiveIds([...new Set(source.events.filter((event) => event.measure === safe).map((event) => event.instrumentId))]);
  }, []);

  const applyScore = useCallback((next: ParsedScore, message: string) => {
    setIsPlaying(false);
    getAudio().stopAll();
    scoreRef.current = next;
    setScore(next);
    setSoloGroup(null);
    setMutedGroups([]);
    setImportError(null);
    setImportMessage(message);
    const firstInstrument = next.parts[0]?.instrumentId;
    if (firstInstrument) setSelectedId(firstInstrument);
    previewMeasure(1, next);
  }, [previewMeasure]);

  useEffect(() => {
    let cancelled = false;
    fetch("./demo-orchestra.musicxml")
      .then((response) => { if (!response.ok) throw new Error("示例乐谱加载失败"); return response.text(); })
      .then((xml) => parseMusicXML(xml))
      .then((parsed) => { if (!cancelled) applyScore(parsed, `已解析 ${parsed.parts.length} 个声部、${parsed.events.length} 个真实音符事件`); })
      .catch((error: unknown) => { if (!cancelled) setImportError(error instanceof Error ? error.message : "示例MusicXML解析失败"); });
    return () => { cancelled = true; };
  }, [applyScore]);

  useEffect(() => { getAudio().setVolume(soundEnabled ? volume / 100 : 0); }, [volume, soundEnabled]);

  useEffect(() => {
    if (!isPlaying || !score) { lastFrameRef.current = null; getAudio().stopAll(); return; }
    let frame = 0;
    const tick = (time: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = time;
      const deltaSeconds = Math.min(.1, (time - lastFrameRef.current) / 1000);
      lastFrameRef.current = time;
      const previousBeat = playheadBeatRef.current;
      const nextBeat = advanceBeatBySeconds(score, previousBeat, deltaSeconds * (speed / 100));
      if (nextBeat >= score.totalBeats) {
        playheadBeatRef.current = score.totalBeats;
        getAudio().stopAll();
        setIsPlaying(false);
        setActiveIds([]);
        return;
      }
      playheadBeatRef.current = nextBeat;
      while (eventCursorRef.current < score.events.length && score.events[eventCursorRef.current].startBeat <= nextBeat + .01) {
        const event = score.events[eventCursorRef.current];
        if (event.startBeat >= previousBeat - .01 && !mutedGroups.includes(event.group) && (!soloGroup || event.group === soloGroup)) {
          if (soundEnabled) getAudio().play(event, secondsBetweenBeats(score, event.startBeat, event.startBeat + event.durationBeats) / (speed / 100));
          activeUntilRef.current.set(event.instrumentId, Math.max(activeUntilRef.current.get(event.instrumentId) ?? 0, event.startBeat + event.durationBeats));
        }
        eventCursorRef.current += 1;
      }
      for (const [instrumentId, endBeat] of activeUntilRef.current) if (endBeat <= nextBeat) activeUntilRef.current.delete(instrumentId);
      const nextActive = [...activeUntilRef.current.keys()];
      setActiveIds((current) => current.join("|") === nextActive.join("|") ? current : nextActive);
      const currentMeasure = measureAtBeat(score, nextBeat);
      const measureStart = score.measureStarts[currentMeasure - 1] ?? 0;
      const measureDuration = score.measureDurations[currentMeasure - 1] || score.beatsPerMeasure;
      setMeasure(currentMeasure);
      setMeasureProgress(Math.min(100, Math.max(0, (nextBeat - measureStart) / measureDuration * 100)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, score, speed, mutedGroups, soloGroup, soundEnabled]);

  const togglePlayback = async () => {
    if (!score) return;
    if (isPlaying) { setIsPlaying(false); return; }
    if (playheadBeatRef.current >= score.totalBeats - .01) previewMeasure(1);
    if (soundEnabled) {
      const audio = getAudio(); await audio.resume(); audio.setMode(audioMode);
      if (audioMode === "samples") void audio.preload(score.parts.map((part) => part.instrumentId));
    }
    eventCursorRef.current = lowerBoundEvent(score.events, playheadBeatRef.current);
    activeUntilRef.current.clear();
    setActiveIds([]);
    setIsPlaying(true);
  };

  const stopPlayback = () => { setIsPlaying(false); if (score) previewMeasure(1); };
  const toggleMute = (group: InstrumentGroup) => setMutedGroups((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group]);

  useEffect(() => {
    stateSnapshotRef.current = { measure, isPlaying, speed, soloGroup, title: score?.title ?? "", noteEvents: score?.events.length ?? 0 };
  }, [measure, isPlaying, speed, soloGroup, score]);

  useEffect(() => {
    type ToolDefinition = { name: string; title: string; description: string; inputSchema: Record<string, unknown>; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown };
    type ModelContext = { registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => void | Promise<void> };
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: ToolDefinition) => { try { void Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined); } catch { /* optional browser API */ } };
    register({ name: "read_orchestration_state", title: "读取配器实验室状态", description: "读取当前导入乐谱、音符数量、小节、播放状态、速度和独奏组。", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => stateSnapshotRef.current });
    register({ name: "navigate_to_measure", title: "跳转到指定小节", description: "把乐谱、采样声音时间轴和三维乐队同步跳转到指定小节。", inputSchema: { type: "object", properties: { measure: { type: "integer", minimum: 1 } }, required: ["measure"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const value = Number((input as { measure?: unknown })?.measure); const currentScore = scoreRef.current; if (!currentScore || !Number.isInteger(value) || value < 1 || value > currentScore.measureCount) throw new Error(`measure 必须是1至${currentScore?.measureCount ?? 1}之间的整数`); previewMeasure(value, currentScore); return { measure: value }; } });
    register({ name: "set_orchestra_playback", title: "设置播放状态", description: "开始或暂停统一乐谱时间轴；声音仍需浏览器中的用户手势授权。", inputSchema: { type: "object", properties: { playing: { type: "boolean" } }, required: ["playing"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const playing = (input as { playing?: unknown })?.playing; if (typeof playing !== "boolean") throw new Error("playing 必须是布尔值"); setIsPlaying(playing); return { playing }; } });
    register({ name: "solo_instrument_group", title: "独奏乐器组", description: "独奏木管、铜管、打击乐或弦乐组；传入all恢复全部声部。", inputSchema: { type: "object", properties: { group: { type: "string", enum: ["woodwinds", "brass", "percussion", "strings", "all"] } }, required: ["group"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const group = (input as { group?: unknown })?.group; if (group === "all") { setSoloGroup(null); setMutedGroups([]); return { soloGroup: null }; } if (!groups.includes(group as InstrumentGroup)) throw new Error("无法识别的乐器组"); setSoloGroup(group as InstrumentGroup); return { soloGroup: group }; } });
    return () => lifecycle.abort();
  }, [previewMeasure]);

  const executeCommand = () => {
    const content = command.trim(); if (!content || !score) return;
    if (/恢复|全部声部/.test(content)) { setSoloGroup(null); setMutedGroups([]); setAssistantReply("已恢复全部声部。"); }
    else if (/暂停/.test(content)) { setIsPlaying(false); setAssistantReply("已暂停MusicXML播放。"); }
    else if (/播放|开始/.test(content)) { void togglePlayback(); setAssistantReply(`将从第 ${measure} 小节继续播放。`); }
    else if (/只播放|单独播放/.test(content)) { const group = groups.find((key) => content.includes(groupMeta[key].name.replace("组", ""))); if (group) { setSoloGroup(group); setAssistantReply(`已独奏${groupMeta[group].name}。`); } else setAssistantReply("请指定木管、铜管、打击乐或弦乐组。"); }
    else if (/静音/.test(content)) { const group = groups.find((key) => content.includes(groupMeta[key].name.replace("组", ""))); if (group) { setMutedGroups((current) => [...new Set([...current, group])]); setAssistantReply(`已静音${groupMeta[group].name}。`); } else setAssistantReply("请说明需要静音的乐器组。"); }
    else if (/第\s*(\d+)\s*小节/.test(content)) { const number = Number(content.match(/第\s*(\d+)\s*小节/)?.[1]); previewMeasure(number); setAssistantReply(`已定位到第 ${Math.max(1, Math.min(score.measureCount, number))} 小节。`); }
    else if (/速度.*?(\d+)/.test(content)) { const number = Math.max(50, Math.min(150, Number(content.match(/速度.*?(\d+)/)?.[1]))); setSpeed(number); setAssistantReply(`播放速度已调整为 ${number}%。`); }
    else if (/分析|为什么|织体/.test(content)) setAssistantReply(`第 ${measure} 小节为“${analysis.density}”织体。${analysis.detail}`);
    else setAssistantReply("可以控制播放、小节、速度、独奏/静音，并分析当前小节。");
    setCommand("");
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setImportError(null);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["xml", "musicxml", "mxl", "mid", "midi"].includes(extension ?? "")) { setImportError("请选择 .musicxml、.xml、.mxl、.mid 或 .midi 文件。"); return; }
    if (file.size > 50 * 1024 * 1024) { setImportError("文件超过50MB，请先精简乐谱或MIDI。"); return; }
    try {
      setImportMessage(`正在解析 ${file.name}…`);
      const parsed = await parseScoreFile(file);
      const warning = parsed.warnings.length ? `；${parsed.warnings.length}个声部采用临时席位映射` : "";
      applyScore(parsed, `${parsed.sourceFormat}真实解析完成：${parsed.parts.length}个声部、${parsed.events.length}个音符、${parsed.measureCount}小节${warning}`);
    } catch (error) { setImportError(error instanceof Error ? error.message : "乐谱解析失败"); }
    event.target.value = "";
  };

  const handleBlenderImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.name.split(".").pop()?.toLowerCase() !== "glb") { setBlenderMessage("请在 Blender 中导出单文件 .glb 后再导入。"); event.target.value = ""; return; }
    if (file.size > 80 * 1024 * 1024) { setBlenderMessage("GLB超过80MB，请在Blender中压缩纹理或减少面数。"); event.target.value = ""; return; }
    const url = URL.createObjectURL(file);
    setBlenderAsset((current) => { if (current) URL.revokeObjectURL(current.url); return { url, targetId: selectedId, filename: file.name }; });
    setBlenderMessage(`${file.name} 已替换${selected.name}模型`);
    event.target.value = "";
  };

  useEffect(() => () => { if (blenderAsset) URL.revokeObjectURL(blenderAsset.url); }, [blenderAsset]);

  return <main className="min-h-screen min-w-[320px] bg-transparent text-foreground">
    <header className="flex h-16 items-center justify-between border-b border-border/80 bg-[#090d15]/95 px-4 backdrop-blur-xl lg:px-6">
      <div className="flex min-w-0 items-center gap-3"><div className="grid size-9 place-items-center rounded-lg border border-primary/35 bg-primary/10 text-primary"><AudioLines className="size-5" /></div><div className="min-w-0"><h1 className="truncate text-base font-semibold tracking-wide">三维智能管弦乐配器教学系统</h1><p className="truncate text-xs text-muted-foreground">MusicXML / MXL / MIDI · 3D Orchestra · SoundFont</p></div></div>
      <div className="flex items-center gap-2"><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-secondary/60 px-3 text-sm hover:bg-secondary"><Upload className="size-4" /><span className="hidden sm:inline">导入乐谱</span><input type="file" accept=".xml,.musicxml,.mxl,.mid,.midi,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml,application/x-midi,audio/midi" onChange={handleImport} className="sr-only" /></label><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-400/5 px-3 text-sm text-cyan-200 hover:bg-cyan-400/10" title={`导入模型并替换当前选中的${selected.name}`}><Box className="size-4" /><span className="hidden md:inline">Blender模型</span><input type="file" accept=".glb,model/gltf-binary" onChange={handleBlenderImport} className="sr-only" /></label><Button variant="outline" className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/15"><BookOpen />教学模式</Button></div>
    </header>
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 xl:grid-cols-[220px_minmax(760px,1fr)_300px] 2xl:grid-cols-[240px_minmax(900px,1fr)_320px]">
      <aside className="glass-panel order-2 border-r border-border/80 p-4 xl:order-1">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">乐谱声部映射</p><p className="text-xs text-muted-foreground">{score ? `${score.sourceFormat} · ${score.parts.length}个声部 · ${score.events.length}个音符` : "解析中…"}</p></div><Search className="size-4 text-muted-foreground" /></div>
        <div className="space-y-4">{groups.map((group) => { const meta = groupMeta[group], isSolo = soloGroup === group, isMuted = mutedGroups.includes(group); return <section key={group}><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: meta.color }} /><h2 className="text-sm font-medium">{meta.name}</h2></div><div className="flex gap-1"><button onClick={() => setSoloGroup(isSolo ? null : group)} className={`rounded px-2 py-1 text-xs ${isSolo ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`} aria-label={`独奏${meta.name}`}>S</button><button onClick={() => toggleMute(group)} className={`rounded px-2 py-1 text-xs ${isMuted ? "bg-destructive/80 text-white" : "bg-secondary text-muted-foreground"}`} aria-label={`静音${meta.name}`}>M</button></div></div><div className="space-y-1">{instruments.filter((item) => item.group === group).map((item) => { const active = activeIds.includes(item.id), mapped = score?.parts.filter((part) => part.instrumentId === item.id).map((part) => part.name).join("、"), visual = instrumentVisualMeta[item.id] ?? { color: meta.color, players: 1 }; return <button key={item.id} onClick={() => setSelectedId(item.id)} title={mapped ? `映射声部：${mapped}` : "当前乐谱未映射此席位"} className={`flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-sm transition ${selectedId === item.id ? "border-primary/50 bg-primary/10" : "border-transparent hover:bg-white/[.04]"}`}><span className="flex min-w-0 items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${active ? "pulse-gold" : "opacity-60"}`} style={{ background: visual.color }} /><span className="truncate">{item.name}</span></span><span className="ml-2 shrink-0 text-xs text-muted-foreground">{active ? "发声中" : `${visual.players}人`}</span></button>; })}</div></section>; })}</div>
      </aside>

      <section className="order-1 flex min-w-0 flex-col xl:order-2">
        <div className="border-b border-border/70 px-4 py-3 lg:px-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2"><FileMusic className="size-4 text-primary" /><h2 className="font-semibold">{score?.title ?? "正在载入乐谱"}</h2><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{score?.sourceFormat ?? "解析中"}</span></div><p className={`mt-1 text-xs ${importError ? "text-destructive" : "text-muted-foreground"}`}>{importError ?? importMessage}</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="rounded border border-border px-2 py-1">{score ? `${score.beatsPerMeasure}/${score.beatType}` : "—"}</span><span className="rounded border border-border px-2 py-1">♩ = {score ? Math.round(tempoAtBeat(score, playheadBeatRef.current) * speed / 100) : "—"}</span><span className="rounded border border-border px-2 py-1">第 {measure} / {score?.measureCount ?? 1} 小节</span></div></div></div>
        <div className="relative min-h-[680px] flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(78,111,154,.22),transparent_58%)] xl:min-h-[760px]"><OrchestraScene activeIds={activeIds.filter((id) => !mutedIds.includes(id))} mutedIds={mutedIds} selectedId={selectedId} blenderAsset={blenderAsset} onSelect={selectInstrument} /><div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-border/80 bg-[#0c111a]/80 px-3 py-2 backdrop-blur"><p className="text-xs text-muted-foreground">当前真实织体</p><p className="mt-0.5 font-medium">{analysis.density} · {activeIds.length} 个发声区域</p></div><div className="absolute right-4 top-4 max-w-[260px] rounded-lg border border-cyan-400/25 bg-[#07141b]/85 px-3 py-2 text-xs backdrop-blur"><div className="flex items-center gap-2 text-cyan-200"><Box className="size-3.5" /><span>Blender资产管线</span></div><p className="mt-1 text-muted-foreground">{blenderMessage}</p>{blenderAsset && <button onClick={() => { URL.revokeObjectURL(blenderAsset.url); setBlenderAsset(null); setBlenderMessage("已恢复系统Blender模型"); }} className="mt-1 text-cyan-300 hover:text-cyan-100">恢复系统模型</button>}</div><div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3 rounded-full border border-border/80 bg-[#0c111a]/80 px-4 py-2 text-xs text-muted-foreground backdrop-blur">宽松座次 · 声部区域实时发光 · 拖动旋转 · 点击席位</div></div>
        <div className="border-t border-border/80 bg-[#0b1018] p-4"><div className="mb-3 flex items-center gap-3"><Button size="icon-sm" variant="ghost" onClick={() => previewMeasure(measure - 1)} aria-label="上一小节"><ChevronLeft /></Button><Button size="icon" onClick={() => void togglePlayback()} disabled={!score} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" aria-label={isPlaying ? "暂停" : "播放"}>{score ? isPlaying ? <Pause /> : <Play className="ml-0.5" /> : <LoaderCircle className="animate-spin" />}</Button><Button size="icon-sm" variant="ghost" onClick={stopPlayback} aria-label="停止"><Square /></Button><Button size="icon-sm" variant="ghost" onClick={() => previewMeasure(measure + 1)} aria-label="下一小节"><ChevronRight /></Button><div className="min-w-24 flex-1"><Progress value={score ? ((measure - 1 + measureProgress / 100) / score.measureCount) * 100 : 0} className="h-1.5 bg-secondary [&_[data-slot=progress-indicator]]:bg-primary" /></div><span className="w-16 text-right text-xs text-muted-foreground">{measure}:{Math.max(1, Math.ceil(measureProgress / 25))}</span><button onClick={() => setSoundEnabled((current) => !current)} className={soundEnabled ? "text-primary" : "text-muted-foreground"} aria-label={soundEnabled ? "关闭声音" : "开启声音"}>{soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</button><div className="w-20"><Slider value={[volume]} onValueChange={(value) => setVolume(value[0])} max={100} step={1} className="[&_[data-slot=slider-range]]:bg-primary" /></div></div><div className="mb-3 flex flex-wrap items-center gap-3 text-xs"><span className="text-muted-foreground">速度</span><div className="w-32"><Slider value={[speed]} onValueChange={(value) => setSpeed(value[0])} min={50} max={150} step={5} /></div><span className="w-10 text-primary">{speed}%</span><button onClick={() => setSpeed(100)} className="text-muted-foreground hover:text-foreground"><RotateCcw className="size-3.5" /></button><div className="ml-auto flex items-center gap-1 rounded-md border border-border bg-black/20 p-1"><button onClick={() => setAudioMode("samples")} className={`rounded px-2 py-1 ${audioMode === "samples" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>专业采样</button><button onClick={() => setAudioMode("synth")} className={`rounded px-2 py-1 ${audioMode === "synth" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>离线合成</button></div><span className="w-full text-right text-muted-foreground sm:w-auto">{audioStatus} · 首次播放需点击授权</span></div>{score ? <ScoreStrip score={score} measure={measure} onSelect={previewMeasure} /> : <div className="h-24 animate-pulse rounded-lg bg-secondary/40" />}</div>
      </section>

      <aside className="glass-panel order-3 border-l border-border/80 p-4">
        <Tabs defaultValue="info" className="h-full"><TabsList variant="line" className="grid w-full grid-cols-4 border-b border-border pb-2"><TabsTrigger value="info" aria-label="乐器信息"><Info /></TabsTrigger><TabsTrigger value="analysis" aria-label="配器分析"><Activity /></TabsTrigger><TabsTrigger value="balance" aria-label="力度平衡"><Gauge /></TabsTrigger><TabsTrigger value="assistant" aria-label="智能助手"><Sparkles /></TabsTrigger></TabsList>
          <TabsContent value="info" className="pt-4"><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-medium" style={{ color: selectedVisual.color }}>{groupMeta[selected.group].name} · {selectedVisual.players}人</p><h2 className="mt-1 text-xl font-semibold">{selected.name}</h2><p className="text-sm text-muted-foreground">{selected.english}</p></div><span className="rounded-lg px-2 py-1 text-xs" style={{ background: `${selectedVisual.color}22`, color: selectedVisual.color }}>{selected.short}</span></div><dl className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-white/[.035] p-3"><dt className="text-xs text-muted-foreground">实际音域</dt><dd className="mt-1 font-medium">{selected.range}</dd></div><div className="rounded-lg bg-white/[.035] p-3"><dt className="text-xs text-muted-foreground">常用音域</dt><dd className="mt-1 font-medium">{selected.commonRange}</dd></div></dl><div className="mt-3 space-y-3 rounded-lg border border-border/70 p-3 text-sm"><div><p className="text-xs text-muted-foreground">乐谱映射声部</p><p className="mt-1">{score?.parts.filter((part) => part.instrumentId === selected.id).map((part) => part.name).join("、") || "未映射"}</p></div><div><p className="text-xs text-muted-foreground">移调关系</p><p className="mt-1">{selected.transposition}</p></div><div><p className="text-xs text-muted-foreground">音色特点</p><p className="mt-1 leading-6">{selected.character}</p></div><div><p className="text-xs text-muted-foreground">常用演奏法</p><p className="mt-1 leading-6">{selected.technique}</p></div></div><div className="mt-3 flex gap-2 rounded-lg border border-primary/20 bg-primary/[.06] p-3 text-sm leading-6"><CircleAlert className="mt-1 size-4 shrink-0 text-primary" /><p>{selected.note}</p></div></TabsContent>
          <TabsContent value="analysis" className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">第 {measure} 小节 · {analysis.eventCount}个音符事件</p><h2 className="mt-1 text-lg font-semibold">{analysis.alert}</h2></div><div className="grid size-14 place-items-center rounded-full border-4 border-primary/25 text-sm font-semibold text-primary">{analysis.score}</div></div><div className="mt-4 rounded-lg border border-border bg-white/[.03] p-4"><div className="mb-2 flex items-center gap-2"><Layers3 className="size-4 text-primary" /><p className="font-medium">织体：{analysis.density}</p></div><p className="text-sm leading-6 text-muted-foreground">{analysis.detail}</p></div><div className="mt-4"><p className="mb-3 text-sm font-medium">高级解析状态</p><ul className="space-y-2 text-sm text-muted-foreground"><li className="rounded-md bg-white/[.03] p-3">• 已支持 MusicXML、压缩 MXL 与标准 MIDI 的统一音符时间轴。</li><li className="rounded-md bg-white/[.03] p-3">• 连音线会合并持续时值；圆滑线、断奏、保持音、重音、延长记号与装饰音进入演奏语义。</li><li className="rounded-md bg-white/[.03] p-3">• 多段速度标记会实时改变播放速度，移调与力度用于声音和分析。</li>{score?.warnings.map((warning) => <li key={warning} className="rounded-md bg-amber-500/[.06] p-3 text-amber-200">• {warning}</li>)}</ul></div></TabsContent>
          <TabsContent value="balance" className="pt-4"><h2 className="text-lg font-semibold">乐谱相对强度</h2><p className="mt-1 text-sm text-muted-foreground">按当前小节的音符力度、时值和席位估算</p><div className="mt-6 space-y-5">{groups.map((group) => <div key={group}><div className="mb-2 flex justify-between text-sm"><span>{groupMeta[group].name}</span><span style={{ color: groupMeta[group].color }}>{analysis.balance[group]}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full transition-all" style={{ width: `${analysis.balance[group]}%`, background: groupMeta[group].color }} /></div></div>)}</div><p className="mt-6 rounded-lg border border-border p-3 text-sm leading-6 text-muted-foreground">专业采样模式使用 MusyngKite SoundFont 在线加载，并在网络不可用时自动回退到 Web Audio 合成；教学强度仍是相对估算，不等同于声压测量。</p></TabsContent>
          <TabsContent value="assistant" className="pt-4"><div className="mb-4 flex items-center gap-2"><div className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-4" /></div><div><h2 className="font-semibold">智能指挥助手</h2><p className="text-xs text-muted-foreground">已连接MusicXML时间轴</p></div></div><div className="min-h-36 rounded-lg border border-border bg-black/15 p-4 text-sm leading-6 text-slate-300">{assistantReply}</div><div className="mt-3 flex gap-2"><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => event.key === "Enter" && executeCommand()} placeholder="输入播放或分析指令…" className="min-w-0 flex-1 rounded-md border border-input bg-black/20 px-3 text-sm outline-none focus:border-primary" /><Button size="icon" variant="outline" aria-label="语音输入尚未启用" title="当前版本暂未启用语音识别"><Mic /></Button><Button onClick={executeCommand}>执行</Button></div><div className="mt-4 flex flex-wrap gap-2">{["只播放木管组","从第5小节开始","分析这一段","恢复所有声部"].map((sample) => <button key={sample} onClick={() => setCommand(sample)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary">{sample}</button>)}</div></TabsContent>
        </Tabs>
      </aside>
    </div>
  </main>;
}
