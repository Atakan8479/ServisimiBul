const fs = require('node:fs')
const paths = [
  'e2e-real/real-full-stack.spec.ts',
  'e2e/demand-board.spec.ts',
  'e2e/mvp-journeys.spec.ts',
  'src/features/discovery/PublicDiscoveryPage.test.tsx',
]
for (const path of paths) {
  const data = fs.readFileSync(path).toString('base64')
  console.log('SBFORMAT_START ' + path)
  for (let i = 0; i < data.length; i += 1900)
    console.log('SBFORMAT_PART ' + data.slice(i, i + 1900))
  console.log('SBFORMAT_END ' + path)
}
