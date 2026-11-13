/**
 * Runs the full delivery gate: typecheck, lint, unit tests, production build.
 * Usage: npm run verify
 */
import { spawnSync } from 'node:child_process'

const steps = [
  ['TypeScript', 'npm run typecheck'],
  ['ESLint', 'npm run lint'],
  ['Unit tests', 'npm test'],
  ['Production build', 'npm run build'],
]

let failed = 0
for (const [label, command] of steps) {
  console.log(`\n▶ ${label}`)
  const result = spawnSync(command, { stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    failed += 1
    console.error(`✗ ${label} failed`)
    break
  }
  console.log(`✓ ${label}`)
}

if (failed > 0) process.exit(1)
console.log('\nAll checks passed.')
