/**
 * Lightweight ECS client mock for deploy-script unit tests (AC-050).
 * Avoids external AWS SDK mock packages in test files.
 */
import { vi } from 'vitest';

type CommandInput = Record<string, unknown>;

interface DescribeServicesMatch {
  cluster?: string;
  services?: string[];
}

interface DescribeTaskDefinitionMatch {
  taskDefinition?: string;
}

type Handler = (input: CommandInput) => unknown | Promise<unknown>;

export class MockEcsClient {
  private describeServicesHandlers: Array<{
    match?: DescribeServicesMatch;
    handler: Handler;
    once?: boolean;
  }> = [];

  private describeTaskDefinitionHandlers: Array<{
    match?: DescribeTaskDefinitionMatch;
    handler: Handler;
    once?: boolean;
  }> = [];

  private defaultDescribeServices: Handler = () => ({ services: [] });

  send = vi.fn(async (command: { constructor?: { name?: string }; input?: CommandInput }) => {
    const name = command.constructor?.name ?? '';
    const input = command.input ?? {};

    if (name === 'DescribeServicesCommand') {
      const idx = this.describeServicesHandlers.findIndex((entry) => {
        if (!entry.match) return true;
        return (
          entry.match.cluster === input['cluster'] &&
          JSON.stringify(entry.match.services) === JSON.stringify(input['services'])
        );
      });
      const entry = idx >= 0 ? this.describeServicesHandlers[idx] : undefined;
      const handler = entry?.handler ?? this.defaultDescribeServices;
      if (entry?.once) {
        this.describeServicesHandlers.splice(idx, 1);
      }
      return handler(input);
    }

    if (name === 'DescribeTaskDefinitionCommand') {
      const entry = this.describeTaskDefinitionHandlers.find((h) => {
        if (!h.match) return true;
        return h.match.taskDefinition === input['taskDefinition'];
      });
      const handler = entry?.handler ?? (() => ({ taskDefinition: {} }));
      if (entry?.once) {
        const i = this.describeTaskDefinitionHandlers.indexOf(entry);
        if (i >= 0) this.describeTaskDefinitionHandlers.splice(i, 1);
      }
      return handler(input);
    }

    throw new Error(`Unexpected ECS command: ${name}`);
  });

  onDescribeServices(match: DescribeServicesMatch | undefined, handler: Handler, once = false): this {
    this.describeServicesHandlers.push({ match, handler, once });
    return this;
  }

  onDescribeTaskDefinition(match: DescribeTaskDefinitionMatch | undefined, handler: Handler, once = false): this {
    this.describeTaskDefinitionHandlers.push({ match, handler, once });
    return this;
  }

  resolvesDescribeServices(response: unknown, match?: DescribeServicesMatch): this {
    return this.onDescribeServices(match, () => response);
  }

  resolvesDescribeServicesOnce(response: unknown, match?: DescribeServicesMatch): this {
    return this.onDescribeServices(match, () => response, true);
  }

  resolvesDescribeTaskDefinition(response: unknown, match?: DescribeTaskDefinitionMatch): this {
    return this.onDescribeTaskDefinition(match, () => response);
  }

  callsFakeDescribeServices(fn: (input: DescribeServicesMatch) => unknown | Promise<unknown>): this {
    return this.onDescribeServices(undefined, (input) =>
      fn({
        cluster: input['cluster'] as string | undefined,
        services: input['services'] as string[] | undefined,
      }),
    );
  }

  reset(): void {
    this.describeServicesHandlers = [];
    this.describeTaskDefinitionHandlers = [];
    this.send.mockClear();
  }
}
