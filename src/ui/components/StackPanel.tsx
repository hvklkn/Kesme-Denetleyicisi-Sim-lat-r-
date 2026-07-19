import { Layers3 } from "lucide-react";
import { InterruptKind } from "../../domain";
import { useSimulationStore } from "../../store/simulationStore";
import { formatAddressAsHex } from "../../utils/registerFormatters";

export function StackPanel() {
  const snapshot = useSimulationStore((state) => state.snapshot);
  const contextEntries = [...snapshot.contextStack].reverse();
  const pausedIsrs = [...snapshot.activeIsrStack].reverse();

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-lg border border-lab-line bg-lab-panel p-4 shadow-2xl shadow-black/20">
        <div className="mb-4 flex items-center gap-2">
          <Layers3 size={18} aria-hidden="true" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-lab-muted">CPU Context Stack</h2>
        </div>

        {contextEntries.length === 0 ? (
          <div className="rounded-md border border-dashed border-lab-line p-4 text-sm text-lab-muted" data-testid="context-stack-empty">
            Stack boş
          </div>
        ) : (
          <div className="space-y-2" data-testid="context-stack">
            {contextEntries.map((entry, index) => (
              <article
                key={entry.id}
                className={
                  index === 0
                    ? "rounded-md border border-lab-cyan bg-lab-cyan/10 p-3"
                    : "rounded-md border border-lab-line bg-lab-panelSoft p-3"
                }
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold text-white">{entry.interrupt.label}</div>
                    <div className="mt-1 text-xs text-lab-muted">
                      {entry.interrupt.kind === InterruptKind.NonMaskable ? "NMI" : `IRQ${entry.interrupt.line}`}
                    </div>
                  </div>
                  <span className="rounded border border-lab-line px-2 py-1 font-mono text-xs text-lab-cyan">
                    Depth {entry.stackDepth}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                  <StackMetric label="PC" value={formatAddressAsHex(entry.frame.registers.pc)} />
                  <StackMetric label="SP" value={formatAddressAsHex(entry.frame.registers.sp)} />
                  <StackMetric label="FLAGS" value={formatAddressAsHex(entry.frame.registers.flags)} />
                  <StackMetric label="Vector" value={formatAddressAsHex(entry.interrupt.vectorAddress, 2)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-lab-line bg-lab-panel p-4 shadow-2xl shadow-black/20">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-lab-muted">Aktif ISR Stack</h2>
        {pausedIsrs.length === 0 ? (
          <div className="rounded-md border border-dashed border-lab-line p-4 text-sm text-lab-muted">Duraklatılmış ISR yok</div>
        ) : (
          <div className="space-y-2" data-testid="active-isr-stack">
            {pausedIsrs.map((isr, index) => (
              <div
                key={`${isr.interrupt.label}-${index}`}
                className={index === 0 ? "rounded-md border border-lab-green bg-lab-green/10 p-3" : "rounded-md border border-lab-line bg-lab-panelSoft p-3"}
              >
                <div className="text-sm font-semibold text-white">{isr.interrupt.label}</div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-lab-bg">
                  <div className="h-full bg-lab-green" style={{ width: `${isr.progressPercentage}%` }} />
                </div>
                <div className="mt-2 text-xs text-lab-muted">
                  Kalan: <span className="font-mono text-lab-text">{isr.remainingCycles}</span> cycle
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface StackMetricProps {
  readonly label: string;
  readonly value: string;
}

function StackMetric({ label, value }: StackMetricProps) {
  return (
    <div className="min-w-0 rounded border border-lab-line bg-lab-bg px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-lab-muted">{label}</div>
      <div className="truncate font-mono font-semibold text-lab-text">{value}</div>
    </div>
  );
}
