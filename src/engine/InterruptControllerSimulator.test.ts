import { describe, expect, it } from "vitest";
import { CpuExecutionState, InterruptKind } from "../domain";
import { isRegisterBitSet } from "../domain/registers";
import { InterruptControllerSimulator } from "./InterruptControllerSimulator";

const IRQ0 = 0;
const IRQ1 = 1;
const IRQ2 = 2;
const IRQ5 = 5;
const STEP_GUARD_LIMIT = 12;

function advanceUntil(simulator: InterruptControllerSimulator, targetState: CpuExecutionState): void {
  for (let stepCount = 0; stepCount < STEP_GUARD_LIMIT; stepCount += 1) {
    if (simulator.getSnapshot().cpu.executionState === targetState) {
      return;
    }
    simulator.step();
  }

  throw new Error(`Simülasyon ${targetState} durumuna ilerlemedi.`);
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
});
