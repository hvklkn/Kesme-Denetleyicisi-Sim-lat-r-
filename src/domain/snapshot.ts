import type { CpuStatus } from "./cpu";
import type { ActiveIsrExecution, ContextStackEntry, CpuRegisters } from "./context";
import type { SimulationEvent } from "./events";
import type { InterruptLine, InterruptVector } from "./interrupt";
import type { InterruptRegisters } from "./registers";
import type { InterruptTimelineEntry } from "./timeline";

export interface SimulationSnapshot {
  readonly cpu: CpuStatus;
  readonly cpuRegisters: CpuRegisters;
  readonly registers: InterruptRegisters;
  readonly interruptLines: readonly InterruptLine[];
  readonly activeInterrupt: InterruptVector | null;
  readonly activeIsr: ActiveIsrExecution | null;
  readonly contextStack: readonly ContextStackEntry[];
  readonly activeIsrStack: readonly ActiveIsrExecution[];
  readonly nestedInterruptsEnabled: boolean;
  readonly pendingNmi: boolean;
  readonly timeline: readonly InterruptTimelineEntry[];
  readonly eventLog: readonly SimulationEvent[];
}
