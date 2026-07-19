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
  IsrCycleExecuted = "ISR_CYCLE_EXECUTED",
  EndOfInterrupt = "END_OF_INTERRUPT",
  ContextRestored = "CONTEXT_RESTORED",
  ContextPushed = "CONTEXT_PUSHED",
  ContextPopped = "CONTEXT_POPPED",
  NestedInterruptAccepted = "NESTED_INTERRUPT_ACCEPTED",
  IsrPaused = "ISR_PAUSED",
  IsrResumed = "ISR_RESUMED",
  TimelineAdvanced = "TIMELINE_ADVANCED",
  InterruptRejectedByPriority = "INTERRUPT_REJECTED_BY_PRIORITY",
  InterruptBlockedByMask = "INTERRUPT_BLOCKED_BY_MASK",
  InterruptBlockedByCpuFlag = "INTERRUPT_BLOCKED_BY_CPU_FLAG",
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
