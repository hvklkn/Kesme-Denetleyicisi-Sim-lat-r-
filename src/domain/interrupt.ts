import {
  FIRST_IRQ_LINE,
  HIGHEST_MASKABLE_PRIORITY,
  IRQ_LINE_COUNT,
  LAST_IRQ_LINE,
  NON_MASKABLE_INTERRUPT_PRIORITY,
} from "./constants";

export enum InterruptKind {
  Maskable = "MASKABLE",
  NonMaskable = "NMI",
}

export interface InterruptLine {
  readonly line: number;
  readonly label: string;
  readonly priority: number;
}

export interface InterruptVector {
  readonly kind: InterruptKind;
  readonly line: number | null;
  readonly label: string;
  readonly priority: number;
}

export function createDefaultInterruptLines(): readonly InterruptLine[] {
  return [
    { line: 0, label: "Sistem zamanlayıcı", priority: HIGHEST_MASKABLE_PRIORITY },
    { line: 1, label: "Klavye", priority: 1 },
    { line: 2, label: "Cascade hattı", priority: 2 },
    { line: 3, label: "Seri port 2", priority: 3 },
    { line: 4, label: "Seri port 1", priority: 4 },
    { line: 5, label: "Paralel port 2", priority: 5 },
    { line: 6, label: "Disket denetleyici", priority: 6 },
    { line: 7, label: "Paralel port 1", priority: 7 },
  ];
}

export function createNonMaskableInterruptVector(): InterruptVector {
  return {
    kind: InterruptKind.NonMaskable,
    line: null,
    label: "NMI",
    priority: NON_MASKABLE_INTERRUPT_PRIORITY,
  };
}

export function createMaskableInterruptVector(line: InterruptLine): InterruptVector {
  return {
    kind: InterruptKind.Maskable,
    line: line.line,
    label: `IRQ${line.line} - ${line.label}`,
    priority: line.priority,
  };
}

export function assertValidIrqLine(line: number): void {
  if (!Number.isInteger(line) || line < FIRST_IRQ_LINE || line > LAST_IRQ_LINE) {
    throw new RangeError(`IRQ hattı ${FIRST_IRQ_LINE}-${LAST_IRQ_LINE} arasında olmalıdır.`);
  }
}

export function assertCompleteInterruptLineSet(lines: readonly InterruptLine[]): void {
  if (lines.length !== IRQ_LINE_COUNT) {
    throw new Error(`Kesme denetleyicisi ${IRQ_LINE_COUNT} IRQ hattı ile çalışmalıdır.`);
  }

  const seenLines = new Set<number>();
  for (const line of lines) {
    assertValidIrqLine(line.line);
    if (seenLines.has(line.line)) {
      throw new Error(`IRQ${line.line} birden fazla tanımlanmış.`);
    }
    seenLines.add(line.line);
  }
}
