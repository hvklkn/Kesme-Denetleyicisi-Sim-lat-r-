import { create } from "zustand";
import { InterruptControllerSimulator } from "../engine/InterruptControllerSimulator";
import { CpuExecutionState, type SimulationSnapshot } from "../domain";

const simulator = new InterruptControllerSimulator();

interface SimulationStore {
  readonly snapshot: SimulationSnapshot;
  readonly isAutoRunning: boolean;
  createInterrupt(line: number): void;
  createNonMaskableInterrupt(): void;
  toggleInterruptMask(line: number): void;
  setGlobalInterruptsEnabled(enabled: boolean): void;
  step(): void;
  runAutomaticStep(): void;
  sendEndOfInterrupt(): void;
  reset(): void;
  setAutoRunning(isAutoRunning: boolean): void;
}

function readSnapshot(): SimulationSnapshot {
  return simulator.getSnapshot();
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  snapshot: readSnapshot(),
  isAutoRunning: false,
  createInterrupt: (line) => {
    simulator.createInterrupt(line);
    set({ snapshot: readSnapshot() });
  },
  createNonMaskableInterrupt: () => {
    simulator.createNonMaskableInterrupt();
    set({ snapshot: readSnapshot() });
  },
  toggleInterruptMask: (line) => {
    if (simulator.isInterruptLineMasked(line)) {
      simulator.unmaskInterruptLine(line);
    } else {
      simulator.maskInterruptLine(line);
    }
    set({ snapshot: readSnapshot() });
  },
  setGlobalInterruptsEnabled: (enabled) => {
    simulator.setGlobalInterruptsEnabled(enabled);
    set({ snapshot: readSnapshot() });
  },
  step: () => {
    simulator.step();
    set({ snapshot: readSnapshot() });
  },
  runAutomaticStep: () => {
    const state = get().snapshot.cpu.executionState;
    if (state === CpuExecutionState.WaitingForEoi) {
      simulator.sendEndOfInterrupt();
    } else {
      simulator.step();
    }
    set({ snapshot: readSnapshot() });
  },
  sendEndOfInterrupt: () => {
    simulator.sendEndOfInterrupt();
    set({ snapshot: readSnapshot() });
  },
  reset: () => {
    simulator.reset();
    set({ snapshot: readSnapshot(), isAutoRunning: false });
  },
  setAutoRunning: (isAutoRunning) => set({ isAutoRunning }),
}));
