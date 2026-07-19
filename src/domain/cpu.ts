export enum CpuExecutionState {
  Running = "RUNNING",
  InterruptPending = "INTERRUPT_PENDING",
  Acknowledging = "ACKNOWLEDGING",
  SavingContext = "SAVING_CONTEXT",
  ExecutingIsr = "EXECUTING_ISR",
  WaitingForEoi = "WAITING_FOR_EOI",
  RestoringContext = "RESTORING_CONTEXT",
  Returning = "RETURNING",
  Halted = "HALTED",
}

export interface CpuStatus {
  readonly executionState: CpuExecutionState;
  readonly interruptsEnabled: boolean;
}
