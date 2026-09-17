// Type declarations for the mocked bcrypt module (see __mocks__/bcrypt.ts).
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
