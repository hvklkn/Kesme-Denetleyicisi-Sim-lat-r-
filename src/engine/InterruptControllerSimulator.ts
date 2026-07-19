import type { InterruptPriorityResolver } from "../algorithms/InterruptPriorityResolver";
import { FixedPriorityResolver } from "../algorithms/FixedPriorityResolver";
import {
  CpuExecutionState,
  MAX_EVENT_LOG_ENTRIES,
  type CpuStatus,
  type InterruptLine,
  InterruptKind,
  type InterruptRegisters,
  type InterruptVector,
  SimulationEventType,
  assertCompleteInterruptLineSet,
  assertValidIrqLine,
  clearRegisterBit,
  createDefaultInterruptLines,
  createEmptyRegisters,
  isRegisterBitSet,
  setRegisterBit,
  type SimulationEvent,
  type SimulationSnapshot,
} from "../domain";
import { SystemSimulationClock, type SimulationClock } from "./SimulationClock";

export interface InterruptControllerSimulatorOptions {
  readonly interruptLines?: readonly InterruptLine[];
  readonly priorityResolver?: InterruptPriorityResolver;
  readonly clock?: SimulationClock;
}

export class InterruptControllerSimulator {
  private readonly interruptLines: readonly InterruptLine[];
  private readonly priorityResolver: InterruptPriorityResolver;
  private readonly clock: SimulationClock;

  private registers: InterruptRegisters = createEmptyRegisters();
  private cpu: CpuStatus = {
    executionState: CpuExecutionState.Running,
    interruptsEnabled: true,
  };
  private activeInterrupt: InterruptVector | null = null;
  private pendingNmi = false;
  private eventLog: SimulationEvent[] = [];
  private nextEventId = 1;

  public constructor(options: InterruptControllerSimulatorOptions = {}) {
    this.interruptLines = options.interruptLines ?? createDefaultInterruptLines();
    assertCompleteInterruptLineSet(this.interruptLines);

    this.priorityResolver = options.priorityResolver ?? new FixedPriorityResolver();
    this.clock = options.clock ?? new SystemSimulationClock();
    this.appendEvent(SimulationEventType.Reset, "Simülasyon hazırlandı.");
  }

  public getSnapshot(): SimulationSnapshot {
    return {
      cpu: { ...this.cpu },
      registers: { ...this.registers },
      interruptLines: this.interruptLines.map((line) => ({ ...line })),
      activeInterrupt: this.activeInterrupt ? { ...this.activeInterrupt } : null,
      pendingNmi: this.pendingNmi,
      eventLog: this.eventLog.map((event) => ({
        ...event,
        registers: { ...event.registers },
      })),
    };
  }

  public createInterrupt(line: number): void {
    assertValidIrqLine(line);
    this.registers = {
      ...this.registers,
      irr: setRegisterBit(this.registers.irr, line),
    };
    this.appendEvent(SimulationEventType.InterruptRaised, `IRQ${line} kesmesi oluşturuldu; IRR biti set edildi.`);
    this.refreshPendingState();
  }

  public createNonMaskableInterrupt(): void {
    this.pendingNmi = true;
    this.appendEvent(SimulationEventType.InterruptRaised, "NMI oluşturuldu; maske ve IF denetimi atlandı.");
    this.refreshPendingState();
  }

  public maskInterruptLine(line: number): void {
    assertValidIrqLine(line);
    this.registers = {
      ...this.registers,
      imr: setRegisterBit(this.registers.imr, line),
    };
    this.appendEvent(SimulationEventType.MaskChanged, `IRQ${line} maskelendi; bekleyen istek IRR içinde korunur.`);
    this.refreshPendingState();
  }

  public unmaskInterruptLine(line: number): void {
    assertValidIrqLine(line);
    this.registers = {
      ...this.registers,
      imr: clearRegisterBit(this.registers.imr, line),
    };
    this.appendEvent(SimulationEventType.MaskChanged, `IRQ${line} maskesi kaldırıldı.`);
    this.refreshPendingState();
  }

