/**
 * Type declarations for net-snmp module
 */
declare module 'net-snmp' {
  export enum SecurityLevel {
    noAuthNoPriv = 1,
    authNoPriv = 2,
    authPriv = 3,
  }

  export enum AuthProtocols {
    none = 0,
    md5 = 1,
    sha = 2,
    sha224 = 3,
    sha256 = 4,
    sha384 = 5,
    sha512 = 6,
  }

  export enum PrivProtocols {
    none = 0,
    des = 1,
    aes = 2,
    aes256b = 3,
    aes256r = 4,
  }

  export enum ObjectType {
    Boolean = 1,
    Integer = 2,
    OctetString = 4,
    Null = 5,
    OID = 6,
    IpAddress = 64,
    Counter = 65,
    Gauge = 66,
    TimeTicks = 67,
    Opaque = 68,
    Counter64 = 70,
    NoSuchObject = 128,
    NoSuchInstance = 129,
    EndOfMibView = 130,
  }

  export interface Varbind {
    oid: string;
    type: ObjectType;
    value: Buffer | string | number | null;
  }

  export interface SessionOptions {
    port?: number;
    retries?: number;
    timeout?: number;
    transport?: string;
    trapPort?: number;
    version?: number;
    idBitsSize?: number;
    context?: string;
  }

  export interface Session {
    get(oids: string[], callback: (error: Error | null, varbinds: Varbind[]) => void): void;
    getNext(oids: string[], callback: (error: Error | null, varbinds: Varbind[]) => void): void;
    getBulk(oids: string[], nonRepeaters: number, maxRepetitions: number, callback: (error: Error | null, varbinds: Varbind[]) => void): void;
    set(varbinds: Varbind[], callback: (error: Error | null, varbinds: Varbind[]) => void): void;
    subtree(oid: string, maxRepetitions: number, feedCallback: (varbinds: Varbind[]) => void, doneCallback: (error: Error | null) => void): void;
    table(oid: string, maxRepetitions: number, callback: (error: Error | null, table: Record<string, Record<string, unknown>>) => void): void;
    walk(oid: string, maxRepetitions: number, feedCallback: (varbinds: Varbind[]) => void, doneCallback: (error: Error | null) => void): void;
    close(): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
  }

  export interface UserOptions {
    name: string;
    level: SecurityLevel;
    authProtocol?: AuthProtocols;
    authKey?: string;
    privProtocol?: PrivProtocols;
    privKey?: string;
  }

  export function createV3Session(
    target: string,
    user: UserOptions,
    options?: SessionOptions
  ): Session;

  export function createSession(
    target: string,
    community: string,
    options?: SessionOptions
  ): Session;

  export function isVarbindError(varbind: Varbind): boolean;
  export function varbindError(varbind: Varbind): string;

  // Version constants
  export const Version1: number;
  export const Version2c: number;
  export const Version3: number;

  // Alias for UserOptions
  export type User = UserOptions;
}
