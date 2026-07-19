import type { InterruptLine, InterruptVector } from "../domain/interrupt";
import type { InterruptRegisters } from "../domain/registers";

export interface InterruptResolutionInput {
  readonly interruptLines: readonly InterruptLine[];
  readonly registers: InterruptRegisters;
  readonly interruptsEnabled: boolean;
  readonly pendingNmi: boolean;
}

export interface InterruptPriorityResolver {
  resolveNextInterrupt(input: InterruptResolutionInput): InterruptVector | null;
}
