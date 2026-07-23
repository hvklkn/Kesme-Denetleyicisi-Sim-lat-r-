import { describe, expect, it } from "vitest";
import {
  CpuExecutionState,
  INITIAL_PROGRAM_COUNTER,
  InterruptKind,
  MAX_EVENT_LOG_ENTRIES,
  type SimulationEvent,
  SimulationEventType,
} from "../domain";
import { isRegisterBitSet } from "../domain/registers";
import { InterruptControllerSimulator } from "./InterruptControllerSimulator";

const IRQ0 = 0;
const IRQ1 = 1;
const IRQ2 = 2;
const IRQ4 = 4;
const IRQ5 = 5;
const IRQ6 = 6;
const IRQ1_DURATION_CYCLES = 4;
const IRQ4_DURATION_CYCLES = 6;
const IRQ6_DURATION_CYCLES = 8;
const IRQ4_EXECUTED_BEFORE_PREEMPTION = 2;
const STEP_GUARD_LIMIT = 40;

function advanceUntil(simulator: InterruptControllerSimulator, targetState: CpuExecutionState): void {
  for (let stepCount = 0; stepCount < STEP_GUARD_LIMIT; stepCount += 1) {
    if (simulator.getSnapshot().cpu.executionState === targetState) {
      return;
    }
    simulator.step();
  }

  throw new Error(`Simülasyon ${targetState} durumuna ilerlemedi.`);
}

function startMaskableIsr(simulator: InterruptControllerSimulator, line: number): void {
  simulator.createInterrupt(line);
  advanceUntil(simulator, CpuExecutionState.ExecutingIsr);
}

function runActiveIsrCycles(simulator: InterruptControllerSimulator, cycleCount: number): void {
  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    simulator.step();
  }
}

function acknowledgeNestedInterrupt(simulator: InterruptControllerSimulator): void {
  advanceUntil(simulator, CpuExecutionState.Acknowledging);
  simulator.step();
}

function stepMany(simulator: InterruptControllerSimulator, count: number): void {
  for (let index = 0; index < count; index += 1) {
    simulator.step();
  }
}

function eventsByType(simulator: InterruptControllerSimulator, type: SimulationEventType): readonly SimulationEvent[] {
  return simulator.getSnapshot().eventLog.filter((event) => event.type === type);
}

