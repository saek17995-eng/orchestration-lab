"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AudioLines, BookOpen, ChevronLeft, ChevronRight, CircleAlert, FileMusic, Gauge, Info, Layers3, Mic, Pause, Play, RotateCcw, Search, Sparkles, Square, Upload, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { activeForMeasure, analysisAt, groupMeta, InstrumentGroup, instruments } from "@/lib/orchestra-data";
import { OrchestraScene } from "./OrchestraScene";

const MAX_MEASURE = 32;
const groups = Object.keys(groupMeta) as InstrumentGroup[];

function ScoreStrip({ measure, onSelect }: { measure: number; onSelect: (measure: number) => void }) {
  return <div className="score-scroll flex gap-1 overflow-x-auto pb-2" aria-label="示例总谱小节">
    {Array.from({ length: MAX_MEASURE }, (_, index) => index + 1).map((number) => {
      const active = number === measure;
      return <button key={number} onClick={() => onSelect(number)} className={`relative h-24 min-w-20 overflow-hidden rounded-md border px-2 text-left transition ${active ? "border-primary bg-primary/10" : "border-border/70 bg-black/15 hover:border-slate-500"}`} aria-current={active ? "true" : undefined}>
        <span className="absolute right-2 top-1 text-[12px] text-muted-foreground">{number}</span>
        <span className="staff-lines absolute inset-x-2 bottom-3 top-6 opacity-80" />
        {[0,1,2].map((note) => <span key={note} className="absolute h-2 w-3 rounded-full bg-slate-300" style={{ left: `${14 + note * 24}%`, top: `${35 + ((number + note * 2) % 5) * 9}px`, transform: "rotate(-10deg)" }} />)}
        {active && <span className="absolute bottom-2 left-1/2 top-6 w-px bg-primary shadow-[0_0_10px_#d8aa5d]" />}
      </button>;
    })}
  </div>;
}

