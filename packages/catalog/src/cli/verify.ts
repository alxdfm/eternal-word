import { loadCanonicalBooks } from '../dataset.js'
import { checkIntegrity } from '../integrity.js'

const report = checkIntegrity(loadCanonicalBooks())

process.stdout.write(
  [
    `books:                ${report.books}`,
    `chapters:             ${report.chapters}`,
    `registrable verses:   ${report.registrableVerses}`,
    `omitted positions:    ${report.omitted.length}`,
    '',
  ].join('\n'),
)

if (report.problems.length > 0) {
  process.stderr.write('\nCanonicalText integrity FAILED:\n')
  for (const problem of report.problems) process.stderr.write(`  - ${problem}\n`)
  process.exit(1)
}

process.stdout.write('CanonicalText OK\n')
