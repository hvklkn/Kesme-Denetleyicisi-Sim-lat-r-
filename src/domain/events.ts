import type { CpuExecutionState } from "./cpu";
import type { InterruptRegisters } from "./registers";

export enum SimulationEventType {
  InterruptRaised = "INTERRUPT_RAISED",
  MaskChanged = "MASK_CHANGED",
  CpuFlagChanged = "CPU_FLAG_CHANGED",
  PendingResolved = "PENDING_RESOLVED",
  Acknowledge = "ACKNOWLEDGE",
  ContextSaved = "CONTEXT_SAVED",
  IsrStarted = "ISR_STARTED",
  EndOfInterrupt = "END_OF_INTERRUPT",
  ContextRestored = "CONTEXT_RESTORED",
  ReturnedToMainProgram = "RETURNED_TO_MAIN_PROGRAM",
  Reset = "RESET",
  ProcessorStep = "PROCESSOR_STEP",
  Halt = "HALT",
}

export interface SimulationEvent {
  readonly id: number;
  readonly timestamp: string;
  readonly type: SimulationEventType;
  readonly message: string;
  readonly cpuState: CpuExecutionState;
  readonly registers: InterruptRegisters;
}
