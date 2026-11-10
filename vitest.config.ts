import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.engine.test.ts', '**/node_modules/**', '**/dist/**'],
        },
      },
      {
        test: {
          name: 'engine',
          include: ['src/**/*.engine.test.ts'],
        },
      },
    ],
  },
})
