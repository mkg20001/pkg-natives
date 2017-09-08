#!/usr/bin/env node

"use strict"

const pkg = require("pkg")
const fs = require("fs")
const path = require("path")
const natives = ['assert',
  'buffer',
  'bindings',
  'addons',
  'child_process',
  'cluster',
  'cli',
  'console',
  'crypto',
  'debugger',
  'deprecations',
  'dns',
  'domain',
  'errors',
  'events',
  'fs',
  'globals',
  'http',
  'https',
  'modules',
  'net',
  'os',
  'path',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tracing',
  'tty',
  'dgram',
  'url',
  'util',
  'v8',
  'vm',
  'zlib'
].concat(["module"])

function getMatches(string, regex, index) {
  index = index || 1 // default to the first capturing group
  var matches = []
  var match
  while ((match = regex.exec(string)))
    matches.push(match[index])
  return matches
}

const mod = process.argv[2] || process.cwd()
const pjson = path.join(mod, "package.json")
const pdata = require(pjson)

console.log("Pkg'ing module %s...", pdata.name)

const reqex = /require\(["'](.+)["']\)/gi

const log = require("debug")("pkg-natives")

function getTree(file, paths, cache) {
  if (!cache) cache = {}
  let content
  if (Buffer.isBuffer(file)) {
    content = file.toString()
    file = "__"
  } else {
    if (typeof file != "string") return {
      file,
      error: "Not a path"
    }
    if (cache[file]) {
      log("cached dependency", file)
      return cache[file]
    }
    log("reading %s", file)
    content = fs.readFileSync(file)
  }
  const requires = getMatches(content, reqex).map(r => {
    if (r.indexOf("'") == -1) return r
    return r.split("'")[0]
  })
  const res = {
    file,
    requires: requires.map(name => {
      if (natives.indexOf(name) != -1) return {
        native: name
      }
      if (fs.existsSync(path.resolve(path.dirname(file), name)) && fs.lstatSync(path.resolve(path.dirname(file), name)).isDirectory() && fs.existsSync(path.resolve(path.dirname(file), name, "index.js"))) {
        return {
          file: fs.existsSync(path.resolve(path.dirname(file), name, "index.js"))
        }
      } else
      if (fs.existsSync(path.resolve(path.dirname(file), name))) {
        return {
          file: path.resolve(path.dirname(file), name)
        }
      } else if (fs.existsSync(path.resolve(path.dirname(file), name + ".js"))) {
        return {
          file: path.resolve(path.dirname(file), name + ".js")
        }
      } else if (fs.existsSync(path.join(paths.node, name))) {
        let p = path.join(paths.node, name)
        if (fs.existsSync(path.resolve(path.dirname(file), name)) && fs.lstatSync(path.resolve(path.dirname(file), name)).isDirectory() && fs.existsSync(path.resolve(path.dirname(file), name, "index.js"))) {
          return {
            file: path.resolve(path.dirname(file), name, "index.js")
          }
        } else
        if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
          return {
            file: p
          }
        } else if (fs.existsSync(p + ".js") && fs.lstatSync(p + ".js").isFile()) {
          return {
            file: p + ".js"
          }
        } else if (fs.lstatSync(p).isDirectory() && fs.existsSync(path.join(p, "package.json"))) {
          p = path.resolve(p, require(path.join(p, "package.json")).main || "index.js")
          if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
            return {
              file: p
            }
          } else if (fs.existsSync(p + ".js") && fs.lstatSync(p + ".js").isFile()) {
            return {
              file: p + ".js"
            }
          }
        }
      } else {
        log("failed to resolve", name, "from", file)
        return {
          unres: file
        }
      }
    })
  }
  cache[file] = res
  res.requires = res.requires.map(f => {
    if (!f) return {
      error: "Empty"
    }
    if (f.unres) {
      return {
        unresolved: true,
        file: f.unres
      }
    } else if (f.native) {
      return {
        native: true,
        file: f.native
      }
    } else {
      if (typeof f.file == "string" && fs.lstatSync(f.file).isDirectory()) return {
        file: f.file,
        error: "EISDIR"
      }
      return getTree(f.file, paths, cache)
    }
  })
  return res
}

