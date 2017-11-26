'use strict'

const fs = require('fs')
const path = require('path')

const paths = [
  'build',
  path.join('build', 'Debug'),
  path.join('build', 'Release'),
  path.join('out', 'Debug'),
  'Debug',
  path.join('out', 'Release'),
  path.join('build', 'default'),
  path.join('compiled', process.version.substr(1), process.platform, process.arch)
]

module.exports = function findNative (node_modules, native_name) {
  const look_in = paths.map(p => path.join(node_modules, native_name, p, native_name + '.node'))
  const found = look_in.filter(p => fs.existsSync(p))
  if (!found.length) throw new Error("Couldn't find " + native_name + '.node. Tried:\n    - ' + look_in.join('\n    - '))
  return found.pop()
}
