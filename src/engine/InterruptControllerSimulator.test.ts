import { describe, expect, it } from "vitest";
import { CpuExecutionState, INITIAL_PROGRAM_COUNTER, InterruptKind } from "../domain";
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
});
