import type { InterruptPriorityResolver } from "../algorithms/InterruptPriorityResolver";
import { FixedPriorityResolver } from "../algorithms/FixedPriorityResolver";
import {
  CpuExecutionState,
  MAX_EVENT_LOG_ENTRIES,
  MAX_TIMELINE_ENTRIES,
  PROGRAM_COUNTER_INCREMENT,
  type ActiveIsrExecution,
  type ContextStackEntry,
  type CpuRegisters,
  type CpuStatus,
  type InterruptLine,
  InterruptKind,
  type InterruptRegisters,
  type InterruptVector,
  type InterruptTimelineEntry,
  SimulationEventType,
  advanceIsrExecution,
  assertCompleteInterruptLineSet,
  assertValidIrqLine,
  clearRegisterBit,
  createActiveIsrExecution,
  createDefaultInterruptLines,
  createEmptyRegisters,
  createInitialCpuRegisters,
  decrementStackPointerForContextFrame,
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
  private cpuRegisters: CpuRegisters = createInitialCpuRegisters();
  private selectedInterrupt: InterruptVector | null = null;
  private activeIsr: ActiveIsrExecution | null = null;
  private activeIsrStack: ActiveIsrExecution[] = [];
  private contextStack: ContextStackEntry[] = [];
  private pendingNmi = false;
  private nestedInterruptsEnabled = true;
  private timeline: InterruptTimelineEntry[] = [];
  private eventLog: SimulationEvent[] = [];
  private nextEventId = 1;
  private nextContextFrameId = 1;
  private nextTimelineCycleNumber = 1;

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
      cpuRegisters: { ...this.cpuRegisters },
      registers: { ...this.registers },
      interruptLines: this.interruptLines.map((line) => ({ ...line })),
      activeInterrupt: this.resolveVisibleActiveInterrupt(),
      activeIsr: this.activeIsr ? this.cloneActiveIsrExecution(this.activeIsr) : null,
      contextStack: this.contextStack.map((entry) => this.cloneContextStackEntry(entry)),
      activeIsrStack: this.activeIsrStack.map((entry) => this.cloneActiveIsrExecution(entry)),
      nestedInterruptsEnabled: this.nestedInterruptsEnabled,
      pendingNmi: this.pendingNmi,
      timeline: this.timeline.map((entry) => ({ ...entry })),
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
    this.evaluateInterruptDelivery();
  }

  public createNonMaskableInterrupt(): void {
    this.pendingNmi = true;
    this.appendEvent(SimulationEventType.InterruptRaised, "NMI oluşturuldu; maske ve IF denetimi atlandı.");
    this.evaluateInterruptDelivery();
  }

  public maskInterruptLine(line: number): void {
    assertValidIrqLine(line);
    this.registers = {
      ...this.registers,
      imr: setRegisterBit(this.registers.imr, line),
    };
    this.appendEvent(SimulationEventType.MaskChanged, `IRQ${line} maskelendi; bekleyen istek IRR içinde korunur.`);
    this.evaluateInterruptDelivery();
  }

  public unmaskInterruptLine(line: number): void {
    assertValidIrqLine(line);
    this.registers = {
      ...this.registers,
      imr: clearRegisterBit(this.registers.imr, line),
    };
    this.appendEvent(SimulationEventType.MaskChanged, `IRQ${line} maskesi kaldırıldı.`);
    this.evaluateInterruptDelivery();
  }

  public setGlobalInterruptsEnabled(enabled: boolean): void {
    this.cpu = {
      ...this.cpu,
      interruptsEnabled: enabled,
    };
    const stateText = enabled ? "açıldı" : "kapatıldı";
    this.appendEvent(SimulationEventType.CpuFlagChanged, `CPU global interrupt flag ${stateText}.`);
    this.evaluateInterruptDelivery();
  }

  public setNestedInterruptsEnabled(enabled: boolean): void {
    this.nestedInterruptsEnabled = enabled;
    const stateText = enabled ? "açıldı" : "kapatıldı";
    this.appendEvent(SimulationEventType.CpuFlagChanged, `İç içe kesme desteği ${stateText}.`);
    this.evaluateInterruptDelivery();
  }

  public haltProcessor(): void {
    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.Halted,
    };
    this.appendEvent(SimulationEventType.Halt, "CPU HALTED durumuna alındı.");
  }

  public step(): void {
    const timelineDescription = this.executeCurrentStep();
    this.appendTimelineEntry(timelineDescription);
  }

  public sendEndOfInterrupt(): void {
    if (this.cpu.executionState !== CpuExecutionState.WaitingForEoi || !this.activeIsr) {
      this.appendEvent(SimulationEventType.EndOfInterrupt, "EOI yok sayıldı; aktif ISR bekleme durumu yok.");
      return;
    }

    const completedIsr = this.activeIsr;
    if (completedIsr.interrupt.kind === InterruptKind.Maskable && completedIsr.interrupt.line !== null) {
      this.registers = {
        ...this.registers,
        isr: clearRegisterBit(this.registers.isr, completedIsr.interrupt.line),
      };
      this.appendEvent(
        SimulationEventType.EndOfInterrupt,
        `EOI alındı; IRQ${completedIsr.interrupt.line} ISR biti temizlendi.`,
      );
    } else {
      this.appendEvent(SimulationEventType.EndOfInterrupt, "NMI ISR akışı için EOI alındı.");
    }

    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.RestoringContext,
    };
    this.appendTimelineEntry(`${completedIsr.interrupt.label} EOI`);
  }

  public reset(): void {
    this.registers = createEmptyRegisters();
    this.cpu = {
      executionState: CpuExecutionState.Running,
      interruptsEnabled: true,
    };
    this.cpuRegisters = createInitialCpuRegisters();
    this.selectedInterrupt = null;
    this.activeIsr = null;
    this.activeIsrStack = [];
    this.contextStack = [];
    this.pendingNmi = false;
    this.nestedInterruptsEnabled = true;
    this.timeline = [];
    this.eventLog = [];
    this.nextEventId = 1;
    this.nextContextFrameId = 1;
    this.nextTimelineCycleNumber = 1;
    this.appendEvent(SimulationEventType.Reset, "Simülasyon sıfırlandı; IRR, IMR, ISR, context stack ve timeline temizlendi.");
  }

  public isInterruptLineMasked(line: number): boolean {
    return isRegisterBitSet(this.registers.imr, line);
  }

  private executeCurrentStep(): string {
    switch (this.cpu.executionState) {
      case CpuExecutionState.Running:
        return this.stepRunningProcessor();
      case CpuExecutionState.InterruptPending:
        return this.stepPendingInterrupt();
      case CpuExecutionState.Acknowledging:
        return this.stepAcknowledge();
      case CpuExecutionState.SavingContext:
        return this.stepSaveContext();
      case CpuExecutionState.ExecutingIsr:
        return this.stepExecuteIsrCycle();
      case CpuExecutionState.WaitingForEoi:
        this.appendEvent(SimulationEventType.ProcessorStep, "CPU EOI bekliyor.");
        return "EOI bekleniyor";
      case CpuExecutionState.RestoringContext:
        return this.stepRestoreContext();
      case CpuExecutionState.Returning:
        return this.stepReturnToMainProgram();
      case CpuExecutionState.Halted:
        return this.stepHaltedProcessor();
    }
  }

  private stepRunningProcessor(): string {
    const nextInterrupt = this.resolveNextInterrupt();
    if (!nextInterrupt) {
      this.incrementMainProgramCounter();
      this.appendEvent(SimulationEventType.ProcessorStep, "CPU ana programı çalıştırıyor; PC bir sonraki komuta ilerledi.");
      this.appendBlockedInterruptDiagnostics();
      return "MAIN";
    }

    this.selectedInterrupt = nextInterrupt;
    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.InterruptPending,
    };
    this.appendEvent(SimulationEventType.PendingResolved, `${nextInterrupt.label} CPU'ya iletilmeye hazır.`);
    return `${nextInterrupt.label} Pending`;
  }

  private stepPendingInterrupt(): string {
    const nextInterrupt = this.selectedInterrupt ?? this.resolveNextInterrupt();
    if (!nextInterrupt) {
      this.selectedInterrupt = null;
      this.cpu = {
        ...this.cpu,
        executionState: this.activeIsr ? CpuExecutionState.ExecutingIsr : CpuExecutionState.Running,
      };
      this.appendEvent(SimulationEventType.PendingResolved, "İşlenebilir kesme kalmadı; CPU önceki akışa döndü.");
      this.appendBlockedInterruptDiagnostics();
      return "Kesme bekleme iptal";
    }

    this.selectedInterrupt = nextInterrupt;
    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.Acknowledging,
    };
    const nestedText = this.activeIsr ? "nested ACK" : "ACK";
    this.appendEvent(SimulationEventType.PendingResolved, `${nextInterrupt.label} fixed priority ile seçildi.`);
    return `${nextInterrupt.label} ${nestedText}`;
  }

  private stepAcknowledge(): string {
    if (!this.selectedInterrupt) {
      this.cpu = {
        ...this.cpu,
        executionState: this.activeIsr ? CpuExecutionState.ExecutingIsr : CpuExecutionState.Running,
      };
      this.appendEvent(SimulationEventType.Acknowledge, "Acknowledge iptal edildi; seçilmiş kesme yok.");
      return "ACK iptal";
    }

    const acceptedInterrupt = this.selectedInterrupt;
    if (this.activeIsr) {
      const pausedIsr = this.activeIsr;
      this.activeIsrStack = [...this.activeIsrStack, pausedIsr];
      this.activeIsr = null;
      this.appendEvent(
        SimulationEventType.IsrPaused,
        `${pausedIsr.interrupt.label} ISR duraklatıldı; kalan süre ${pausedIsr.remainingCycles} cycle.`,
      );
      this.appendEvent(
        SimulationEventType.NestedInterruptAccepted,
        `${acceptedInterrupt.label}, aktif ${pausedIsr.interrupt.label} kesmesinden daha yüksek öncelikli olduğu için nested interrupt kabul edildi.`,
      );
    }

    if (acceptedInterrupt.kind === InterruptKind.Maskable && acceptedInterrupt.line !== null) {
      this.registers = {
        ...this.registers,
        irr: clearRegisterBit(this.registers.irr, acceptedInterrupt.line),
        isr: setRegisterBit(this.registers.isr, acceptedInterrupt.line),
      };
      this.appendEvent(
        SimulationEventType.Acknowledge,
        `CPU IRQ${acceptedInterrupt.line} kesmesini kabul etti; IRR temizlendi ve ISR set edildi.`,
      );
    } else {
      this.pendingNmi = false;
      this.appendEvent(SimulationEventType.Acknowledge, "CPU NMI kesmesini kabul etti.");
    }

    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.SavingContext,
    };
    return `${acceptedInterrupt.label} ACK`;
  }

  private stepSaveContext(): string {
    if (!this.selectedInterrupt) {
      this.cpu = {
        ...this.cpu,
        executionState: this.activeIsr ? CpuExecutionState.ExecutingIsr : CpuExecutionState.Running,
      };
      this.appendEvent(SimulationEventType.ContextSaved, "Context save iptal edildi; seçilmiş kesme yok.");
      return "Context save iptal";
    }

    const interrupt = this.selectedInterrupt;
    const stackDepth = this.contextStack.length + 1;
    const contextEntry: ContextStackEntry = {
      id: this.nextContextFrameId,
      interrupt,
      frame: {
        registers: { ...this.cpuRegisters },
      },
      timestamp: this.clock.now().toISOString(),
      stackDepth,
    };

    this.nextContextFrameId += 1;
    this.contextStack = [...this.contextStack, contextEntry];
    this.cpuRegisters = {
      ...decrementStackPointerForContextFrame(this.cpuRegisters),
      pc: interrupt.vectorAddress,
    };
    this.activeIsr = createActiveIsrExecution(interrupt);
    this.selectedInterrupt = null;
    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.ExecutingIsr,
    };

    this.appendEvent(SimulationEventType.ContextPushed, `CPU context frame stack'e eklendi. Stack depth: ${stackDepth}.`);
    this.appendEvent(SimulationEventType.ContextSaved, "Context save tamamlandı; dönüş noktası saklandı.");
    this.appendEvent(SimulationEventType.IsrStarted, `${interrupt.label} ISR akışı başlatıldı.`);
    return `${interrupt.label} Context Save`;
  }

  private stepExecuteIsrCycle(): string {
    if (!this.activeIsr) {
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.Running,
      };
      this.appendEvent(SimulationEventType.IsrStarted, "ISR çalıştırılamadı; aktif ISR yok.");
      return "ISR yok";
    }

    if (this.activeIsr.remainingCycles === 0) {
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.WaitingForEoi,
      };
      this.appendEvent(SimulationEventType.IsrCycleExecuted, `${this.activeIsr.interrupt.label} ISR cycle süresi tamamlandı; EOI bekleniyor.`);
      return `${this.activeIsr.interrupt.label} ISR tamam`;
    }

    const advancedIsr = advanceIsrExecution(this.activeIsr);
    this.activeIsr = advancedIsr;
    this.cpuRegisters = {
      ...this.cpuRegisters,
      pc: this.cpuRegisters.pc + PROGRAM_COUNTER_INCREMENT,
    };
    this.appendEvent(
      SimulationEventType.IsrCycleExecuted,
      `${advancedIsr.interrupt.label} ISR çalışıyor: ${advancedIsr.elapsedCycles}/${advancedIsr.totalCycles} cycle tamamlandı.`,
    );

    if (advancedIsr.remainingCycles === 0) {
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.WaitingForEoi,
      };
    }

    return `${advancedIsr.interrupt.label} ISR ${advancedIsr.elapsedCycles}/${advancedIsr.totalCycles}`;
  }

  private stepRestoreContext(): string {
    const poppedContext = this.contextStack.at(-1);
    if (!poppedContext) {
      this.activeIsr = null;
      this.selectedInterrupt = null;
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.Running,
      };
      this.appendEvent(SimulationEventType.ContextRestored, "Context restore iptal edildi; stack boş.");
      return "Context stack boş";
    }

    this.contextStack = this.contextStack.slice(0, -1);
    this.cpuRegisters = { ...poppedContext.frame.registers };
    this.appendEvent(
      SimulationEventType.ContextPopped,
      `${poppedContext.interrupt.label} context frame stack'ten çıkarıldı. Stack depth: ${this.contextStack.length}.`,
    );
    this.appendEvent(SimulationEventType.ContextRestored, "Context restore tamamlandı; CPU registerları geri yüklendi.");

    const pausedIsr = this.activeIsrStack.at(-1);
    if (pausedIsr) {
      this.activeIsrStack = this.activeIsrStack.slice(0, -1);
      this.activeIsr = pausedIsr;
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.ExecutingIsr,
      };
      this.appendEvent(
        SimulationEventType.IsrResumed,
        `${pausedIsr.interrupt.label} ISR kaldığı yerden devam ediyor; kalan süre ${pausedIsr.remainingCycles} cycle.`,
      );
      return `${pausedIsr.interrupt.label} ISR devam`;
    }

    const completedInterruptLabel = this.activeIsr?.interrupt.label ?? poppedContext.interrupt.label;
    this.activeIsr = null;
    this.selectedInterrupt = null;
    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.Returning,
    };
    return `${completedInterruptLabel} Context Restore`;
  }

  private stepReturnToMainProgram(): string {
    this.cpu = {
      ...this.cpu,
      executionState: CpuExecutionState.Running,
    };
    this.appendEvent(SimulationEventType.ReturnedToMainProgram, "Tüm ISR stack boşaldı; ana programa dönüldü.");
    return "Main Program dönüş";
  }

  private stepHaltedProcessor(): string {
    const nextInterrupt = this.resolveNextInterrupt();
    if (nextInterrupt) {
      this.selectedInterrupt = nextInterrupt;
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.InterruptPending,
      };
      this.appendEvent(SimulationEventType.PendingResolved, "HALTED CPU kesme isteği ile uyandı.");
      return `${nextInterrupt.label} HALT uyandırma`;
    }

    this.appendEvent(SimulationEventType.ProcessorStep, "CPU HALTED durumunda bekliyor.");
    return "HALTED";
  }

  private evaluateInterruptDelivery(): void {
    const nextInterrupt = this.resolveNextInterrupt();
    if (!nextInterrupt) {
      this.handleNoDeliverableInterrupt();
      return;
    }

    if (this.activeIsr) {
      this.evaluateNestedInterrupt(nextInterrupt);
      return;
    }

    if (this.canSetPendingState()) {
      this.selectedInterrupt = nextInterrupt;
      if (this.cpu.executionState !== CpuExecutionState.InterruptPending) {
        this.cpu = {
          ...this.cpu,
          executionState: CpuExecutionState.InterruptPending,
        };
        this.appendEvent(SimulationEventType.PendingResolved, `${nextInterrupt.label} CPU'ya iletildi.`);
      }
    }
  }

  private handleNoDeliverableInterrupt(): void {
    this.appendBlockedInterruptDiagnostics();
    if (this.cpu.executionState === CpuExecutionState.InterruptPending && !this.activeIsr) {
      this.selectedInterrupt = null;
      this.cpu = {
        ...this.cpu,
        executionState: CpuExecutionState.Running,
      };
      this.appendEvent(SimulationEventType.PendingResolved, "Bekleyen kesme maskeli veya IF kapalı; CPU ana programda kaldı.");
    }
  }

  private evaluateNestedInterrupt(nextInterrupt: InterruptVector): void {
    if (!this.activeIsr) {
      return;
    }

    if (!this.nestedInterruptsEnabled && nextInterrupt.kind === InterruptKind.Maskable) {
      this.appendEvent(
        SimulationEventType.InterruptRejectedByPriority,
        `${nextInterrupt.label} bekliyor; iç içe kesme desteği kapalı.`,
      );
      return;
    }

    if (this.canPreemptActiveIsr(nextInterrupt, this.activeIsr.interrupt)) {
      this.selectedInterrupt = nextInterrupt;
      if (this.cpu.executionState !== CpuExecutionState.InterruptPending) {
        this.cpu = {
          ...this.cpu,
          executionState: CpuExecutionState.InterruptPending,
        };
        this.appendEvent(SimulationEventType.PendingResolved, `${nextInterrupt.label} aktif ISR'yi kesmeye hazır.`);
      }
      return;
    }

    this.appendEvent(
      SimulationEventType.InterruptRejectedByPriority,
      `${nextInterrupt.label}, aktif ${this.activeIsr.interrupt.label} kesmesinden daha yüksek öncelikli olmadığı için IRR içinde bekliyor.`,
    );
  }

  private canSetPendingState(): boolean {
    return (
      this.cpu.executionState === CpuExecutionState.Running ||
      this.cpu.executionState === CpuExecutionState.InterruptPending ||
      this.cpu.executionState === CpuExecutionState.Halted
    );
  }

  private canPreemptActiveIsr(candidate: InterruptVector, activeInterrupt: InterruptVector): boolean {
    if (candidate.kind === InterruptKind.NonMaskable) {
      return true;
    }

    if (activeInterrupt.kind === InterruptKind.NonMaskable) {
      return false;
    }

    return candidate.priority < activeInterrupt.priority;
  }

  private resolveNextInterrupt(): InterruptVector | null {
    return this.priorityResolver.resolveNextInterrupt({
      interruptLines: this.interruptLines,
      registers: this.registers,
      interruptsEnabled: this.cpu.interruptsEnabled,
      pendingNmi: this.pendingNmi,
    });
  }

  private appendBlockedInterruptDiagnostics(): void {
    const pendingMaskableLines = this.interruptLines.filter((line) => isRegisterBitSet(this.registers.irr, line.line));
    const maskedLines = pendingMaskableLines.filter((line) => isRegisterBitSet(this.registers.imr, line.line));
    for (const line of maskedLines) {
      this.appendEvent(
        SimulationEventType.InterruptBlockedByMask,
        `IRQ${line.line} maskeli olduğu için CPU'ya iletilmedi; IRR içinde bekliyor.`,
      );
    }

    const unmaskedPendingLines = pendingMaskableLines.filter((line) => !isRegisterBitSet(this.registers.imr, line.line));
    if (!this.cpu.interruptsEnabled && unmaskedPendingLines.length > 0) {
      this.appendEvent(
        SimulationEventType.InterruptBlockedByCpuFlag,
        "CPU global interrupt flag kapalı olduğu için maskelenebilir kesmeler işlenmedi.",
      );
    }
  }

  private incrementMainProgramCounter(): void {
    this.cpuRegisters = {
      ...this.cpuRegisters,
      pc: this.cpuRegisters.pc + PROGRAM_COUNTER_INCREMENT,
    };
  }

  private appendTimelineEntry(description: string): void {
    const activeInterrupt = this.resolveVisibleActiveInterrupt();
    const entry: InterruptTimelineEntry = {
      cycleNumber: this.nextTimelineCycleNumber,
      cpuState: this.cpu.executionState,
      activeInterrupt: activeInterrupt?.label ?? null,
      activeVector: activeInterrupt?.vectorAddress ?? null,
      irr: this.registers.irr,
      imr: this.registers.imr,
      isr: this.registers.isr,
      description,
    };

    this.nextTimelineCycleNumber += 1;
    this.timeline = [...this.timeline, entry].slice(-MAX_TIMELINE_ENTRIES);
    this.appendEvent(SimulationEventType.TimelineAdvanced, `Timeline cycle ${entry.cycleNumber}: ${description}.`);
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

  private resolveVisibleActiveInterrupt(): InterruptVector | null {
    if (
      this.selectedInterrupt &&
      (this.cpu.executionState === CpuExecutionState.InterruptPending ||
        this.cpu.executionState === CpuExecutionState.Acknowledging ||
        this.cpu.executionState === CpuExecutionState.SavingContext)
    ) {
      return { ...this.selectedInterrupt };
    }

    return this.activeIsr ? { ...this.activeIsr.interrupt } : null;
  }

  private cloneActiveIsrExecution(execution: ActiveIsrExecution): ActiveIsrExecution {
    return {
      ...execution,
      interrupt: { ...execution.interrupt },
    };
  }

  private cloneContextStackEntry(entry: ContextStackEntry): ContextStackEntry {
    return {
      ...entry,
      interrupt: { ...entry.interrupt },
      frame: {
        registers: { ...entry.frame.registers },
      },
    };
  }
}
