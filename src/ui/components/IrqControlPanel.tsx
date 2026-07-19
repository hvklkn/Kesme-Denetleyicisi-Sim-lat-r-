import { Lock, Shield, ShieldOff, Zap } from "lucide-react";
import { PRIORITY_DISPLAY_OFFSET } from "../../domain";
import { isRegisterBitSet } from "../../domain/registers";
import { useSimulationStore } from "../../store/simulationStore";
import { formatAddressAsHex } from "../../utils/registerFormatters";

export function IrqControlPanel() {
  const snapshot = useSimulationStore((state) => state.snapshot);
  const createInterrupt = useSimulationStore((state) => state.createInterrupt);
  const toggleInterruptMask = useSimulationStore((state) => state.toggleInterruptMask);

  return (
    <aside className="min-h-0 overflow-y-auto rounded-lg border border-lab-line bg-lab-panel p-4 shadow-2xl shadow-black/20 scrollbar-thin">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-lab-muted">InterruptLab</p>
        <h2 className="text-xl font-bold tracking-normal text-white">IRQ Kontrol Paneli</h2>
      </div>

      <div className="space-y-3">
        {snapshot.interruptLines.map((line) => {
          const isMasked = isRegisterBitSet(snapshot.registers.imr, line.line);
          const isPending = isRegisterBitSet(snapshot.registers.irr, line.line);
          const isActive =
            snapshot.activeIsr?.interrupt.line === line.line ||
            snapshot.activeIsrStack.some((isr) => isr.interrupt.line === line.line);
          return (
            <section
              key={line.line}
              className={
                isActive
                  ? "rounded-md border border-lab-green bg-lab-green/10 p-3"
                  : isPending
                    ? "rounded-md border border-lab-amber bg-lab-amber/10 p-3"
                    : "rounded-md border border-lab-line bg-lab-panelSoft p-3"
              }
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                    IRQ{line.line}
                    {isMasked ? <Lock size={14} className="text-lab-red" aria-label="Maskeli IRQ" /> : null}
                  </h3>
                  <p className="break-words text-sm text-lab-muted">{line.label}</p>
                </div>
                <span className="shrink-0 rounded border border-lab-line px-2 py-1 text-xs font-semibold text-lab-cyan">
                  P{line.priority + PRIORITY_DISPLAY_OFFSET}
                </span>
              </div>

              <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                <span className="text-lab-muted">Mask</span>
                <span className={isMasked ? "font-semibold text-lab-amber" : "font-semibold text-lab-green"}>
                  {isMasked ? "Maskeli" : "Açık"}
                </span>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                <Metric label="Vector" value={formatAddressAsHex(line.vectorAddress, 2)} />
                <Metric label="Cycle" value={String(line.isrDurationCycles)} />
                <Metric label="Mode" value={line.triggerMode} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => toggleInterruptMask(line.line)}
                  aria-label={`IRQ${line.line} mask değiştir`}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-lab-line bg-lab-bg px-2 text-sm font-semibold transition hover:border-lab-amber"
                >
                  {isMasked ? <ShieldOff size={16} aria-hidden="true" /> : <Shield size={16} aria-hidden="true" />}
                  {isMasked ? "Aç" : "Maskele"}
                </button>
                <button
                  type="button"
                  onClick={() => createInterrupt(line.line)}
                  aria-label={`IRQ${line.line} kesme oluştur`}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-lab-cyan/70 bg-lab-cyan/10 px-2 text-sm font-semibold text-lab-cyan transition hover:border-lab-cyan"
                >
                  <Zap size={16} aria-hidden="true" />
                  Kesme Oluştur
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}

interface MetricProps {
  readonly label: string;
  readonly value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="min-w-0 rounded border border-lab-line bg-lab-bg px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-lab-muted">{label}</div>
      <div className="truncate font-mono font-semibold text-lab-text">{value}</div>
    </div>
  );
}
