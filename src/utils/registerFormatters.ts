import {
  BINARY_RADIX,
  HEX_RADIX,
  HEX_REGISTER_WIDTH,
  REGISTER_BIT_WIDTH,
  WORD_HEX_WIDTH,
} from "../domain/constants";
import { normalizeRegisterValue } from "../domain/registers";

export function formatRegisterAsBinary(registerValue: number): string {
  return normalizeRegisterValue(registerValue).toString(BINARY_RADIX).padStart(REGISTER_BIT_WIDTH, "0");
}

export function formatRegisterAsHex(registerValue: number): string {
  return `0x${normalizeRegisterValue(registerValue).toString(HEX_RADIX).toUpperCase().padStart(HEX_REGISTER_WIDTH, "0")}`;
}

export function formatAddressAsHex(value: number, width = WORD_HEX_WIDTH): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(width, "0")}`;
}

export function formatRegisterBits(registerValue: number): readonly boolean[] {
  const normalizedValue = normalizeRegisterValue(registerValue);
  return Array.from({ length: REGISTER_BIT_WIDTH }, (_, index) => {
    const bitPosition = REGISTER_BIT_WIDTH - index - 1;
    return (normalizedValue & (1 << bitPosition)) !== 0;
  });
}
