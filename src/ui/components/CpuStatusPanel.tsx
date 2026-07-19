import { AlertTriangle, Cpu, Power } from "lucide-react";
import { CpuExecutionState, InterruptKind } from "../../domain";
import { useSimulationStore } from "../../store/simulationStore";

const cpuStateLabels: Record<CpuExecutionState, string> = {
  [CpuExecutionState.Running]: "RUNNING",
  [CpuExecutionState.InterruptPending]: "INTERRUPT_PENDING",
  [CpuExecutionState.Acknowledging]: "ACKNOWLEDGING",
  [CpuExecutionState.SavingContext]: "SAVING_CONTEXT",
  [CpuExecutionState.ExecutingIsr]: "EXECUTING_ISR",
  [CpuExecutionState.WaitingForEoi]: "WAITING_FOR_EOI",
  [CpuExecutionState.RestoringContext]: "RESTORING_CONTEXT",
  [CpuExecutionState.Returning]: "RETURNING",
  [CpuExecutionState.Halted]: "HALTED",
};

export function CpuStatusPanel() {
  const snapshot = useSimulationStore((state) => state.snapshot);
  const setGlobalInterruptsEnabled = useSimulationStore((state) => state.setGlobalInterruptsEnabled);
  const createNonMaskableInterrupt = useSimulationStore((state) => state.createNonMaskableInterrupt);

  const activeInterruptLabel = snapshot.activeInterrupt?.label ?? "Yok";
  const activeIsrLabel =
    snapshot.activeInterrupt?.kind === InterruptKind.Maskable
      ? snapshot.activeInterrupt.label
      : snapshot.activeInterrupt?.kind === InterruptKind.NonMaskable
        ? "NMI"
        : "Yok";

  return (
    <section className="rounded-lg border border-lab-line bg-lab-panel p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-lab-muted">
            <Cpu size={18} aria-hidden="true" />
            CPU Durumu
          </div>
          <h1 className="break-words text-3xl font-bold tracking-normal text-white">
            {cpuStateLabels[snapshot.cpu.executionState]}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGlobalInterruptsEnabled(!snapshot.cpu.interruptsEnabled)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-lab-line bg-lab-panelSoft px-3 text-sm font-semibold transition hover:border-lab-cyan"
          >
            <Power size={18} aria-hidden="true" />
            IF {snapshot.cpu.interruptsEnabled ? "Açık" : "Kapalı"}
          </button>
          <button
            type="button"
            onClick={createNonMaskableInterrupt}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-lab-red/70 bg-lab-red/10 px-3 text-sm font-semibold text-lab-red transition hover:border-lab-red"
          >
            <AlertTriangle size={18} aria-hidden="true" />
            NMI Oluştur
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatusTile label="Aktif kesme" value={activeInterruptLabel} />
        <StatusTile label="Aktif ISR" value={activeIsrLabel} />
        <StatusTile label="NMI bekleme" value={snapshot.pendingNmi ? "Var" : "Yok"} />
      </div>
    </section>
  );
}

interface StatusTileProps {
  readonly label: string;
  readonly value: string;
}

function StatusTile({ label, value }: StatusTileProps) {
  return (
    <div className="min-h-20 rounded-md border border-lab-line bg-lab-panelSoft p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-lab-muted">{label}</div>
      <div className="mt-2 break-words text-base font-semibold text-white">{value}</div>
    </div>
  );
}
