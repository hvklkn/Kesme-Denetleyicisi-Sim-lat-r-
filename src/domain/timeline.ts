import type { CpuExecutionState } from "./cpu";

export interface InterruptTimelineEntry {
  readonly cycleNumber: number;
  readonly cpuState: CpuExecutionState;
  readonly activeInterrupt: string | null;
  readonly activeVector: number | null;
  readonly irr: number;
  readonly imr: number;
  readonly isr: number;
  readonly description: string;
}
