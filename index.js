#!/usr/bin/env node

"use strict"

//Required stuff
const pkg = require("pkg")
const fs = require("fs")
const path = require("path")
const {
  getFlatTree
} = require("./lib/tree")
const find_native = require("./lib/find_native")
const mkdirp = require("mkdirp")
const rimraf = require("rimraf")
const merge = require("merge-recursive").recursive
const uuid = require("uuid")

//Basic stuff
const mod = process.argv[2] || process.cwd()
const pjson = path.join(mod, "package.json")
const pdata = require(pjson)

function isInArray(field, value, list) {
  if (list.indexOf(value) == -1) throw new Error("Field " + field + " can only have the values " + list.join(", ") + ", but got " + value)
}

//Conf
const modes = ["bundle", "dir"]
const scans = ["all", "entry", "manual"]
const _conf = pdata["pkg-native"] || {}
const _defaults = {
  scan: "all",
  mode: "bundle",
  modules: []
}
const conf = merge(_defaults, _conf)
const mode = conf.mode
const scan = conf.scan
const entry = path.join(mod, pdata.bin[Object.keys(pdata.bin)])

//Check
isInArray("mode", mode, modes)
isInArray("scan", scan, scans)

//Paths
const node_modules = path.join(mod, "node_modules")
const loader = path.join(mod, "native-loader.js")
const natives = path.join(mod, "natives")

console.log("Pkg'ing module %s...", pdata.name)

fs.readdirSync(node_modules).forEach(mod => {
  if (mod == ".bin" || mod.startsWith("@")) return
  const mod_pjson = require(path.join(node_modules, mod, "package.json"))
  if (!mod_pjson.main) return
  if (mod_pjson.main.endsWith(".node") || fs.existsSync(path.join(node_modules, mod, mod_pjson.main + ".node"))) {
    console.log("package.json main of %s directly points to native %s! Fixing that...", mod, mod_pjson.main)
    mod_pjson.main = "index.js"
    fs.writeFileSync(path.join(node_modules, mod, "index.js"), Buffer.from('require("bindings")(' + JSON.stringify(mod) + ')'))
    fs.writeFileSync(path.join(node_modules, mod, "package.json"), Buffer.from(JSON.stringify(mod_pjson)))
  }
})

console.log("Scanning for natives (%s)...", scan)

const tree = getFlatTree(scan == "all" ? [entry, Buffer.from(fs.readdirSync(node_modules).map(m => 'require(' + JSON.stringify(m) + ')').join(";\n"))] : scan == "entry" ? [entry] : [], {
  node: node_modules,
  main: mod
})

let btree = {}

for (var pth in tree) {
  const obj = tree[pth]
  const b = obj.requires.filter(o => o.file == "bindings")
  if (b.length) btree[pth] = obj
}

let nfiles = Object.keys(btree)

console.log("Found %s native(s)", nfiles.length)

console.log("Adding %s native(s) manually", conf.modules.length)
nfiles = nfiles.concat(conf.modules)

let nat = []

nfiles.forEach(file => nat.push({
  file,
  native: file.split(path.sep)[1]
}))

nat.forEach(n => {
  n.module = find_native(node_modules, n.native)
  console.log("%s at %s (from %s)", n.native, n.module, n.file)
})

console.log("Copying modules...")

mkdirp.sync(natives)

nat.forEach(n =>
  fs.writeFileSync(path.join(natives, n.native), fs.readFileSync(n.module)))

console.log("Writing loader...")

let meta = {}
nat.forEach(n => {
  meta[n.native] = {
    real_file: n.module
  }
})

const l = fs.readFileSync(__dirname + "/loader.js").toString()
  .replace('"MODENAME"', JSON.stringify(mode)).replace('"MODEDIR"', JSON.stringify(""))
  .replace('"METADATA"', JSON.stringify(meta)).replace('"UNIQUE_ID"', JSON.stringify(pdata.name + "-natives-" + uuid()))
fs.writeFileSync(loader, Buffer.from(l))

const binf = path.join(mod, pdata.bin[Object.keys(pdata.bin)])
console.log("Patching %s...", binf)
const binc = fs.readFileSync(binf).toString().split("\n")
const obinc = fs.readFileSync(binf)

const suline = binc.filter(l => l.startsWith("#!") || l.indexOf("use strict") != -1).slice(0, 2)

let loader_relative = path.relative(path.dirname(binf), path.join(mod, "native-loader.js"))
if (!loader_relative.startsWith(".")) loader_relative = "." + path.sep + loader_relative

let dropped = false

const nbinc = binc.map(l => {
  if (suline.length) {
    if (suline.indexOf(l) != -1) suline.shift()
    return l
  } else {
    if (!dropped) {
      l = 'require("' + loader_relative + '");' + l
      dropped = true
    }
    return l
  }
}).join("\n")

fs.writeFileSync(binf, Buffer.from(nbinc))

const pargs = ["-t", "node" + process.version.substr(1, 1) + "-" + process.platform.replace(/[^a-z]/gmi, ""), mod]

const rest = () => {
  console.log("Restore %s...", binf)
  fs.writeFileSync(binf, obinc)
  console.log("Cleanup...")
  rimraf.sync(natives)
  rimraf.sync(loader)
}

console.log("Running: pkg", pargs.join(" "))
pkg.exec(pargs)
  .then(rest)
  .catch(e => {
    rest()
    console.error(e)
    process.exit(2)
  })
