import { Clock3 } from "lucide-react";
import { useSimulationStore } from "../../store/simulationStore";
import { formatAddressAsHex, formatRegisterAsHex } from "../../utils/registerFormatters";

export function InterruptTimeline() {
  const timeline = useSimulationStore((state) => state.snapshot.timeline);
  const newestCycle = timeline.at(-1)?.cycleNumber;

  return (
    <section className="rounded-lg border border-lab-line bg-lab-panel p-4 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock3 size={18} aria-hidden="true" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-lab-muted">Zaman Çizelgesi</h2>
        </div>
        <span className="text-xs text-lab-muted">Son 50 cycle</span>
      </div>

      {timeline.length === 0 ? (
        <div className="rounded-md border border-dashed border-lab-line p-4 text-sm text-lab-muted" data-testid="timeline-empty">
          Timeline boş
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto pr-1 scrollbar-thin" data-testid="interrupt-timeline">
          <ol className="space-y-2">
            {[...timeline].reverse().map((entry) => {
              const isActive = entry.cycleNumber === newestCycle;
              const title = `IRR ${formatRegisterAsHex(entry.irr)} | IMR ${formatRegisterAsHex(entry.imr)} | ISR ${formatRegisterAsHex(entry.isr)}`;
              return (
                <li
                  key={entry.cycleNumber}
                  title={title}
                  className={
                    isActive
                      ? "rounded-md border border-lab-cyan bg-lab-cyan/10 p-3"
                      : "rounded-md border border-lab-line bg-lab-panelSoft p-3"
                  }
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-white">Cycle {entry.cycleNumber}</span>
                    <span className="rounded border border-lab-line px-2 py-1 font-mono text-xs text-lab-muted">
                      {entry.cpuState}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-lab-text">{entry.description}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-lab-muted">
                    <span>{entry.activeInterrupt ?? "MAIN"}</span>
                    <span>{entry.activeVector === null ? "Vector -" : `Vector ${formatAddressAsHex(entry.activeVector, 2)}`}</span>
                    <span>IRR {formatRegisterAsHex(entry.irr)}</span>
                    <span>ISR {formatRegisterAsHex(entry.isr)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
