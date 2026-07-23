import { useState } from "react";
import { Cpu, Layers3, ListTree, RadioTower, Settings2, type LucideIcon } from "lucide-react";
import { getSimulationEventCategory, MAX_EVENT_LOG_ENTRIES, SimulationEventCategory } from "../../domain";
import { useSimulationStore } from "../../store/simulationStore";

const eventTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type EventFilter = "Tümü" | SimulationEventCategory;

const eventFilters: readonly EventFilter[] = [
  "Tümü",
  SimulationEventCategory.Interrupt,
  SimulationEventCategory.Cpu,
  SimulationEventCategory.Context,
  SimulationEventCategory.System,
];

const eventCategoryStyles: Record<SimulationEventCategory, { readonly Icon: LucideIcon; readonly className: string }> = {
  [SimulationEventCategory.Interrupt]: {
    Icon: RadioTower,
    className: "border-lab-cyan/60 bg-lab-cyan/10 text-lab-cyan",
  },
  [SimulationEventCategory.Cpu]: {
    Icon: Cpu,
    className: "border-lab-green/60 bg-lab-green/10 text-lab-green",
  },
  [SimulationEventCategory.Context]: {
    Icon: Layers3,
    className: "border-lab-amber/60 bg-lab-amber/10 text-lab-amber",
  },
  [SimulationEventCategory.System]: {
    Icon: Settings2,
    className: "border-lab-line bg-lab-bg text-lab-muted",
  },
};

export function EventLogPanel() {
  const events = useSimulationStore((state) => state.snapshot.eventLog);
  const [activeFilter, setActiveFilter] = useState<EventFilter>("Tümü");
  const filteredEvents =
    activeFilter === "Tümü" ? events : events.filter((event) => getSimulationEventCategory(event.type) === activeFilter);
  const newestEvents = [...filteredEvents].reverse();

  return (
    <aside className="flex min-h-0 flex-col rounded-lg border border-lab-line bg-lab-panel shadow-2xl shadow-black/20">
      <header className="border-b border-lab-line px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListTree size={18} aria-hidden="true" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-lab-muted">Event Log</h2>
          </div>
          <span className="shrink-0 text-xs text-lab-muted">Son {MAX_EVENT_LOG_ENTRIES} olay</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {eventFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              aria-pressed={activeFilter === filter}
              className={
                activeFilter === filter
                  ? "rounded-md border border-lab-cyan bg-lab-cyan/10 px-2.5 py-1 text-xs font-semibold text-lab-cyan"
                  : "rounded-md border border-lab-line bg-lab-panelSoft px-2.5 py-1 text-xs font-semibold text-lab-muted transition hover:border-lab-cyan hover:text-lab-text"
              }
            >
              {filter}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin" data-testid="event-log">
        {newestEvents.length === 0 ? (
          <div className="rounded-md border border-dashed border-lab-line p-4 text-sm text-lab-muted">
            Henüz anlamlı bir simülasyon olayı yok.
          </div>
        ) : (
          <ol className="space-y-2">
            {newestEvents.map((event) => {
              const category = getSimulationEventCategory(event.type);
              const { Icon, className } = eventCategoryStyles[category];
              return (
                <li key={event.id} className="rounded-md border border-lab-line bg-lab-panelSoft p-3">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-lab-muted">
                    <time dateTime={event.timestamp}>{eventTimeFormatter.format(new Date(event.timestamp))}</time>
                    <span className="font-mono">{event.cpuState}</span>
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold ${className}`}>
                      <Icon size={12} aria-hidden="true" />
                      {category}
                    </span>
                  </div>
                  <p className="text-sm leading-5 text-lab-text">{event.message}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}
