import type { CpuExecutionState } from "./cpu";
import type { InterruptRegisters } from "./registers";

export enum SimulationEventType {
  SimulationInitialized = "SIMULATION_INITIALIZED",
  AutoStarted = "AUTO_STARTED",
  SimulationPaused = "SIMULATION_PAUSED",
  InterruptRaised = "INTERRUPT_RAISED",
  NmiRaised = "NMI_RAISED",
  InterruptMasked = "INTERRUPT_MASKED",
  InterruptUnmasked = "INTERRUPT_UNMASKED",
  CpuFlagChanged = "CPU_FLAG_CHANGED",
  PendingResolved = "PENDING_RESOLVED",
  InterruptAccepted = "INTERRUPT_ACCEPTED",
  ContextSaved = "CONTEXT_SAVED",
  IsrStarted = "ISR_STARTED",
  IsrCompleted = "ISR_COMPLETED",
  IsrCycleExecuted = "ISR_CYCLE_EXECUTED",
  EoiSent = "EOI_SENT",
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
  SimulationReset = "SIMULATION_RESET",
  ProcessorStep = "PROCESSOR_STEP",
  Halt = "HALT",
}

export enum SimulationEventCategory {
  Interrupt = "Kesme",
  Cpu = "CPU",
  Context = "Context",
  System = "Sistem",
}

const hiddenEventLogTypes = new Set<SimulationEventType>([
  SimulationEventType.TimelineAdvanced,
  SimulationEventType.IsrCycleExecuted,
  SimulationEventType.ProcessorStep,
]);

export function isVisibleInEventLog(eventType: SimulationEventType): boolean {
  return !hiddenEventLogTypes.has(eventType);
}

export function getSimulationEventCategory(eventType: SimulationEventType): SimulationEventCategory {
  switch (eventType) {
    case SimulationEventType.ContextSaved:
    case SimulationEventType.ContextPushed:
    case SimulationEventType.ContextPopped:
    case SimulationEventType.ContextRestored:
      return SimulationEventCategory.Context;
    case SimulationEventType.CpuFlagChanged:
    case SimulationEventType.PendingResolved:
    case SimulationEventType.InterruptAccepted:
    case SimulationEventType.ReturnedToMainProgram:
    case SimulationEventType.ProcessorStep:
    case SimulationEventType.Halt:
      return SimulationEventCategory.Cpu;
    case SimulationEventType.SimulationInitialized:
    case SimulationEventType.AutoStarted:
    case SimulationEventType.SimulationPaused:
    case SimulationEventType.SimulationReset:
    case SimulationEventType.TimelineAdvanced:
      return SimulationEventCategory.System;
    case SimulationEventType.InterruptRaised:
    case SimulationEventType.NmiRaised:
    case SimulationEventType.InterruptMasked:
    case SimulationEventType.InterruptUnmasked:
    case SimulationEventType.IsrStarted:
    case SimulationEventType.IsrCompleted:
    case SimulationEventType.IsrCycleExecuted:
    case SimulationEventType.EoiSent:
    case SimulationEventType.NestedInterruptAccepted:
    case SimulationEventType.IsrPaused:
    case SimulationEventType.IsrResumed:
    case SimulationEventType.InterruptRejectedByPriority:
    case SimulationEventType.InterruptBlockedByMask:
    case SimulationEventType.InterruptBlockedByCpuFlag:
      return SimulationEventCategory.Interrupt;
  }
}

export interface SimulationEvent {
  readonly id: number;
  readonly timestamp: string;
  readonly type: SimulationEventType;
  readonly message: string;
  readonly cpuState: CpuExecutionState;
  readonly registers: InterruptRegisters;
}