  public setGlobalInterruptsEnabled(enabled: boolean): void {
    this.cpu = {
      ...this.cpu,
      interruptsEnabled: enabled,
    };
    const stateText = enabled ? "açıldı" : "kapatıldı";
    this.appendEvent(SimulationEventType.CpuFlagChanged, `CPU global interrupt flag ${stateText}.`);
    this.refreshPendingState();
  }

  public haltProcessor(): void {
    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.Halted,
    };
    this.appendEvent(SimulationEventType.Halt, "CPU HALTED durumuna alındı.");
  }

  public step(): void {
    switch (this.cpu.executionState) {
      case CpuExecutionState.Running:
        this.stepRunningProcessor();
        return;
      case CpuExecutionState.InterruptPending:
        this.stepPendingInterrupt();
        return;
      case CpuExecutionState.Acknowledging:
        this.stepAcknowledge();
        return;
      case CpuExecutionState.SavingContext:
        this.stepSaveContext();
        return;
      case CpuExecutionState.ExecutingIsr:
        this.stepStartIsr();
        return;
      case CpuExecutionState.WaitingForEoi:
        this.appendEvent(SimulationEventType.ProcessorStep, "CPU EOI bekliyor.");
        return;
      case CpuExecutionState.RestoringContext:
        this.stepRestoreContext();
        return;
      case CpuExecutionState.Returning:
        this.stepReturnToMainProgram();
        return;
      case CpuExecutionState.Halted:
        this.stepHaltedProcessor();
        return;
    }
  }

  public sendEndOfInterrupt(): void {
    if (this.cpu.executionState !== CpuExecutionState.WaitingForEoi || !this.activeInterrupt) {
      this.appendEvent(SimulationEventType.EndOfInterrupt, "EOI yok sayıldı; aktif ISR bekleme durumu yok.");
      return;
    }

    if (this.activeInterrupt.kind === InterruptKind.Maskable && this.activeInterrupt.line !== null) {
      this.registers = {
        ...this.registers,
        isr: clearRegisterBit(this.registers.isr, this.activeInterrupt.line),
      };
      this.appendEvent(
        SimulationEventType.EndOfInterrupt,
        `EOI alındı; IRQ${this.activeInterrupt.line} ISR biti temizlendi.`,
      );
    } else {
      this.appendEvent(SimulationEventType.EndOfInterrupt, "NMI ISR akışı için EOI alındı.");
    }

    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.RestoringContext,
    };
  }

  public reset(): void {
    this.registers = createEmptyRegisters();
    this.cpu = {
      executionState: CpuExecutionState.Running,
      interruptsEnabled: true,
    };
    this.activeInterrupt = null;
    this.pendingNmi = false;
    this.eventLog = [];
    this.nextEventId = 1;
    this.appendEvent(SimulationEventType.Reset, "Simülasyon sıfırlandı; IRR, IMR ve ISR temizlendi.");
  }

  private stepRunningProcessor(): void {
    const nextInterrupt = this.resolveNextInterrupt();
    if (!nextInterrupt) {
      this.appendEvent(SimulationEventType.ProcessorStep, "CPU ana programı çalıştırıyor.");
      return;
    }

    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.InterruptPending,
    };
    this.appendEvent(SimulationEventType.PendingResolved, `${nextInterrupt.label} CPU'ya iletilmeye hazır.`);
  }

  private stepPendingInterrupt(): void {
    const nextInterrupt = this.resolveNextInterrupt();
    if (!nextInterrupt) {
      this.activeInterrupt = null;
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.Running,
      };
      this.appendEvent(SimulationEventType.PendingResolved, "İşlenebilir kesme kalmadı; CPU ana programa döndü.");
      return;
    }

    this.activeInterrupt = nextInterrupt;
    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.Acknowledging,
    };
    this.appendEvent(SimulationEventType.PendingResolved, `${nextInterrupt.label} fixed priority ile seçildi.`);
  }

  private stepAcknowledge(): void {
    if (!this.activeInterrupt) {
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.Running,
      };
      this.appendEvent(SimulationEventType.Acknowledge, "Acknowledge iptal edildi; aktif kesme yok.");
      return;
    }

    if (this.activeInterrupt.kind === InterruptKind.Maskable && this.activeInterrupt.line !== null) {
      this.registers = {
        ...this.registers,
        irr: clearRegisterBit(this.registers.irr, this.activeInterrupt.line),
        isr: setRegisterBit(this.registers.isr, this.activeInterrupt.line),
      };
      this.appendEvent(
        SimulationEventType.Acknowledge,
        `CPU IRQ${this.activeInterrupt.line} kesmesini kabul etti; IRR temizlendi ve ISR set edildi.`,
      );
    } else {
      this.pendingNmi = false;
      this.appendEvent(SimulationEventType.Acknowledge, "CPU NMI kesmesini kabul etti.");
    }

    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.SavingContext,
    };
  }

  private stepSaveContext(): void {
    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.ExecutingIsr,
    };
    this.appendEvent(SimulationEventType.ContextSaved, "Context save tamamlandı; dönüş noktası saklandı.");
  }

  private stepStartIsr(): void {
    if (!this.activeInterrupt) {
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.Running,
      };
      this.appendEvent(SimulationEventType.IsrStarted, "ISR başlatılamadı; aktif kesme yok.");
      return;
    }

    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.WaitingForEoi,
    };
    this.appendEvent(SimulationEventType.IsrStarted, `${this.activeInterrupt.label} ISR akışı başlatıldı.`);
  }

  private stepRestoreContext(): void {
    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.Returning,
    };
    this.appendEvent(SimulationEventType.ContextRestored, "Context restore tamamlandı; CPU dönüşe hazırlanıyor.");
  }

  private stepReturnToMainProgram(): void {
    const finishedInterruptLabel = this.activeInterrupt?.label ?? "Kesme";
    this.activeInterrupt = null;
    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.Running,
    };
    this.appendEvent(SimulationEventType.ReturnedToMainProgram, `${finishedInterruptLabel} tamamlandı; ana programa dönüldü.`);
    this.refreshPendingState();
  }

  private stepHaltedProcessor(): void {
    const nextInterrupt = this.resolveNextInterrupt();
    if (nextInterrupt) {
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.InterruptPending,
      };
      this.appendEvent(SimulationEventType.PendingResolved, "HALTED CPU kesme isteği ile uyandı.");
      return;
    }

    this.appendEvent(SimulationEventType.ProcessorStep, "CPU HALTED durumunda bekliyor.");
  }

  private refreshPendingState(): void {
    if (this.activeInterrupt) {
      return;
    }

    const canChangePendingState =
      this.cpu.executionState === CpuExecutionState.Running ||
      this.cpu.executionState === CpuExecutionState.InterruptPending ||
      this.cpu.executionState === CpuExecutionState.Halted;

    if (!canChangePendingState) {
      return;
    }

    const nextInterrupt = this.resolveNextInterrupt();
    if (nextInterrupt) {
      if (this.cpu.executionState !== CpuExecutionState.InterruptPending) {
        this.cpu = {
          ...this.cpu,
          executionState: CpuExecutionState.InterruptPending,
        };
        this.appendEvent(SimulationEventType.PendingResolved, `${nextInterrupt.label} CPU'ya iletildi.`);
      }
      return;
    }

    if (this.cpu.executionState === CpuExecutionState.InterruptPending) {
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.Running,
      };
      this.appendEvent(SimulationEventType.PendingResolved, "Bekleyen kesme maskeli veya IF kapalı; CPU ana programda kaldı.");
    }
  }

  private resolveNextInterrupt(): InterruptVector | null {
    return this.priorityResolver.resolveNextInterrupt({
      interruptLines: this.interruptLines,
      registers: this.registers,
      interruptsEnabled: this.cpu.interruptsEnabled,
      pendingNmi: this.pendingNmi,
    });
  }

  private appendEvent(type: SimulationEventType, message: string): void {
    const event: SimulationEvent = {
      id: this.nextEventId,
      timestamp: this.clock.now().toISOString(),
      type,
      message,
      cpuState: this.cpu.executionState,
      registers: { ...this.registers },
    };

    this.nextEventId += 1;
    this.eventLog = [...this.eventLog, event].slice(-MAX_EVENT_LOG_ENTRIES);
  }

  public isInterruptLineMasked(line: number): boolean {
    return isRegisterBitSet(this.registers.imr, line);
  }
}
