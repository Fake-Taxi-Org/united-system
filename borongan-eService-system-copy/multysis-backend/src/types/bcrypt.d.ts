// Type declarations for the mocked bcrypt module (see __mocks__/bcrypt.ts
// at the repo root). Real bcrypt isn't installed in this checkout but is
// imported transitively through several service modules. Tests that need
// real hashing behaviour should install bcrypt; the controller-level
// tests we're adding only need the import chain to resolve cleanly.
declare module 'bcrypt' {
  export function hash(password: string, salt?: string | number): Promise<string>;
  export function hashSync(password: string, salt?: string | number): string;
  export function compare(password: string, hash: string): Promise<boolean>;
  export function compareSync(password: string, hash: string): boolean;
  export function genSalt(rounds?: number): Promise<string>;
  export function genSaltSync(rounds?: number): string;
  const _default: {
    hash: typeof hash;
    hashSync: typeof hashSync;
    compare: typeof compare;
    compareSync: typeof compareSync;
    genSalt: typeof genSalt;
    genSaltSync: typeof genSaltSync;
  };
  export default _default;
}
