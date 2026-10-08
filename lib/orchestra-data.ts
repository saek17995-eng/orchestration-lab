export type InstrumentGroup = "woodwinds" | "brass" | "percussion" | "strings";

export type Instrument = {
  id: string; name: string; english: string; group: InstrumentGroup; short: string;
  range: string; commonRange: string; transposition: string; character: string;
  technique: string; note: string; position: [number, number, number];
};

export const groupMeta: Record<InstrumentGroup, { name: string; color: string; soft: string }> = {
  woodwinds: { name: "木管组", color: "#55d6be", soft: "rgba(85,214,190,.14)" },
  brass: { name: "铜管组", color: "#d8aa5d", soft: "rgba(216,170,93,.14)" },
  percussion: { name: "打击乐组", color: "#ff7b64", soft: "rgba(255,123,100,.14)" },
  strings: { name: "弦乐组", color: "#8e7dff", soft: "rgba(142,125,255,.14)" },
};

export const instrumentVisualMeta: Record<string, { color: string; players: number }> = {
  violin1: { color: "#c4b5fd", players: 10 },
  violin2: { color: "#a78bfa", players: 8 },
  viola: { color: "#8b5cf6", players: 6 },
  cello: { color: "#6d28d9", players: 6 },
  bass: { color: "#4c1d95", players: 4 },
  flute: { color: "#7ce7d3", players: 2 },
  oboe: { color: "#62dcc5", players: 2 },
  clarinet: { color: "#45cbb2", players: 2 },
  bassoon: { color: "#2daf98", players: 2 },
  horn: { color: "#f1c96f", players: 4 },
  trumpet: { color: "#e9b951", players: 2 },
  trombone: { color: "#dca13d", players: 3 },
  tuba: { color: "#c98727", players: 1 },
  timpani: { color: "#ff927f", players: 2 },
  percussion: { color: "#f66b58", players: 3 },
};