export function OrchestrationLab() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [measure, setMeasure] = useState(1);
  const [measureProgress, setMeasureProgress] = useState(0);
  const [speed, setSpeed] = useState(100);
  const [volume, setVolume] = useState(78);
  const [selectedId, setSelectedId] = useState("violin1");
  const [soloGroup, setSoloGroup] = useState<InstrumentGroup | null>(null);
  const [mutedGroups, setMutedGroups] = useState<InstrumentGroup[]>([]);
  const [command, setCommand] = useState("");
  const [assistantReply, setAssistantReply] = useState("可以输入“只播放木管组”“从第17小节开始”或“分析这一段”。");
  const [projectName, setProjectName] = useState("内置示例 · 光影序章");
  const [importMessage, setImportMessage] = useState("演示数据已加载");
  const progressRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const stateSnapshotRef = useRef({ measure: 1, isPlaying: false, speed: 100, soloGroup: null as InstrumentGroup | null });
  const selectInstrument = useCallback((id: string) => setSelectedId(id), []);
  const selected = instruments.find((item) => item.id === selectedId) ?? instruments[0];
  const mutedIds = useMemo(() => instruments.filter((item) => mutedGroups.includes(item.group) || (soloGroup && item.group !== soloGroup)).map((item) => item.id), [mutedGroups, soloGroup]);
  const activeIds = useMemo(() => activeForMeasure(measure).filter((id) => !mutedIds.includes(id)), [measure, mutedIds]);
  const analysis = analysisAt(measure);

  useEffect(() => {
    if (!isPlaying) { lastFrameRef.current = null; return; }
    let frame = 0;
    const tick = (time: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = time;
      const delta = time - lastFrameRef.current; lastFrameRef.current = time;
      progressRef.current += delta / (2600 / (speed / 100));
      if (progressRef.current >= 1) { progressRef.current -= 1; setMeasure((current) => current >= MAX_MEASURE ? 1 : current + 1); }
      setMeasureProgress(progressRef.current * 100); frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [isPlaying, speed]);

  const jumpTo = (next: number) => { const safe = Math.max(1, Math.min(MAX_MEASURE, next)); progressRef.current = 0; setMeasureProgress(0); setMeasure(safe); };
  const toggleMute = (group: InstrumentGroup) => setMutedGroups((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group]);

  useEffect(() => { stateSnapshotRef.current = { measure, isPlaying, speed, soloGroup }; }, [measure, isPlaying, speed, soloGroup]);

  useEffect(() => {
    type ToolDefinition = {
      name: string; title: string; description: string; inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    };
    type ModelContext = { registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => void | Promise<void> };
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: ToolDefinition) => { try { void Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined); } catch { /* WebMCP is optional. */ } };
    register({ name: "read_orchestration_state", title: "读取配器实验室状态", description: "读取当前小节、播放状态、速度和独奏乐器组。", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => stateSnapshotRef.current });
    register({ name: "navigate_to_measure", title: "跳转到指定小节", description: "把可见总谱和三维乐队同步跳转到1至32小节中的指定小节。", inputSchema: { type: "object", properties: { measure: { type: "integer", minimum: 1, maximum: 32 } }, required: ["measure"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const value = (input as { measure?: unknown })?.measure; if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 32) throw new Error("measure 必须是1至32之间的整数"); jumpTo(Number(value)); return { measure: Number(value) }; } });
    register({ name: "set_orchestra_playback", title: "设置播放状态", description: "开始或暂停当前示例总谱的同步播放。", inputSchema: { type: "object", properties: { playing: { type: "boolean" } }, required: ["playing"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const playing = (input as { playing?: unknown })?.playing; if (typeof playing !== "boolean") throw new Error("playing 必须是布尔值"); setIsPlaying(playing); return { playing }; } });
    register({ name: "solo_instrument_group", title: "独奏乐器组", description: "独奏木管、铜管、打击乐或弦乐组；传入all恢复全部声部。", inputSchema: { type: "object", properties: { group: { type: "string", enum: ["woodwinds", "brass", "percussion", "strings", "all"] } }, required: ["group"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const group = (input as { group?: unknown })?.group; if (group === "all") { setSoloGroup(null); setMutedGroups([]); return { soloGroup: null }; } if (!groups.includes(group as InstrumentGroup)) throw new Error("无法识别的乐器组"); setSoloGroup(group as InstrumentGroup); return { soloGroup: group }; } });
    return () => lifecycle.abort();
  }, []);

  const executeCommand = () => {
    const text = command.trim(); if (!text) return;
    if (/恢复|全部声部/.test(text)) { setSoloGroup(null); setMutedGroups([]); setAssistantReply("已恢复全部声部。可以继续播放或选择新的分析范围。"); }
    else if (/暂停/.test(text)) { setIsPlaying(false); setAssistantReply("已暂停播放。"); }
    else if (/播放|开始/.test(text)) { setIsPlaying(true); setAssistantReply(`已从第 ${measure} 小节开始播放。`); }
    else if (/只播放|单独播放/.test(text)) {
      const group = groups.find((key) => text.includes(groupMeta[key].name.replace("组", "")));
      if (group) { setSoloGroup(group); setAssistantReply(`已独奏${groupMeta[group].name}，其他声部暂时静音。`); } else setAssistantReply("我没有识别出乐器组，请尝试“只播放木管组”。");
    } else if (/静音/.test(text)) {
      const group = groups.find((key) => text.includes(groupMeta[key].name.replace("组", "")));
      if (group) { setMutedGroups((current) => [...new Set([...current, group])]); setAssistantReply(`已静音${groupMeta[group].name}。`); } else setAssistantReply("请说明需要静音的乐器组。");
    } else if (/第\s*(\d+)\s*小节/.test(text)) {
      const number = Number(text.match(/第\s*(\d+)\s*小节/)?.[1]); jumpTo(number); setAssistantReply(`已定位到第 ${Math.max(1, Math.min(MAX_MEASURE, number))} 小节。`);
    } else if (/速度.*?(\d+)/.test(text)) {
      const number = Math.max(50, Math.min(150, Number(text.match(/速度.*?(\d+)/)?.[1]))); setSpeed(number); setAssistantReply(`播放速度已调整为 ${number}%。`);
    } else if (/分析|为什么|织体/.test(text)) setAssistantReply(`第 ${measure} 小节为“${analysis.density}”织体。${analysis.detail} 这是规则估算结果，建议结合实际音源试听确认。`);
    else setAssistantReply("我暂时只能处理播放、跳转、速度、声部独奏/静音和当前小节分析。");
    setCommand("");
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["xml","musicxml","mxl","mid","midi"].includes(extension)) { setImportMessage("暂不支持该格式；请导入 MusicXML、MXL 或 MIDI"); return; }
    if (["xml","musicxml"].includes(extension)) {
      const text = await file.text(); const title = text.match(/<work-title>(.*?)<\/work-title>/s)?.[1]?.replace(/<[^>]+>/g, "").trim();
      setProjectName(title || file.name.replace(/\.[^.]+$/, "")); setImportMessage("已读取 MusicXML 元数据；当前原型使用演示音序驱动三维舞台");
    } else { setProjectName(file.name.replace(/\.[^.]+$/, "")); setImportMessage("已载入文件；MIDI 音符映射将在下一阶段启用"); }
  };

  const groupBalance: Record<InstrumentGroup, number> = { woodwinds: measure <= 8 && measure >= 5 ? 76 : 42, brass: measure >= 9 && measure <= 20 ? 88 : 35, percussion: measure >= 13 && measure <= 20 ? 73 : 18, strings: measure <= 20 ? 82 : 61 };

  return <main className="min-h-screen min-w-[320px] bg-transparent text-foreground">
    <header className="flex h-16 items-center justify-between border-b border-border/80 bg-[#090d15]/95 px-4 backdrop-blur-xl lg:px-6">
      <div className="flex min-w-0 items-center gap-3"><div className="grid size-9 place-items-center rounded-lg border border-primary/35 bg-primary/10 text-primary"><AudioLines className="size-5" /></div><div className="min-w-0"><h1 className="truncate text-base font-semibold tracking-wide">三维智能管弦乐配器教学系统</h1><p className="truncate text-xs text-muted-foreground">3D Intelligent Orchestration Lab</p></div></div>
      <div className="flex items-center gap-2"><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-secondary/60 px-3 text-sm hover:bg-secondary"><Upload className="size-4" /><span className="hidden sm:inline">导入乐谱</span><input type="file" accept=".xml,.musicxml,.mxl,.mid,.midi" onChange={handleImport} className="sr-only" /></label><Button variant="outline" className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/15"><BookOpen />教学模式</Button></div>
    </header>
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 xl:grid-cols-[250px_minmax(520px,1fr)_330px]">
      <aside className="glass-panel order-2 border-r border-border/80 p-4 xl:order-1">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">乐队编制</p><p className="text-xs text-muted-foreground">15 个演奏席位</p></div><Search className="size-4 text-muted-foreground" /></div>
        <div className="space-y-4">{groups.map((group) => {
          const meta = groupMeta[group], isSolo = soloGroup === group, isMuted = mutedGroups.includes(group);
          return <section key={group}><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: meta.color }} /><h2 className="text-sm font-medium">{meta.name}</h2></div><div className="flex gap-1"><button onClick={() => setSoloGroup(isSolo ? null : group)} className={`rounded px-2 py-1 text-xs ${isSolo ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`} aria-label={`独奏${meta.name}`}>S</button><button onClick={() => toggleMute(group)} className={`rounded px-2 py-1 text-xs ${isMuted ? "bg-destructive/80 text-white" : "bg-secondary text-muted-foreground"}`} aria-label={`静音${meta.name}`}>M</button></div></div><div className="space-y-1">{instruments.filter((item) => item.group === group).map((item) => { const active = activeIds.includes(item.id); return <button key={item.id} onClick={() => setSelectedId(item.id)} className={`flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-sm transition ${selectedId === item.id ? "border-primary/50 bg-primary/10" : "border-transparent hover:bg-white/[.04]"}`}><span className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${active ? "pulse-gold" : "opacity-30"}`} style={{ background: active ? meta.color : "#7d8695" }} />{item.name}</span><span className="text-xs text-muted-foreground">{active ? "演奏中" : item.short}</span></button>; })}</div></section>;
        })}</div>
      </aside>

      <section className="order-1 flex min-w-0 flex-col xl:order-2">
        <div className="border-b border-border/70 px-4 py-3 lg:px-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2"><FileMusic className="size-4 text-primary" /><h2 className="font-semibold">{projectName}</h2><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">方案 A</span></div><p className="mt-1 text-xs text-muted-foreground">{importMessage}</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="rounded border border-border px-2 py-1">4/4</span><span className="rounded border border-border px-2 py-1">♩ = {Math.round(88 * speed / 100)}</span><span className="rounded border border-border px-2 py-1">第 {measure} / {MAX_MEASURE} 小节</span></div></div></div>
        <div className="relative min-h-[430px] flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(78,111,154,.18),transparent_55%)]"><OrchestraScene activeIds={activeIds} mutedIds={mutedIds} selectedId={selectedId} onSelect={selectInstrument} /><div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-border/80 bg-[#0c111a]/80 px-3 py-2 backdrop-blur"><p className="text-xs text-muted-foreground">当前织体</p><p className="mt-0.5 font-medium">{analysis.density} · {activeIds.length} 个声部</p></div><div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3 rounded-full border border-border/80 bg-[#0c111a]/80 px-4 py-2 text-xs text-muted-foreground backdrop-blur">拖动旋转 · 滚轮缩放 · 点击乐器查看</div></div>
        <div className="border-t border-border/80 bg-[#0b1018] p-4"><div className="mb-3 flex items-center gap-3"><Button size="icon-sm" variant="ghost" onClick={() => jumpTo(measure - 1)} aria-label="上一小节"><ChevronLeft /></Button><Button size="icon" onClick={() => setIsPlaying(!isPlaying)} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" aria-label={isPlaying ? "暂停" : "播放"}>{isPlaying ? <Pause /> : <Play className="ml-0.5" />}</Button><Button size="icon-sm" variant="ghost" onClick={() => { setIsPlaying(false); jumpTo(1); }} aria-label="停止"><Square /></Button><Button size="icon-sm" variant="ghost" onClick={() => jumpTo(measure + 1)} aria-label="下一小节"><ChevronRight /></Button><div className="min-w-24 flex-1"><Progress value={((measure - 1 + measureProgress / 100) / MAX_MEASURE) * 100} className="h-1.5 bg-secondary [&_[data-slot=progress-indicator]]:bg-primary" /></div><span className="w-16 text-right text-xs text-muted-foreground">{measure}:1</span><Volume2 className="size-4 text-muted-foreground" /><div className="w-20"><Slider value={[volume]} onValueChange={(value) => setVolume(value[0])} max={100} step={1} className="[&_[data-slot=slider-range]]:bg-primary" /></div></div><div className="mb-3 flex items-center gap-3 text-xs"><span className="text-muted-foreground">速度</span><div className="w-32"><Slider value={[speed]} onValueChange={(value) => setSpeed(value[0])} min={50} max={150} step={5} /></div><span className="w-10 text-primary">{speed}%</span><button onClick={() => setSpeed(100)} className="text-muted-foreground hover:text-foreground"><RotateCcw className="size-3.5" /></button></div><ScoreStrip measure={measure} onSelect={jumpTo} /></div>
      </section>

      <aside className="glass-panel order-3 border-l border-border/80 p-4">
        <Tabs defaultValue="info" className="h-full"><TabsList variant="line" className="grid w-full grid-cols-4 border-b border-border pb-2"><TabsTrigger value="info" aria-label="乐器信息"><Info /></TabsTrigger><TabsTrigger value="analysis" aria-label="配器分析"><Activity /></TabsTrigger><TabsTrigger value="balance" aria-label="力度平衡"><Gauge /></TabsTrigger><TabsTrigger value="assistant" aria-label="智能助手"><Sparkles /></TabsTrigger></TabsList>
          <TabsContent value="info" className="pt-4"><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-medium" style={{ color: groupMeta[selected.group].color }}>{groupMeta[selected.group].name}</p><h2 className="mt-1 text-xl font-semibold">{selected.name}</h2><p className="text-sm text-muted-foreground">{selected.english}</p></div><span className="rounded-lg px-2 py-1 text-xs" style={{ background: groupMeta[selected.group].soft, color: groupMeta[selected.group].color }}>{selected.short}</span></div><dl className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-white/[.035] p-3"><dt className="text-xs text-muted-foreground">实际音域</dt><dd className="mt-1 font-medium">{selected.range}</dd></div><div className="rounded-lg bg-white/[.035] p-3"><dt className="text-xs text-muted-foreground">常用音域</dt><dd className="mt-1 font-medium">{selected.commonRange}</dd></div></dl><div className="mt-3 space-y-3 rounded-lg border border-border/70 p-3 text-sm"><div><p className="text-xs text-muted-foreground">移调关系</p><p className="mt-1">{selected.transposition}</p></div><div><p className="text-xs text-muted-foreground">音色特点</p><p className="mt-1 leading-6">{selected.character}</p></div><div><p className="text-xs text-muted-foreground">常用演奏法</p><p className="mt-1 leading-6">{selected.technique}</p></div></div><div className="mt-3 flex gap-2 rounded-lg border border-primary/20 bg-primary/[.06] p-3 text-sm leading-6"><CircleAlert className="mt-1 size-4 shrink-0 text-primary" /><p>{selected.note}</p></div></TabsContent>
          <TabsContent value="analysis" className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">第 {measure} 小节</p><h2 className="mt-1 text-lg font-semibold">{analysis.alert}</h2></div><div className="grid size-14 place-items-center rounded-full border-4 border-primary/25 text-sm font-semibold text-primary">{analysis.score}</div></div><div className="mt-4 rounded-lg border border-border bg-white/[.03] p-4"><div className="mb-2 flex items-center gap-2"><Layers3 className="size-4 text-primary" /><p className="font-medium">织体：{analysis.density}</p></div><p className="text-sm leading-6 text-muted-foreground">{analysis.detail}</p></div><div className="mt-4"><p className="mb-3 text-sm font-medium">规则提示</p><ul className="space-y-2 text-sm text-muted-foreground"><li className="rounded-md bg-white/[.03] p-3">• 第17–20小节：铜管与弦乐旋律可能发生中音区竞争。</li><li className="rounded-md bg-white/[.03] p-3">• 第28小节：低音提琴、大号、定音鼓形成低频叠加。</li><li className="rounded-md bg-white/[.03] p-3">• 小号高音区强奏具有明显穿透力，建议试听确认平衡。</li></ul></div></TabsContent>
          <TabsContent value="balance" className="pt-4"><h2 className="text-lg font-semibold">乐器组相对强度</h2><p className="mt-1 text-sm text-muted-foreground">基于当前小节的声部数、力度与音区估算</p><div className="mt-6 space-y-5">{groups.map((group) => <div key={group}><div className="mb-2 flex justify-between text-sm"><span>{groupMeta[group].name}</span><span style={{ color: groupMeta[group].color }}>{groupBalance[group]}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full transition-all" style={{ width: `${groupBalance[group]}%`, background: groupMeta[group].color }} /></div></div>)}</div><p className="mt-6 rounded-lg border border-border p-3 text-sm leading-6 text-muted-foreground">该图仅用于教学比较，不等同于真实声压测量。最终判断应结合乐器数量、奏法、空间与实际音源。</p></TabsContent>
          <TabsContent value="assistant" className="pt-4"><div className="mb-4 flex items-center gap-2"><div className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-4" /></div><div><h2 className="font-semibold">智能指挥助手</h2><p className="text-xs text-muted-foreground">文字命令已启用</p></div></div><div className="min-h-36 rounded-lg border border-border bg-black/15 p-4 text-sm leading-6 text-slate-300">{assistantReply}</div><div className="mt-3 flex gap-2"><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => event.key === "Enter" && executeCommand()} placeholder="输入播放或分析指令…" className="min-w-0 flex-1 rounded-md border border-input bg-black/20 px-3 text-sm outline-none focus:border-primary" /><Button size="icon" variant="outline" aria-label="语音输入尚未启用" title="当前浏览器版暂未启用语音识别"><Mic /></Button><Button onClick={executeCommand}>执行</Button></div><div className="mt-4 flex flex-wrap gap-2">{["只播放木管组","从第17小节开始","分析这一段","恢复所有声部"].map((sample) => <button key={sample} onClick={() => setCommand(sample)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary">{sample}</button>)}</div></TabsContent>
        </Tabs>
      </aside>
    </div>
  </main>;
}
