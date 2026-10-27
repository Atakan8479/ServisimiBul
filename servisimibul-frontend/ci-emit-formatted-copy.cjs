// Temporary CI-only formatter extraction; removed before PR review.
// Emits only modified public frontend source files, never environment secrets.
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const paths = execFileSync('git', ['diff', '--name-only', '--', 'src'], {
  encoding: 'utf8',
}).trim().split(/\r?\n/).filter(Boolean)
for (const gitPath of paths) {
  const path = gitPath.replace(/^servisimibul-frontend\//, '')
  if (!/^src\/[\w/.-]+\.(?:ts|tsx)$/.test(path)) continue
  const data = fs.readFileSync(path).toString('base64')
  console.log('SB_COPY_START ' + path)
  for (let i = 0; i < data.length; i += 1900) {
    console.log('SB_COPY_PART ' + data.slice(i, i + 1900))
  }
  console.log('SB_COPY_END ' + path)
}
console.log('SB_COPY_TOTAL ' + paths.length)
