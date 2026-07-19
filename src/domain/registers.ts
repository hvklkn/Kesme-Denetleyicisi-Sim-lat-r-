import { BYTE_REGISTER_MASK } from "./constants";
import { assertValidIrqLine } from "./interrupt";

export interface InterruptRegisters {
  readonly irr: number;
  readonly imr: number;
  readonly isr: number;
}

export function createEmptyRegisters(): InterruptRegisters {
  return {
    irr: 0,
    imr: 0,
    isr: 0,
  };
}

export function createLineBitMask(line: number): number {
  assertValidIrqLine(line);
  return 1 << line;
}

export function setRegisterBit(registerValue: number, line: number): number {
  return normalizeRegisterValue(registerValue | createLineBitMask(line));
}

export function clearRegisterBit(registerValue: number, line: number): number {
  return normalizeRegisterValue(registerValue & ~createLineBitMask(line));
}

export function isRegisterBitSet(registerValue: number, line: number): boolean {
  return (normalizeRegisterValue(registerValue) & createLineBitMask(line)) !== 0;
}

export function normalizeRegisterValue(registerValue: number): number {
  return registerValue & BYTE_REGISTER_MASK;
}
