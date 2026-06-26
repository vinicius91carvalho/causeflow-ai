export interface SessionState {
  activeIncidents: Set<string>;
  breakGlassTripped: boolean;
  breakGlassReason?: string;
  breakGlassAt?: number;
}

export class SessionManager {
  private state: SessionState = {
    activeIncidents: new Set(),
    breakGlassTripped: false,
  };

  constructor(
    private readonly requireActiveIncident: boolean = false,
  ) {}

  markIncidentActive(incidentId: string): void {
    this.state.activeIncidents.add(incidentId);
  }

  markIncidentClosed(incidentId: string): void {
    this.state.activeIncidents.delete(incidentId);
  }

  tripBreakGlass(reason: string): void {
    this.state.breakGlassTripped = true;
    this.state.breakGlassReason = reason;
    this.state.breakGlassAt = Date.now();
  }

  resetBreakGlass(): void {
    this.state.breakGlassTripped = false;
    this.state.breakGlassReason = undefined;
    this.state.breakGlassAt = undefined;
  }

  canAccept(incidentId?: string): { ok: boolean; reason?: string } {
    if (this.state.breakGlassTripped) {
      return { ok: false, reason: `break-glass tripped: ${this.state.breakGlassReason ?? 'unspecified'}` };
    }
    if (this.requireActiveIncident) {
      if (!incidentId) return { ok: false, reason: 'incidentId required for time-boxed mode' };
      if (!this.state.activeIncidents.has(incidentId)) {
        return { ok: false, reason: `incident ${incidentId} is not active` };
      }
    }
    return { ok: true };
  }

  snapshot(): { activeIncidents: string[]; breakGlassTripped: boolean; breakGlassReason?: string } {
    return {
      activeIncidents: Array.from(this.state.activeIncidents),
      breakGlassTripped: this.state.breakGlassTripped,
      breakGlassReason: this.state.breakGlassReason,
    };
  }
}
