import {
  FIRST_IRQ_LINE,
  FIRST_INTERRUPT_VECTOR_ADDRESS,
  DEFAULT_ISR_DURATION_CYCLES_BY_IRQ,
  HIGHEST_MASKABLE_PRIORITY,
  IRQ_LINE_COUNT,
  LAST_IRQ_LINE,
  MIN_ISR_DURATION_CYCLES,
  NON_MASKABLE_INTERRUPT_PRIORITY,
  NON_MASKABLE_INTERRUPT_DURATION_CYCLES,
  NON_MASKABLE_INTERRUPT_VECTOR_ADDRESS,
} from "./constants";

export enum InterruptKind {
  Maskable = "MASKABLE",
  NonMaskable = "NMI",
}

export enum TriggerMode {
  Edge = "EDGE",
  Level = "LEVEL",
}

export interface InterruptLine {
  readonly line: number;
  readonly label: string;
  readonly priority: number;
  readonly vectorAddress: number;
  readonly isrDurationCycles: number;
  readonly triggerMode: TriggerMode;
  readonly enabled: boolean;
}

export interface InterruptVector {
  readonly kind: InterruptKind;
  readonly line: number | null;
  readonly label: string;
  readonly priority: number;
  readonly vectorAddress: number;
  readonly isrDurationCycles: number;
}

export function createDefaultInterruptLines(): readonly InterruptLine[] {
  return [
    createDefaultInterruptLine(0, "Sistem zamanlayıcı", HIGHEST_MASKABLE_PRIORITY, TriggerMode.Edge),
    createDefaultInterruptLine(1, "Klavye", 1, TriggerMode.Edge),
    createDefaultInterruptLine(2, "Cascade hattı", 2, TriggerMode.Edge),
    createDefaultInterruptLine(3, "Seri port 2", 3, TriggerMode.Level),
    createDefaultInterruptLine(4, "Seri port 1", 4, TriggerMode.Level),
    createDefaultInterruptLine(5, "Paralel port 2", 5, TriggerMode.Level),
    createDefaultInterruptLine(6, "Disket denetleyici", 6, TriggerMode.Edge),
    createDefaultInterruptLine(7, "Paralel port 1", 7, TriggerMode.Level),
  ];
}

function createDefaultInterruptLine(
  line: number,
  label: string,
  priority: number,
  triggerMode: TriggerMode,
): InterruptLine {
  const defaultDuration = DEFAULT_ISR_DURATION_CYCLES_BY_IRQ[line];
  if (defaultDuration === undefined) {
    throw new Error(`IRQ${line} için varsayılan ISR süresi bulunamadı.`);
  }

  return createInterruptLine(
    line,
    label,
    priority,
    FIRST_INTERRUPT_VECTOR_ADDRESS + line,
    defaultDuration,
    triggerMode,
  );
}

export function createInterruptLine(
  line: number,
  label: string,
  priority: number,
  vectorAddress: number,
  isrDurationCycles: number,
  triggerMode: TriggerMode,
): InterruptLine {
  return {
    line,
    label,
    priority,
    vectorAddress,
    isrDurationCycles,
    triggerMode,
    enabled: true,
  };
}

export function createNonMaskableInterruptVector(): InterruptVector {
  return {
    kind: InterruptKind.NonMaskable,
    line: null,
    label: "NMI",
    priority: NON_MASKABLE_INTERRUPT_PRIORITY,
    vectorAddress: NON_MASKABLE_INTERRUPT_VECTOR_ADDRESS,
    isrDurationCycles: NON_MASKABLE_INTERRUPT_DURATION_CYCLES,
  };
}

export function createMaskableInterruptVector(line: InterruptLine): InterruptVector {
  return {
    kind: InterruptKind.Maskable,
    line: line.line,
    label: `IRQ${line.line} - ${line.label}`,
    priority: line.priority,
    vectorAddress: line.vectorAddress,
    isrDurationCycles: line.isrDurationCycles,
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
    if (line.isrDurationCycles < MIN_ISR_DURATION_CYCLES) {
      throw new Error(`IRQ${line.line} ISR süresi en az ${MIN_ISR_DURATION_CYCLES} cycle olmalıdır.`);
    }
    seenLines.add(line.line);
  }
}
