'use strict'

const path = require('path')
const fs = require('fs')

let log

try {
  const debug = require('debug')
  log = debug('pkg-natives')
} catch (e) {
  log = () => {}
}

function NativeLoader (mode, dir, meta, uid) {
  const m = require('module')
  const oload = m._load

  const k = Object.keys(meta)
  log('loading bundle %s (%s) with %s mod(s) (%s)', uid, mode, k.length, k.join(','))

  let missing = []

  for (var mod in meta) {
    const _m = meta[mod]
    switch (mode) {
      case 'bundle':
        let tmpdir
        if (process.platform.startsWith('win')) {
          tmpdir = path.join(process.env.APPDATA, '.node-natives')
          if (!fs.existsSync(tmpdir)) fs.mkdirSync(tmpdir)
          tmpdir = path.join(tmpdir, uid)
        } else {
          tmpdir = path.join('/tmp/', uid)
        }
        if (!fs.existsSync(tmpdir)) fs.mkdirSync(tmpdir)
        const from = path.join(__dirname, 'natives', mod)
        const to = path.join(tmpdir, mod + '.node')
        log('prepare native addon %s', mod)
        if (!fs.existsSync(to)) {
          log('extracting %s to %s', mod, to)
          fs.writeFileSync(to, fs.readFileSync(from))
        } else {
          log('skipping extraction of %s as %s already exists', mod, to)
        }
        _m.get_file = to
        break
    }
    if (!fs.existsSync(_m.get_file)) missing.push(_m.get_file)
  }

  if (missing.length) {
    console.error('ERROR: The following files should have been installed with the application but do not seem to exist:')
    console.error(' → ' + missing.join('\n - '))
  }

  function mockery (mod) {
    log('loading native addon %s', mod)
    if (!meta[mod]) {
      throw new Error('Native module ' + mod + ' was not packaged by pkg-natives! Please report!')
    }
    log('require("%s")', meta[mod].get_file)
    const r = require(meta[mod].get_file)
    r.path = meta[mod].real_file
    return r
  }

  m._load = (request, parent, ismain) => {
    if (request == 'bindings') {
      // IT'S MOCKING TIME!!!
      log('mocking bindings')
      return mockery
    } else return oload(request, parent, ismain)
  }

  return mockery
}
global.NATIVE_LOADER = NativeLoader('MODENAME', 'MODEDIR', 'METADATA', 'UNIQUE_ID')
