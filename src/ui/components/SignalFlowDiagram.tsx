import type { ReactNode } from "react";
import { CheckCircle2, Cpu, Filter, Lock, RadioTower, Save, Send, Workflow } from "lucide-react";
import { CpuExecutionState } from "../../domain";
import { isRegisterBitSet } from "../../domain/registers";
import { useSimulationStore } from "../../store/simulationStore";

type FlowLink =
  | "irq-irr"
  | "resolver-cpu"
  | "cpu-context"
  | "cpu-isr"
  | "isr-eoi"
  | "context-cpu"
  | "cpu-main";

const activeLinkByState: Partial<Record<CpuExecutionState, FlowLink>> = {
  [CpuExecutionState.InterruptPending]: "irq-irr",
  [CpuExecutionState.Acknowledging]: "resolver-cpu",
  [CpuExecutionState.SavingContext]: "cpu-context",
  [CpuExecutionState.ExecutingIsr]: "cpu-isr",
  [CpuExecutionState.WaitingForEoi]: "isr-eoi",
  [CpuExecutionState.RestoringContext]: "context-cpu",
  [CpuExecutionState.Returning]: "cpu-main",
};

export function SignalFlowDiagram() {
  const snapshot = useSimulationStore((state) => state.snapshot);
  const activeLink = activeLinkByState[snapshot.cpu.executionState];
  const maskedLines = snapshot.interruptLines.filter((line) => isRegisterBitSet(snapshot.registers.imr, line.line));
  const pendingLines = snapshot.interruptLines.filter((line) => isRegisterBitSet(snapshot.registers.irr, line.line));
  const activeLine = snapshot.activeIsr?.interrupt.line;

  return (
    <section className="rounded-lg border border-lab-line bg-lab-panel p-4 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Workflow size={18} aria-hidden="true" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-lab-muted">Sinyal Akışı</h2>
        </div>
        <div className="text-xs text-lab-muted" data-testid="signal-active-stage">
          Aktif: {snapshot.cpu.executionState}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(58px,1fr)_12px_minmax(48px,0.8fr)_12px_minmax(58px,1fr)_12px_minmax(72px,1.1fr)_12px_minmax(52px,0.8fr)_12px_minmax(72px,1.1fr)_12px_minmax(46px,0.7fr)_12px_minmax(46px,0.7fr)] items-center">
          <FlowNode icon={<RadioTower size={18} />} label="IRQ Device" active={activeLink === "irq-irr"} />
          <FlowConnector active={activeLink === "irq-irr"} />
          <FlowNode label="IRR" active={activeLink === "irq-irr"} />
          <FlowConnector active={activeLink === "irq-irr"} />
          <FlowNode icon={<Filter size={18} />} label="IMR Filter" active={activeLink === "resolver-cpu"} />
          <FlowConnector active={activeLink === "resolver-cpu"} />
          <FlowNode label="Priority" active={activeLink === "resolver-cpu"} />
          <FlowConnector active={activeLink === "resolver-cpu"} />
          <FlowNode icon={<Cpu size={18} />} label="CPU" active={activeLink === "cpu-isr" || activeLink === "cpu-main"} />
          <FlowConnector active={activeLink === "cpu-context"} />
          <FlowNode icon={<Save size={18} />} label="Context Save" active={activeLink === "cpu-context"} />
          <FlowConnector active={activeLink === "cpu-isr"} />
          <FlowNode label="ISR" active={activeLink === "cpu-isr" || activeLink === "isr-eoi"} />
          <FlowConnector active={activeLink === "isr-eoi"} />
          <FlowNode icon={<Send size={18} />} label="EOI" active={activeLink === "isr-eoi"} />
        </div>

        <div className="grid grid-cols-[minmax(90px,1fr)_36px_minmax(62px,0.7fr)_36px_minmax(100px,1fr)] items-center rounded-md border border-lab-line bg-lab-bg/40 p-2">
          <FlowNode icon={<Save size={18} />} label="Context Restore" active={activeLink === "context-cpu"} />
          <FlowConnector active={activeLink === "context-cpu"} />
          <FlowNode icon={<Cpu size={18} />} label="CPU" active={activeLink === "context-cpu" || activeLink === "cpu-main"} />
          <FlowConnector active={activeLink === "cpu-main"} />
          <FlowNode label="Main Program" active={activeLink === "cpu-main"} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <SignalSummary title="Maskeli IRQ" tone="red" values={maskedLines.map((line) => `IRQ${line.line}`)} icon={<Lock size={14} />} />
        <SignalSummary title="Bekleyen IRQ" tone="amber" values={pendingLines.map((line) => `IRQ${line.line}`)} />
        <SignalSummary
          title="Aktif ISR"
          tone="green"
          values={activeLine === null || activeLine === undefined ? [] : [`IRQ${activeLine}`]}
          icon={<CheckCircle2 size={14} />}
        />
      </div>
    </section>
  );
}

interface FlowNodeProps {
  readonly label: string;
  readonly active: boolean;
  readonly icon?: ReactNode;
}

function FlowNode({ label, active, icon }: FlowNodeProps) {
  return (
    <div
      className={
        active
          ? "flex min-h-16 items-center justify-center gap-2 rounded-md border border-lab-cyan bg-lab-cyan/15 px-3 text-center text-sm font-semibold text-white shadow-[0_0_20px_rgba(56,189,248,0.25)]"
          : "flex min-h-16 items-center justify-center gap-2 rounded-md border border-lab-line bg-lab-panelSoft px-3 text-center text-sm font-semibold text-lab-muted"
      }
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

interface FlowConnectorProps {
  readonly active: boolean;
}

function FlowConnector({ active }: FlowConnectorProps) {
  return (
    <div className={active ? "signal-line signal-line-active" : "signal-line"}>
      {active ? <span className="signal-pulse" /> : null}
    </div>
  );
}

interface SignalSummaryProps {
  readonly title: string;
  readonly tone: "red" | "amber" | "green";
  readonly values: readonly string[];
  readonly icon?: ReactNode;
}

const summaryToneClassNames: Record<SignalSummaryProps["tone"], string> = {
  red: "text-lab-red",
  amber: "text-lab-amber",
  green: "text-lab-green",
};

function SignalSummary({ title, tone, values, icon }: SignalSummaryProps) {
  return (
    <div className="rounded-md border border-lab-line bg-lab-panelSoft p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-lab-muted">
        {icon}
        {title}
      </div>
      <div className={`min-h-6 text-sm font-semibold ${summaryToneClassNames[tone]}`}>
        {values.length > 0 ? values.join(", ") : "Yok"}
      </div>
    </div>
  );
}
