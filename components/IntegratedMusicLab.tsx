"use client";

import { useEffect, useState } from "react";
import { AudioLines, Headphones, Orbit } from "lucide-react";
import { OrchestrationLab } from "@/components/orchestra-lab/OrchestrationLab";

type ModuleId = "orchestra" | "timbre";

function moduleFromHash(): ModuleId {
  if (typeof window === "undefined") return "orchestra";
  return window.location.hash === "#timbre" ? "timbre" : "orchestra";
}

export function IntegratedMusicLab() {
  const [activeModule, setActiveModule] = useState<ModuleId>("orchestra");
  const [hasOpenedTimbre, setHasOpenedTimbre] = useState(false);

  useEffect(() => {
    const syncFromHash = () => {
      const next = moduleFromHash();
      setActiveModule(next);
      if (next === "timbre") setHasOpenedTimbre(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const openModule = (module: ModuleId) => {
    setActiveModule(module);
    if (module === "timbre") setHasOpenedTimbre(true);
    const hash = module === "timbre" ? "#timbre" : "#orchestra";
    window.history.replaceState(null, "", hash);
  };

  return (
    <main className="min-h-screen min-w-[320px] bg-[#080b12] text-foreground">
      <header className="sticky top-0 z-50 flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#070a10]/95 px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,.3)] backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/35 bg-primary/10 text-primary shadow-[inset_0_1px_rgba(255,255,255,.08)]">
            <AudioLines className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[.12em] text-slate-100 sm:text-base">华音 · 双轨音乐实验室</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">民族音色认知 × 三维智能配器</p>
          </div>
        </div>

        <nav className="grid min-w-full grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[.035] p-1 sm:min-w-0" aria-label="实验室模块">
          <button
            type="button"
            onClick={() => openModule("timbre")}
            aria-pressed={activeModule === "timbre"}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition ${activeModule === "timbre" ? "bg-[#f2ead8] text-[#173a2b] shadow-sm" : "text-slate-300 hover:bg-white/[.06] hover:text-white"}`}
          >
            <Headphones className="size-4" />
            民族音色实验室
          </button>
          <button
            type="button"
            onClick={() => openModule("orchestra")}
            aria-pressed={activeModule === "orchestra"}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition ${activeModule === "orchestra" ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-300 hover:bg-white/[.06] hover:text-white"}`}
          >
            <Orbit className="size-4" />
            智能配器实验室
          </button>
        </nav>
      </header>

      <section hidden={activeModule !== "orchestra"} aria-label="智能配器实验室">
        <OrchestrationLab />
      </section>

      {hasOpenedTimbre && (
        <section hidden={activeModule !== "timbre"} aria-label="民族音色实验室" className="bg-[#f4efe4]">
          <iframe
            title="听见中国民族乐器音色实验室"
            src="./tingjian/index.html"
            allow="autoplay"
            className="block h-[calc(100svh-72px)] min-h-[640px] w-full border-0 bg-[#f4efe4]"
          />
        </section>
      )}
    </main>
  );
}
