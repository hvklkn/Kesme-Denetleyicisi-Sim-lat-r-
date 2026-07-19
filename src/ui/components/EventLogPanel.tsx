import { ListTree } from "lucide-react";
import { useSimulationStore } from "../../store/simulationStore";

const eventTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function EventLogPanel() {
  const events = useSimulationStore((state) => state.snapshot.eventLog);
  const newestEvents = [...events].reverse();

  return (
    <aside className="flex min-h-0 flex-col rounded-lg border border-lab-line bg-lab-panel shadow-2xl shadow-black/20">
      <header className="flex items-center gap-2 border-b border-lab-line px-4 py-3">
        <ListTree size={18} aria-hidden="true" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-lab-muted">Event Log</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
        <ol className="space-y-2">
          {newestEvents.map((event) => (
            <li key={event.id} className="rounded-md border border-lab-line bg-lab-panelSoft p-3">
              <div className="mb-1 flex items-center justify-between gap-3 text-xs text-lab-muted">
                <time dateTime={event.timestamp}>{eventTimeFormatter.format(new Date(event.timestamp))}</time>
                <span className="font-mono">{event.cpuState}</span>
              </div>
              <p className="text-sm leading-5 text-lab-text">{event.message}</p>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
