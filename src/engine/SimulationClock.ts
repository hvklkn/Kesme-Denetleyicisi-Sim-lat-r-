export interface SimulationClock {
  now(): Date;
}

export class SystemSimulationClock implements SimulationClock {
  public now(): Date {
    return new Date();
  }
}