function getFlatTree(files, paths) {
  let c = {}
  files.forEach(file => getTree(file, paths, c))
  delete c.__
  let r = {}
  for (var pth in c) {
    c[pth].file = path.relative(paths.main, pth)
    r[c[pth].file] = c[pth]
  }
  return r
}

console.log("Scanning for natives...")

const tree = getFlatTree([path.join(mod, pdata.bin[Object.keys(pdata.bin)]), Buffer.from(fs.readdirSync(path.join(mod, "node_modules")).map(m => 'require("' + m + '")').join(";\n"))], {
  node: path.join(mod, "node_modules"),
  main: mod
})
let btree = {}
for (var pth in tree) {
  const obj = tree[pth]
  const b = obj.requires.filter(o => o.file == "bindings")
  if (b.length) btree[pth] = obj
}
/*console.log(require('util').inspect(btree, {
  depth: 3,
  colors: true
}))*/

const nfiles = Object.keys(btree)

console.log("Found natives in %s", nfiles.join(", "))

let nat = []

//const nre = /require\(["']bindings["']\)\(["'](.+)["']\)/gi
nfiles.forEach(file => nat.push({
  file,
  native: file.split("/")[1]
}))

const npaths = [
  "build",
  "build/Debug",
  "build/Release",
  "out/Debug",
  "Debug",
  "out/Release",
  "build/default",
  "compiled/" + process.version.substr(1) + "/" + process.platform + "/" + process.arch
]

nat.forEach(n => {
  const spaths = npaths.map(p => path.join(mod, "node_modules", n.native, p, n.native + ".node"))
  const epaths = spaths.filter(p => fs.existsSync(p))
  if (!epaths.length) throw new Error("Couldn't find " + n.native + ".node. Tried:\n    - " + spaths.join("\n    - "))
  n.module = epaths.pop()
})

console.log(nat)

console.log("Copying modules...")

const mkdirp = require("mkdirp")
mkdirp.sync(path.join(mod, "natives"))

nat.forEach(n => {
  fs.writeFileSync(path.join(mod, "natives", n.native), fs.readFileSync(n.module))
})

console.log("Writing loader...")

let meta = {}
nat.forEach(n => {
  meta[n.native] = {
    real_file: n.module
  }
})

console.log(meta)

const l = fs.readFileSync(__dirname + "/loader.js").toString().replace('"MODENAME"', JSON.stringify("bundle")).replace('"MODEDIR"', JSON.stringify("")).replace('"METADATA"', JSON.stringify(meta))
fs.writeFileSync(path.join(mod, "native-loader.js"), Buffer.from(l))

const binf = path.join(mod, pdata.bin[Object.keys(pdata.bin)])
console.log("Patching %s...", binf)
const binc = fs.readFileSync(binf).toString().split("\n")
const obinc = fs.readFileSync(binf)

const suline = binc.filter(l => l.startsWith("#!") || l.indexOf("use strict") != -1).slice(0, 2)

let dropped = false

const nbinc = binc.map(l => {
  if (suline.length) {
    if (suline.indexOf(l) != -1) suline.shift()
    return l
  } else {
    if (!dropped) {
      l = 'require("' + path.relative(path.dirname(binf), path.join(mod, "native-loader.js")) + '");' + l
      dropped = true
    }
    return l
  }
}).join("\n")

fs.writeFileSync(binf, Buffer.from(nbinc))

const pargs = ["-t", "node8-" + process.platform.replace(/[^a-z]/gmi), mod]

const rest = () => {
  console.log("Restore %s...", binf)
  fs.writeFileSync(binf, obinc)
}

console.log("Running: pkg ", pargs.join(" "))
pkg.exec(pargs)
  .then(rest)
  .catch(e => {
    rest()
    console.error(e)
    process.exit(2)
  })
