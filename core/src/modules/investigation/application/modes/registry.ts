import type { InvestigationMode, InvestigationModeName } from './types.js';

export class UnknownInvestigationModeError extends Error {
    constructor(name: string, available: readonly string[]) {
        super(`Unknown investigation mode "${name}". Available: ${available.join(', ')}`);
        this.name = 'UnknownInvestigationModeError';
    }
}

/**
 * Small in-memory registry. Constructed once at boot with every mode
 * implementation wired by the composition root. The dispatcher is the
 * only consumer — nothing else should touch this directly.
 */
export class InvestigationModeRegistry {
    private readonly modes = new Map<InvestigationModeName, InvestigationMode>();

    constructor(modes: InvestigationMode[]) {
        for (const mode of modes) {
            if (this.modes.has(mode.name)) {
                throw new Error(`Duplicate investigation mode registration: ${mode.name}`);
            }
            this.modes.set(mode.name, mode);
        }
    }

    get(name: InvestigationModeName): InvestigationMode {
        const mode = this.modes.get(name);
        if (!mode) {
            throw new UnknownInvestigationModeError(name, Array.from(this.modes.keys()));
        }
        return mode;
    }

    has(name: InvestigationModeName): boolean {
        return this.modes.has(name);
    }

    list(): InvestigationMode[] {
        return Array.from(this.modes.values());
    }
}
