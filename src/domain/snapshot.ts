import type { CpuStatus } from "./cpu";
import type { SimulationEvent } from "./events";
import type { InterruptLine, InterruptVector } from "./interrupt";
import type { InterruptRegisters } from "./registers";

export interface SimulationSnapshot {
  readonly cpu: CpuStatus;
  readonly registers: InterruptRegisters;
  readonly interruptLines: readonly InterruptLine[];
  readonly activeInterrupt: InterruptVector | null;
  readonly pendingNmi: boolean;
  readonly eventLog: readonly SimulationEvent[];
}
