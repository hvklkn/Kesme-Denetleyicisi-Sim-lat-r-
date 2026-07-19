import { AlertTriangle, Cpu, Layers, Power } from "lucide-react";
import { CpuExecutionState, InterruptKind } from "../../domain";
import { useSimulationStore } from "../../store/simulationStore";
import { formatAddressAsHex } from "../../utils/registerFormatters";

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
  const setNestedInterruptsEnabled = useSimulationStore((state) => state.setNestedInterruptsEnabled);
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
            onClick={() => setNestedInterruptsEnabled(!snapshot.nestedInterruptsEnabled)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-lab-line bg-lab-panelSoft px-3 text-sm font-semibold transition hover:border-lab-green"
            aria-pressed={snapshot.nestedInterruptsEnabled}
          >
            <Layers size={18} aria-hidden="true" />
            İç İçe {snapshot.nestedInterruptsEnabled ? "Açık" : "Kapalı"}
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

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-md border border-lab-line bg-lab-panelSoft p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-lab-muted">Aktif ISR Progress</div>
              <div className="mt-1 text-sm font-semibold text-white" data-testid="active-isr-cycle">
                {snapshot.activeIsr
                  ? `${snapshot.activeIsr.elapsedCycles}/${snapshot.activeIsr.totalCycles} cycle`
                  : "ISR yok"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-lab-muted">Vector</div>
              <div className="mt-1 font-mono text-sm font-semibold text-lab-cyan" data-testid="active-vector">
                {snapshot.activeIsr ? formatAddressAsHex(snapshot.activeIsr.vectorAddress, 2) : "-"}
              </div>
            </div>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-lab-line bg-lab-bg">
            <div
              className="h-full rounded-full bg-lab-green transition-all duration-300"
              style={{ width: `${snapshot.activeIsr?.progressPercentage ?? 0}%` }}
              data-testid="active-isr-progress"
            />
          </div>
          <div className="mt-2 text-xs text-lab-muted">
            Kalan cycle: <span className="font-mono text-lab-text">{snapshot.activeIsr?.remainingCycles ?? 0}</span>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2 rounded-md border border-lab-line bg-lab-panelSoft p-3">
          <RegisterValue label="PC" value={snapshot.cpuRegisters.pc} />
          <RegisterValue label="SP" value={snapshot.cpuRegisters.sp} />
          <RegisterValue label="FLAGS" value={snapshot.cpuRegisters.flags} />
          <RegisterValue label="ACC" value={snapshot.cpuRegisters.acc} />
          <RegisterValue label="R1" value={snapshot.cpuRegisters.r1} />
          <RegisterValue label="R2" value={snapshot.cpuRegisters.r2} />
          <RegisterValue label="R3" value={snapshot.cpuRegisters.r3} />
        </section>
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

interface RegisterValueProps {
  readonly label: string;
  readonly value: number;
}

function RegisterValue({ label, value }: RegisterValueProps) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-lab-muted">{label}</div>
      <div className="truncate font-mono text-sm font-semibold text-white">{formatAddressAsHex(value)}</div>
    </div>
  );
}
