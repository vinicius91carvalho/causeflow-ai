declare module 'fast-redact' {
  export interface FastRedactOptions {
    paths: string[];
    censor?: unknown;
    serialize?: false | ((o: unknown) => string);
    remove?: boolean;
    strict?: boolean;
  }

  type Redact = (input: Record<string, unknown>) => string | Record<string, unknown>;

  export default function fastRedact(options: FastRedactOptions): Redact;
}
