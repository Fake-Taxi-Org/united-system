// Jest manual mock for the `bcrypt` package, which isn't installed in this
// checkout but is imported transitively through several service modules.
// The tests that need real hashing behaviour are out of scope for what
// the controller-level tests verify; we only need the import chain to
// resolve cleanly.

module.exports = {
  hash: async (password: string) => `hashed:${password}`,
  compare: async (password: string, hash: string) => hash === `hashed:${password}`,
  genSalt: async () => 'salt',
  hashSync: (password: string) => `hashed:${password}`,
  compareSync: (password: string, hash: string) => hash === `hashed:${password}`,
};
