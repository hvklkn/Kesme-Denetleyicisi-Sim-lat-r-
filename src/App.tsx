import { useEffect } from "react";
import { DEFAULT_AUTO_STEP_INTERVAL_MS } from "./domain";
import { useSimulationStore } from "./store/simulationStore";
import { ControlBar } from "./ui/components/ControlBar";
import { CpuStatusPanel } from "./ui/components/CpuStatusPanel";
import { EventLogPanel } from "./ui/components/EventLogPanel";
import { InterruptTimeline } from "./ui/components/InterruptTimeline";
import { IrqControlPanel } from "./ui/components/IrqControlPanel";
import { RegisterCard } from "./ui/components/RegisterCard";
import { SignalFlowDiagram } from "./ui/components/SignalFlowDiagram";
import { StackPanel } from "./ui/components/StackPanel";

export function App() {
  const snapshot = useSimulationStore((state) => state.snapshot);
  const isAutoRunning = useSimulationStore((state) => state.isAutoRunning);
  const runAutomaticStep = useSimulationStore((state) => state.runAutomaticStep);

  useEffect(() => {
    if (!isAutoRunning) {
      return undefined;
    }

    const intervalId = window.setInterval(runAutomaticStep, DEFAULT_AUTO_STEP_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isAutoRunning, runAutomaticStep]);

  return (
    <main className="grid h-screen grid-rows-[1fr_auto] bg-lab-bg text-lab-text">
      <section className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[320px_minmax(0,1fr)_380px] xl:overflow-hidden">
        <IrqControlPanel />

        <div className="min-w-0 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
          <CpuStatusPanel />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <RegisterCard label="IRR" value={snapshot.registers.irr} accent="cyan" />
            <RegisterCard label="IMR" value={snapshot.registers.imr} accent="amber" />
            <RegisterCard label="ISR" value={snapshot.registers.isr} accent="green" />
          </div>
          <SignalFlowDiagram />
          <StackPanel />
          <InterruptTimeline />
        </div>

        <EventLogPanel />
      </section>
      <ControlBar />
    </main>
  );
}
