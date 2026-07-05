import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share one Postgres test database — run files
    // sequentially so truncations don't race each other.
    fileParallelism: false,
  },
});
