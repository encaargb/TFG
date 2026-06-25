import { spawn } from 'node:child_process'

const BACKEND_PORT = process.env.PORT ?? '3001'
const FRONTEND_PORT = process.env.FRONTEND_PORT ?? '5173'
const API_BASE_URL = process.env.VITE_API_BASE_URL ?? `http://localhost:${BACKEND_PORT}`

const children = []

function stop(exitCode = 0) {
  // Both development services share this parent process and must stop together.
  children.forEach((child) => child.kill())
  process.exit(exitCode)
}

function run(name, args, env = {}) {
  const child = spawn('npm', args, {
    env: {
      ...process.env,
      ...env,
    },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  children.push(child)
  child.stdout.on('data', (data) => process.stdout.write(data))
  child.stderr.on('data', (data) => process.stderr.write(data))
  child.on('exit', (code) => {
    if (code) stop(code)
  })

  console.log(`${name} started`)
}

console.log(`Backend mock: ${API_BASE_URL}`)
console.log(`Frontend: http://localhost:${FRONTEND_PORT}`)
console.log('Press Ctrl+C to stop both services.')

run('Backend', ['--prefix', 'backend-mock', 'start'], {
  PORT: BACKEND_PORT,
  FRONTEND_ORIGIN: `http://localhost:${FRONTEND_PORT}`,
})

run('Frontend', ['--prefix', 'frontend', 'run', 'dev', '--', '--host', 'localhost', '--port', FRONTEND_PORT], {
  VITE_API_BASE_URL: API_BASE_URL,
})

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
