#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const SERVICES = [
  'auth-service',
  'catalog-service',
  'customer-profile-service',
  'promotions-service',
  'cart-service',
  'order-service',
  'notification-service',
  'invoice-service',
  'audit-service',
  'sap-integration-service',
  'returns-service',
  'content-service',
  'intelligence-service',
  'commercial-service',
  'notification-preferences-service',
  'sustainability-service'
]

const target = process.argv[2]

if (target && !SERVICES.includes(target)) {
  console.error(`\nServicio desconocido: "${target}"`)
  console.error(`Servicios disponibles: ${SERVICES.join(', ')}\n`)
  process.exit(1)
}

// Single service: stream output directly with colors, no summary
if (target) {
  const result = spawnSync(
    'docker',
    ['compose', 'run', '-t', '--rm', target, 'node', '--test', 'src/app.test.js'],
    { stdio: 'inherit' }
  )
  process.exit(result.status ?? 1)
}

// All services: capture output and print summary
let totalPass = 0
let totalFail = 0
const failedServices = []

console.log('')
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║        Secretos del Agua — Test Suite                        ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log('')

for (const svc of SERVICES) {
  console.log(`── ${svc} ${'─'.repeat(Math.max(0, 53 - svc.length))}`)

  const result = spawnSync(
    'docker',
    ['compose', 'run', '--rm', svc, 'node', '--test', '--test-reporter=tap', 'src/app.test.js'],
    { encoding: 'utf8' }
  )

  const output = (result.stdout ?? '') + (result.stderr ?? '')
  const pass = (output.match(/^ok \d/gm) ?? []).length
  const fail = (output.match(/^not ok \d/gm) ?? []).length

  totalPass += pass
  totalFail += fail

  if (result.status !== 0 && pass === 0 && fail === 0) {
    console.log(`  ⚠️  Error al ejecutar (¿imagen no construida?). Ejecuta: docker compose build ${svc}`)
    failedServices.push(svc)
  } else if (fail === 0) {
    console.log(`  ✅  ${pass} tests pasados`)
  } else {
    console.log(`  ❌  ${pass} pasados · ${fail} fallidos`)
    failedServices.push(svc)
    for (const line of output.split('\n')) {
      if (/^not ok \d/.test(line)) {
        console.log('     ✗ ' + line.replace(/^not ok \d+ /, ''))
      }
    }
  }
  console.log('')
}

console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║  RESULTADO FINAL                                             ║')
console.log(`║  ✅ Pasados:  ${String(totalPass).padEnd(3)}   ❌ Fallidos: ${String(totalFail).padEnd(3)}                         ║`)
console.log('╚══════════════════════════════════════════════════════════════╝')

if (failedServices.length > 0) {
  console.log('')
  console.log('  Servicios con problemas:')
  for (const svc of failedServices) {
    console.log(`    · ${svc}`)
  }
  console.log('')
  process.exit(1)
} else {
  console.log('')
  console.log('  Todos los tests han pasado correctamente.')
  console.log('')
}
