import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import pino from 'pino';
import type { DriverFactory, DriverRegistry } from './driver.port.js';

const logger = pino({ name: 'plugin-loader' });

export async function loadPlugins(dir: string | undefined, registry: DriverRegistry): Promise<void> {
  if (!dir || !existsSync(dir)) return;
  const files = await readdir(dir);
  for (const file of files) {
    if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;
    const path = join(dir, file);
    try {
      const mod = (await import(pathToFileURL(path).toString())) as { default?: DriverFactory; factory?: DriverFactory };
      const factory = mod.default ?? mod.factory;
      if (!factory || typeof factory.create !== 'function') {
        logger.warn({ path }, 'Plugin did not export a DriverFactory');
        continue;
      }
      registry.register(factory);
      logger.info({ path, type: factory.type }, 'Plugin driver registered');
    } catch (err) {
      logger.error({ err, path }, 'Failed to load plugin');
    }
  }
}
