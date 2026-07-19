import {
  createMaskableInterruptVector,
  createNonMaskableInterruptVector,
} from "../domain/interrupt";
import { isRegisterBitSet } from "../domain/registers";
import type {
  InterruptPriorityResolver,
  InterruptResolutionInput,
} from "./InterruptPriorityResolver";

export class FixedPriorityResolver implements InterruptPriorityResolver {
  public resolveNextInterrupt(input: InterruptResolutionInput) {
    if (input.pendingNmi) {
      return createNonMaskableInterruptVector();
    }

    if (!input.interruptsEnabled) {
      return null;
    }

    const eligibleLines = input.interruptLines
      .filter((line) => line.enabled)
      .filter((line) => isRegisterBitSet(input.registers.irr, line.line))
      .filter((line) => !isRegisterBitSet(input.registers.imr, line.line))
      .sort((left, right) => left.priority - right.priority || left.line - right.line);

    const highestPriorityLine = eligibleLines[0];
    return highestPriorityLine ? createMaskableInterruptVector(highestPriorityLine) : null;
  }
}
