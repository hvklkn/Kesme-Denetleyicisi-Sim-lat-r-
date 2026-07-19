import {
  CONTEXT_FRAME_STACK_BYTES,
  INITIAL_FLAGS_REGISTER,
  INITIAL_GENERAL_REGISTER_VALUE,
  INITIAL_PROGRAM_COUNTER,
  INITIAL_STACK_POINTER,
  PERCENTAGE_COMPLETE,
} from "./constants";
import type { InterruptVector } from "./interrupt";

export interface CpuRegisters {
  readonly pc: number;
  readonly sp: number;
  readonly flags: number;
  readonly acc: number;
  readonly r1: number;
  readonly r2: number;
  readonly r3: number;
}

export interface CpuContextFrame {
  readonly registers: CpuRegisters;
}

export interface ContextStackEntry {
  readonly id: number;
  readonly interrupt: InterruptVector;
  readonly frame: CpuContextFrame;
  readonly timestamp: string;
  readonly stackDepth: number;
}

export interface ActiveIsrExecution {
  readonly interrupt: InterruptVector;
  readonly totalCycles: number;
  readonly remainingCycles: number;
  readonly elapsedCycles: number;
  readonly progressPercentage: number;
  readonly vectorAddress: number;
}

export function createInitialCpuRegisters(): CpuRegisters {
  return {
    pc: INITIAL_PROGRAM_COUNTER,
    sp: INITIAL_STACK_POINTER,
    flags: INITIAL_FLAGS_REGISTER,
    acc: INITIAL_GENERAL_REGISTER_VALUE,
    r1: INITIAL_GENERAL_REGISTER_VALUE,
    r2: INITIAL_GENERAL_REGISTER_VALUE,
    r3: INITIAL_GENERAL_REGISTER_VALUE,
  };
}

export function decrementStackPointerForContextFrame(registers: CpuRegisters): CpuRegisters {
  return {
    ...registers,
    sp: registers.sp - CONTEXT_FRAME_STACK_BYTES,
  };
}

export function createActiveIsrExecution(interrupt: InterruptVector): ActiveIsrExecution {
  return {
    interrupt,
    totalCycles: interrupt.isrDurationCycles,
    remainingCycles: interrupt.isrDurationCycles,
    elapsedCycles: 0,
    progressPercentage: 0,
    vectorAddress: interrupt.vectorAddress,
  };
}

export function advanceIsrExecution(execution: ActiveIsrExecution): ActiveIsrExecution {
  const remainingCycles = Math.max(0, execution.remainingCycles - 1);
  const elapsedCycles = execution.totalCycles - remainingCycles;
  return {
    ...execution,
    remainingCycles,
    elapsedCycles,
    progressPercentage: Math.round((elapsedCycles / execution.totalCycles) * PERCENTAGE_COMPLETE),
  };
}