export const instruments: Instrument[] = [
  { id:"flute", name:"长笛", english:"Flute", group:"woodwinds", short:"Fl.", range:"C4–D7", commonRange:"D4–C7", transposition:"非移调", character:"明亮、通透；高音区穿透力强。", technique:"连奏、吐音、颤音、泛音", note:"低音区易被厚重织体遮盖。", position:[-2.7,0,-1.5] },
  { id:"oboe", name:"双簧管", english:"Oboe", group:"woodwinds", short:"Ob.", range:"B♭3–A6", commonRange:"C4–G6", transposition:"非移调", character:"鼻音感鲜明，旋律辨识度高。", technique:"连奏、双吐、颤音", note:"弱奏仍有较强存在感。", position:[-.9,0,-1.7] },
  { id:"clarinet", name:"单簧管", english:"Clarinet in B♭", group:"woodwinds", short:"Cl.", range:"E3–C7", commonRange:"G3–G6", transposition:"B♭调，实际低大二度", character:"音域宽广，音区色彩变化明显。", technique:"快速音阶、琶音、连奏", note:"换区处需要注意音色衔接。", position:[.9,0,-1.7] },
  { id:"bassoon", name:"大管", english:"Bassoon", group:"woodwinds", short:"Bsn.", range:"B♭1–E5", commonRange:"C2–C5", transposition:"非移调", character:"低音浑厚，中音区富歌唱性。", technique:"断奏、连奏、低音持续", note:"极低音快速运动较困难。", position:[2.7,0,-1.5] },
  { id:"horn", name:"圆号", english:"Horn in F", group:"brass", short:"Hn.", range:"B1–F5", commonRange:"F2–D5", transposition:"F调，实际低纯五度", character:"温暖、融合性强，是木管与铜管间的桥梁。", technique:"闷音、阻塞音、连奏", note:"高音强奏消耗大，需考虑休息。", position:[-2.5,0,-3.3] },
  { id:"trumpet", name:"小号", english:"Trumpet in B♭", group:"brass", short:"Tpt.", range:"F♯3–D6", commonRange:"G3–C6", transposition:"B♭调，实际低大二度", character:"明亮、辉煌，强奏穿透力突出。", technique:"吐音、弱音器、震音", note:"持续高音强奏可能遮盖其他声部。", position:[-.8,0,-3.6] },
  { id:"trombone", name:"长号", english:"Trombone", group:"brass", short:"Tbn.", range:"E2–B♭4", commonRange:"G2–G4", transposition:"通常按实际音记谱", character:"雄厚庄严，和声支撑明确。", technique:"滑音、吐音、弱音器", note:"中低音区与人声重叠时需控制力度。", position:[.9,0,-3.6] },
  { id:"tuba", name:"大号", english:"Tuba", group:"brass", short:"Tba.", range:"D1–F4", commonRange:"F1–D4", transposition:"按实际音记谱", character:"深厚、宽广，建立铜管低音基础。", technique:"持续低音、断奏、重音", note:"与低音提琴同区齐奏会迅速增厚织体。", position:[2.6,0,-3.3] },
  { id:"timpani", name:"定音鼓", english:"Timpani", group:"percussion", short:"Tmp.", range:"D2–A3", commonRange:"F2–F3", transposition:"按实际音记谱", character:"既有明确音高，也具强烈结构推动力。", technique:"滚奏、单击、弱音", note:"强奏会显著提升低频能量。", position:[-1.7,0,-5.2] },
  { id:"percussion", name:"打击乐", english:"Percussion", group:"percussion", short:"Perc.", range:"视乐器而定", commonRange:"—", transposition:"视乐器而定", character:"塑造节奏、色彩和高潮层次。", technique:"滚奏、击奏、刮奏", note:"应避免持续占据所有高潮空间。", position:[1.5,0,-5.1] },
  { id:"violin1", name:"第一小提琴", english:"Violin I", group:"strings", short:"Vln. I", range:"G3–E7", commonRange:"G3–B6", transposition:"非移调", character:"明亮灵活，常承担主旋律。", technique:"连弓、跳弓、拨弦、泛音", note:"高音旋律需要足够弓段与呼吸。", position:[-4.4,0,1.4] },
  { id:"violin2", name:"第二小提琴", english:"Violin II", group:"strings", short:"Vln. II", range:"G3–E7", commonRange:"G3–B6", transposition:"非移调", character:"连接旋律与中声部，适合对位和填充。", technique:"连弓、分弓、拨弦", note:"与第一小提琴同区时需明确层次。", position:[-2.4,0,1.9] },
  { id:"viola", name:"中提琴", english:"Viola", group:"strings", short:"Vla.", range:"C3–E6", commonRange:"C3–C6", transposition:"非移调", character:"温暖、含蓄，中音区融合性好。", technique:"连弓、拨弦、双音", note:"中音区密集时容易失去清晰度。", position:[2.3,0,1.9] },
  { id:"cello", name:"大提琴", english:"Violoncello", group:"strings", short:"Vc.", range:"C2–C6", commonRange:"C2–A5", transposition:"非移调", character:"宽广且富歌唱性，可承担旋律或低音。", technique:"连弓、拨弦、拇指把位", note:"高音旋律与低音支撑不可同时过重。", position:[4.2,0,1.3] },
  { id:"bass", name:"低音提琴", english:"Double Bass", group:"strings", short:"Cb.", range:"E1–C5", commonRange:"E1–G4", transposition:"实际音低八度", character:"提供管弦乐队的低频基础和方向感。", technique:"弓奏、拨弦、泛音", note:"低音区密集排列会产生浑浊感。", position:[4.8,0,-.6] },
];

export const activeForMeasure = (measure: number): string[] => {
  if (measure <= 4) return ["violin1","violin2","viola","cello","bass"];
  if (measure <= 8) return ["flute","oboe","clarinet","bassoon","viola","cello"];
  if (measure <= 12) return ["violin1","violin2","horn","trumpet","trombone","tuba"];
  if (measure <= 16) return ["timpani","percussion","violin1","violin2","viola","cello","bass"];
  if (measure <= 20) return instruments.map((item) => item.id);
  if (measure <= 24) return ["flute","clarinet","horn","violin1","violin2","cello"];
  if (measure <= 28) return ["trumpet","trombone","tuba","timpani","cello","bass"];
  return ["flute","oboe","clarinet","bassoon","horn","violin1","violin2","viola","cello","bass"];
};

export const analysisAt = (measure: number) => {
  if (measure >= 17 && measure <= 20) return { density: "高度密集", score: 91, alert: "中音区拥挤", detail: "14个声部同时发声，铜管强奏与弦乐旋律处于相近音区。" };
  if (measure >= 27 && measure <= 29) return { density: "密集", score: 78, alert: "低音区过密", detail: "大号、低音提琴与定音鼓共同强化低频，清晰度可能下降。" };
  if (measure >= 9 && measure <= 12) return { density: "适中", score: 64, alert: "关注平衡", detail: "小号进入后穿透力上升，建议试听确认第一小提琴旋律是否清楚。" };
  return { density: "适中", score: 48, alert: "结构清晰", detail: "主旋律与伴奏层次分明，目前未发现明显音域冲突。" };
};
