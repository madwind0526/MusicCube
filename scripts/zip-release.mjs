// Zips release/win-unpacked into release/MusicCube-<version>.zip (top folder: MusicCube/)
import { execFileSync } from 'node:child_process'
import { readFileSync, renameSync } from 'node:fs'
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const zip = `MusicCube-${version}.zip`
renameSync('release/win-unpacked', 'release/MusicCube') // gives the archive a clean top folder
try {
  execFileSync(process.env.SystemRoot + '/System32/tar.exe', ['-a', '-cf', zip, 'MusicCube'], { cwd: 'release', stdio: 'inherit' })
} finally {
  renameSync('release/MusicCube', 'release/win-unpacked')
}
console.log('wrote release/' + zip)