describe("InterruptControllerSimulator", () => {
  it("maskeli IRQ CPU tarafından işlenmez", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.maskInterruptLine(IRQ0);
    simulator.createInterrupt(IRQ0);
    simulator.step();

    const snapshot = simulator.getSnapshot();
    expect(isRegisterBitSet(snapshot.registers.irr, IRQ0)).toBe(true);
    expect(isRegisterBitSet(snapshot.registers.isr, IRQ0)).toBe(false);
    expect(snapshot.cpu.executionState).toBe(CpuExecutionState.Running);
  });

  it("maskesi kaldırılan bekleyen IRQ işlenebilir", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.maskInterruptLine(IRQ1);
    simulator.createInterrupt(IRQ1);
    simulator.unmaskInterruptLine(IRQ1);
    advanceUntil(simulator, CpuExecutionState.Acknowledging);
    simulator.step();

    const snapshot = simulator.getSnapshot();
    expect(snapshot.activeInterrupt?.line).toBe(IRQ1);
    expect(isRegisterBitSet(snapshot.registers.irr, IRQ1)).toBe(false);
    expect(isRegisterBitSet(snapshot.registers.isr, IRQ1)).toBe(true);
  });

  it("yüksek öncelikli IRQ önce seçilir", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.createInterrupt(IRQ5);
    simulator.createInterrupt(IRQ2);
    advanceUntil(simulator, CpuExecutionState.Acknowledging);

    expect(simulator.getSnapshot().activeInterrupt?.line).toBe(IRQ2);
  });

  it("global interrupt flag kapalıyken normal IRQ işlenmez", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.setGlobalInterruptsEnabled(false);
    simulator.createInterrupt(IRQ0);
    simulator.step();

    const snapshot = simulator.getSnapshot();
    expect(isRegisterBitSet(snapshot.registers.irr, IRQ0)).toBe(true);
    expect(isRegisterBitSet(snapshot.registers.isr, IRQ0)).toBe(false);
    expect(snapshot.cpu.executionState).toBe(CpuExecutionState.Running);
  });

  it("NMI interrupt flag kapalı olsa bile işlenir", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.setGlobalInterruptsEnabled(false);
    simulator.createNonMaskableInterrupt();
    advanceUntil(simulator, CpuExecutionState.Acknowledging);

    const snapshot = simulator.getSnapshot();
    expect(snapshot.activeInterrupt?.kind).toBe(InterruptKind.NonMaskable);
    expect(snapshot.activeInterrupt?.label).toBe("NMI");
  });

  it("EOI sonrası ISR biti temizlenir", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.createInterrupt(IRQ0);
    advanceUntil(simulator, CpuExecutionState.WaitingForEoi);
    expect(isRegisterBitSet(simulator.getSnapshot().registers.isr, IRQ0)).toBe(true);

    simulator.sendEndOfInterrupt();

    const snapshot = simulator.getSnapshot();
    expect(snapshot.cpu.executionState).toBe(CpuExecutionState.RestoringContext);
    expect(isRegisterBitSet(snapshot.registers.isr, IRQ0)).toBe(false);
  });

  it("reset sonrası tüm kayıtlar sıfırlanır", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.maskInterruptLine(IRQ2);
    simulator.createInterrupt(IRQ0);
    simulator.createNonMaskableInterrupt();
    advanceUntil(simulator, CpuExecutionState.Acknowledging);
    simulator.reset();

    const snapshot = simulator.getSnapshot();
    expect(snapshot.registers).toEqual({ irr: 0, imr: 0, isr: 0 });
    expect(snapshot.pendingNmi).toBe(false);
    expect(snapshot.activeInterrupt).toBeNull();
    expect(snapshot.cpu).toEqual({
      executionState: CpuExecutionState.Running,
      interruptsEnabled: true,
    });
  });

  it("ISR belirtilen cycle sayısından önce tamamlanmaz", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ1);
    simulator.step();

    const snapshot = simulator.getSnapshot();
    expect(snapshot.cpu.executionState).toBe(CpuExecutionState.ExecutingIsr);
    expect(snapshot.activeIsr?.elapsedCycles).toBe(1);
    expect(snapshot.activeIsr?.remainingCycles).toBe(IRQ1_DURATION_CYCLES - 1);
  });

  it("ISR cycle sayısı tamamlanınca WAITING_FOR_EOI durumuna geçer", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ1);
    runActiveIsrCycles(simulator, IRQ1_DURATION_CYCLES);

    const snapshot = simulator.getSnapshot();
    expect(snapshot.cpu.executionState).toBe(CpuExecutionState.WaitingForEoi);
    expect(snapshot.activeIsr?.remainingCycles).toBe(0);
    expect(snapshot.activeIsr?.progressPercentage).toBe(100);
  });

  it("IRQ6 ISR 8 cycle boyunca çalışır", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ6);
    runActiveIsrCycles(simulator, IRQ6_DURATION_CYCLES - 1);

    expect(simulator.getSnapshot().cpu.executionState).toBe(CpuExecutionState.ExecutingIsr);
    simulator.step();
    expect(simulator.getSnapshot().cpu.executionState).toBe(CpuExecutionState.WaitingForEoi);
  });

  it("context save sırasında stack'e frame eklenir", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ1);

    const snapshot = simulator.getSnapshot();
    expect(snapshot.contextStack).toHaveLength(1);
    expect(snapshot.contextStack[0]?.interrupt.line).toBe(IRQ1);
    expect(snapshot.contextStack[0]?.stackDepth).toBe(1);
  });

  it("context restore sırasında frame stack'ten çıkarılır", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ1);
    runActiveIsrCycles(simulator, IRQ1_DURATION_CYCLES);
    simulator.sendEndOfInterrupt();
    simulator.step();

    const snapshot = simulator.getSnapshot();
    expect(snapshot.contextStack).toHaveLength(0);
    expect(snapshot.cpu.executionState).toBe(CpuExecutionState.Returning);
  });

  it("CPU registerları restore sonrasında eski değerlerine döner", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.step();
    const registersBeforeInterrupt = simulator.getSnapshot().cpuRegisters;
    startMaskableIsr(simulator, IRQ1);
    runActiveIsrCycles(simulator, IRQ1_DURATION_CYCLES);
    simulator.sendEndOfInterrupt();
    simulator.step();

    expect(simulator.getSnapshot().cpuRegisters).toEqual(registersBeforeInterrupt);
    expect(registersBeforeInterrupt.pc).toBe(INITIAL_PROGRAM_COUNTER + 1);
  });

  it("yüksek öncelikli IRQ düşük öncelikli aktif ISR'yi kesebilir", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ4);
    runActiveIsrCycles(simulator, IRQ4_EXECUTED_BEFORE_PREEMPTION);
    simulator.createInterrupt(IRQ1);
    acknowledgeNestedInterrupt(simulator);

    const snapshot = simulator.getSnapshot();
    expect(snapshot.activeIsrStack).toHaveLength(1);
    expect(snapshot.activeIsrStack[0]?.interrupt.line).toBe(IRQ4);
    expect(snapshot.activeIsrStack[0]?.remainingCycles).toBe(IRQ4_DURATION_CYCLES - IRQ4_EXECUTED_BEFORE_PREEMPTION);
    expect(isRegisterBitSet(snapshot.registers.isr, IRQ4)).toBe(true);
    expect(isRegisterBitSet(snapshot.registers.isr, IRQ1)).toBe(true);
  });

  it("düşük öncelikli IRQ aktif ISR'yi kesemez", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ1);
    simulator.step();
    simulator.createInterrupt(IRQ4);

    const snapshot = simulator.getSnapshot();
    expect(snapshot.cpu.executionState).toBe(CpuExecutionState.ExecutingIsr);
    expect(snapshot.activeIsr?.interrupt.line).toBe(IRQ1);
    expect(snapshot.activeIsrStack).toHaveLength(0);
    expect(isRegisterBitSet(snapshot.registers.irr, IRQ4)).toBe(true);
  });

  it("NMI her aktif ISR'yi kesebilir", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ1);
    simulator.step();
    simulator.createNonMaskableInterrupt();
    acknowledgeNestedInterrupt(simulator);

    const snapshot = simulator.getSnapshot();
    expect(snapshot.activeIsrStack).toHaveLength(1);
    expect(snapshot.activeInterrupt?.kind).toBe(InterruptKind.NonMaskable);
  });

  it("nested interrupt kapalıyken hiçbir normal IRQ aktif ISR'yi kesemez", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ4);
    simulator.setNestedInterruptsEnabled(false);
    simulator.createInterrupt(IRQ1);

    const snapshot = simulator.getSnapshot();
    expect(snapshot.cpu.executionState).toBe(CpuExecutionState.ExecutingIsr);
    expect(snapshot.activeIsr?.interrupt.line).toBe(IRQ4);
    expect(snapshot.activeIsrStack).toHaveLength(0);
    expect(isRegisterBitSet(snapshot.registers.irr, IRQ1)).toBe(true);
  });

  it("nested ISR EOI sonrasında önceki ISR kaldığı cycle'dan devam eder", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ4);
    runActiveIsrCycles(simulator, IRQ4_EXECUTED_BEFORE_PREEMPTION);
    simulator.createInterrupt(IRQ1);
    acknowledgeNestedInterrupt(simulator);
    simulator.step();
    runActiveIsrCycles(simulator, IRQ1_DURATION_CYCLES);
    simulator.sendEndOfInterrupt();
    simulator.step();

    const snapshot = simulator.getSnapshot();
    expect(snapshot.cpu.executionState).toBe(CpuExecutionState.ExecutingIsr);
    expect(snapshot.activeIsr?.interrupt.line).toBe(IRQ4);
    expect(snapshot.activeIsr?.remainingCycles).toBe(IRQ4_DURATION_CYCLES - IRQ4_EXECUTED_BEFORE_PREEMPTION);
  });

  it("nested ISR sırasında iki ISR biti birlikte set olur", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ4);
    simulator.createInterrupt(IRQ1);
    acknowledgeNestedInterrupt(simulator);

    const snapshot = simulator.getSnapshot();
    expect(isRegisterBitSet(snapshot.registers.isr, IRQ4)).toBe(true);
    expect(isRegisterBitSet(snapshot.registers.isr, IRQ1)).toBe(true);
  });

  it("içteki ISR tamamlanınca yalnızca kendi ISR biti temizlenir", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ4);
    simulator.createInterrupt(IRQ1);
    acknowledgeNestedInterrupt(simulator);
    simulator.step();
    runActiveIsrCycles(simulator, IRQ1_DURATION_CYCLES);
    simulator.sendEndOfInterrupt();

    const snapshot = simulator.getSnapshot();
    expect(isRegisterBitSet(snapshot.registers.isr, IRQ1)).toBe(false);
    expect(isRegisterBitSet(snapshot.registers.isr, IRQ4)).toBe(true);
  });

  it("reset context stack, ISR stack ve timeline verilerini temizler", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ4);
    simulator.createInterrupt(IRQ1);
    acknowledgeNestedInterrupt(simulator);
    simulator.step();
    expect(simulator.getSnapshot().timeline.length).toBeGreaterThan(0);

    simulator.reset();

    const snapshot = simulator.getSnapshot();
    expect(snapshot.contextStack).toHaveLength(0);
    expect(snapshot.activeIsrStack).toHaveLength(0);
    expect(snapshot.timeline).toHaveLength(0);
    expect(snapshot.activeIsr).toBeNull();
  });

  it("maskeli yüksek öncelikli kesme nested interrupt başlatmaz", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ4);
    simulator.maskInterruptLine(IRQ1);
    simulator.createInterrupt(IRQ1);

    const snapshot = simulator.getSnapshot();
    expect(snapshot.cpu.executionState).toBe(CpuExecutionState.ExecutingIsr);
    expect(snapshot.activeIsr?.interrupt.line).toBe(IRQ4);
    expect(snapshot.activeIsrStack).toHaveLength(0);
    expect(isRegisterBitSet(snapshot.registers.irr, IRQ1)).toBe(true);
  });

  it("IF kapalıyken normal nested interrupt başlamaz ancak NMI çalışır", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ4);
    simulator.setGlobalInterruptsEnabled(false);
    simulator.createInterrupt(IRQ1);
    expect(simulator.getSnapshot().cpu.executionState).toBe(CpuExecutionState.ExecutingIsr);
    expect(simulator.getSnapshot().activeIsrStack).toHaveLength(0);

    simulator.createNonMaskableInterrupt();
    acknowledgeNestedInterrupt(simulator);

    const snapshot = simulator.getSnapshot();
    expect(snapshot.activeInterrupt?.kind).toBe(InterruptKind.NonMaskable);
    expect(snapshot.activeIsrStack).toHaveLength(1);
    expect(isRegisterBitSet(snapshot.registers.irr, IRQ1)).toBe(true);
  });

  it("MAIN durumunda art arda step çalıştırıldığında normal CPU mesajlarını yığmaz", () => {
    const simulator = new InterruptControllerSimulator();

    stepMany(simulator, 20);

    const normalCpuMessages = simulator
      .getSnapshot()
      .eventLog.filter((event) => event.message === "CPU ana programı çalıştırıyor; PC bir sonraki komuta ilerledi.");
    expect(normalCpuMessages).toHaveLength(0);
  });

  it("Timeline art arda step sonunda her cycle için ilerler", () => {
    const simulator = new InterruptControllerSimulator();

    stepMany(simulator, 20);

    const timeline = simulator.getSnapshot().timeline;
    expect(timeline).toHaveLength(20);
    expect(timeline.at(-1)?.cycleNumber).toBe(20);
  });

  it("maskeli IRQ için InterruptBlockedByMask olayı yalnızca bir kez oluşturulur", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.maskInterruptLine(IRQ0);
    simulator.createInterrupt(IRQ0);

    expect(eventsByType(simulator, SimulationEventType.InterruptBlockedByMask)).toHaveLength(1);
  });

  it("aynı maskeli IRQ sonraki cycle'larda beklerken tekrar loglanmaz", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.maskInterruptLine(IRQ0);
    simulator.createInterrupt(IRQ0);
    stepMany(simulator, 8);

    expect(eventsByType(simulator, SimulationEventType.InterruptBlockedByMask)).toHaveLength(1);
  });

  it("IRQ maskesi kaldırılıp tekrar maskelendiğinde engelleme olayı yeniden loglanabilir", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.maskInterruptLine(IRQ0);
    simulator.createInterrupt(IRQ0);
    simulator.unmaskInterruptLine(IRQ0);
    simulator.maskInterruptLine(IRQ0);

    const blockedEvents = eventsByType(simulator, SimulationEventType.InterruptBlockedByMask);
    expect(blockedEvents).toHaveLength(2);
    expect(blockedEvents.every((event) => event.message.includes("IRQ0 maskeli olduğu için"))).toBe(true);
  });

  it("farklı maskeli IRQ'lar ayrı engelleme olayları olarak loglanır", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.maskInterruptLine(IRQ0);
    simulator.maskInterruptLine(IRQ1);
    simulator.createInterrupt(IRQ0);
    simulator.createInterrupt(IRQ1);

    const blockedMessages = eventsByType(simulator, SimulationEventType.InterruptBlockedByMask).map((event) => event.message);
    expect(blockedMessages).toHaveLength(2);
    expect(blockedMessages).toContain("IRQ0 maskeli olduğu için CPU'ya iletilmedi; IRR içinde bekliyor.");
    expect(blockedMessages).toContain("IRQ1 maskeli olduğu için CPU'ya iletilmedi; IRR içinde bekliyor.");
  });

  it("TimelineAdvanced olaylarını Event Log görünümüne dahil etmez", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.step();

    const snapshot = simulator.getSnapshot();
    expect(snapshot.timeline).toHaveLength(1);
    expect(eventsByType(simulator, SimulationEventType.TimelineAdvanced)).toHaveLength(0);
    expect(snapshot.eventLog.some((event) => event.message.startsWith("Timeline cycle"))).toBe(false);
  });

  it("IsrCycleExecuted olaylarını Event Log görünümüne dahil etmez", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ1);
    simulator.step();

    expect(eventsByType(simulator, SimulationEventType.IsrCycleExecuted)).toHaveLength(0);
    expect(simulator.getSnapshot().eventLog.some((event) => event.message.includes("ISR çalışıyor:"))).toBe(false);
  });

  it("IRQ kabulü, ISR başlangıcı, EOI ve restore olaylarını Event Log'da gösterir", () => {
    const simulator = new InterruptControllerSimulator();

    startMaskableIsr(simulator, IRQ1);
    runActiveIsrCycles(simulator, IRQ1_DURATION_CYCLES);
    simulator.sendEndOfInterrupt();
    simulator.step();

    const eventTypes = simulator.getSnapshot().eventLog.map((event) => event.type);
    expect(eventTypes).toContain(SimulationEventType.InterruptAccepted);
    expect(eventTypes).toContain(SimulationEventType.IsrStarted);
    expect(eventTypes).toContain(SimulationEventType.EoiSent);
    expect(eventTypes).toContain(SimulationEventType.ContextPopped);
    expect(eventTypes).toContain(SimulationEventType.ContextRestored);
  });

  it("reset sonrası eski dedupe durumu bekleyen IRQ kalmadığında taşınmaz", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.maskInterruptLine(IRQ0);
    simulator.createInterrupt(IRQ0);
    simulator.reset();
    simulator.step();

    expect(eventsByType(simulator, SimulationEventType.InterruptBlockedByMask)).toHaveLength(0);
  });

  it("reset sonrası aynı olay yeniden gerçekleşirse log yazılabilir", () => {
    const simulator = new InterruptControllerSimulator();

    simulator.maskInterruptLine(IRQ0);
    simulator.createInterrupt(IRQ0);
    simulator.reset();
    simulator.maskInterruptLine(IRQ0);
    simulator.createInterrupt(IRQ0);

    expect(eventsByType(simulator, SimulationEventType.InterruptBlockedByMask)).toHaveLength(1);
  });

  it("Event Log maksimum kayıt sınırını aşmaz", () => {
    const simulator = new InterruptControllerSimulator();

    for (let index = 0; index < MAX_EVENT_LOG_ENTRIES + 20; index += 1) {
      const line = index % 8;
      simulator.maskInterruptLine(line);
      simulator.unmaskInterruptLine(line);
    }

    expect(simulator.getSnapshot().eventLog.length).toBeLessThanOrEqual(MAX_EVENT_LOG_ENTRIES);
  });
});
