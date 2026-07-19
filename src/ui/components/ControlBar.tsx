import { Pause, Play, RotateCcw, Send, StepForward } from "lucide-react";
import { CpuExecutionState } from "../../domain";
import { useSimulationStore } from "../../store/simulationStore";

export function ControlBar() {
  const snapshot = useSimulationStore((state) => state.snapshot);
  const isAutoRunning = useSimulationStore((state) => state.isAutoRunning);
  const step = useSimulationStore((state) => state.step);
  const setAutoRunning = useSimulationStore((state) => state.setAutoRunning);
  const sendEndOfInterrupt = useSimulationStore((state) => state.sendEndOfInterrupt);
  const reset = useSimulationStore((state) => state.reset);

  const isWaitingForEoi = snapshot.cpu.executionState === CpuExecutionState.WaitingForEoi;

  return (
    <footer className="border-t border-lab-line bg-lab-panel px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={step}
            aria-label="Simülasyonu bir adım ilerlet"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-lab-line bg-lab-panelSoft px-4 text-sm font-semibold text-lab-text transition hover:border-lab-cyan hover:text-white"
          >
            <StepForward size={18} aria-hidden="true" />
            Step
          </button>
          <button
            type="button"
            onClick={() => setAutoRunning(true)}
            disabled={isAutoRunning}
            aria-label="Otomatik çalıştır"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-lab-line bg-lab-panelSoft px-4 text-sm font-semibold text-lab-green transition hover:border-lab-green disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Play size={18} aria-hidden="true" />
            Auto
          </button>
          <button
            type="button"
            onClick={() => setAutoRunning(false)}
            disabled={!isAutoRunning}
            aria-label="Otomatik çalışmayı duraklat"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-lab-line bg-lab-panelSoft px-4 text-sm font-semibold text-lab-amber transition hover:border-lab-amber disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Pause size={18} aria-hidden="true" />
            Pause
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={sendEndOfInterrupt}
            disabled={!isWaitingForEoi}
            aria-label="End of Interrupt gönder"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-lab-line bg-lab-panelSoft px-4 text-sm font-semibold text-lab-cyan transition hover:border-lab-cyan disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Send size={18} aria-hidden="true" />
            EOI
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="Simülasyonu sıfırla"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-lab-line bg-lab-panelSoft px-4 text-sm font-semibold text-lab-red transition hover:border-lab-red"
          >
            <RotateCcw size={18} aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>
    </footer>
  );
}
