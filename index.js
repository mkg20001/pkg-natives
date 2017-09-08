#!/usr/bin/env node

"use strict"

const pkg = require("pkg")
const fs = require("fs")
const path = require("path")

const mod = process.argv[2] || process.cwd()
const pjson = path.join(mod, "package.json")
const pdata = require(pjson)

console.log("Pkg'ing module %s...", pdata.name)

const {
  getFlatTree
} = require("./lib/tree")

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

const nfiles = Object.keys(btree)

console.log("Found natives in %s", nfiles.join(", "))

let nat = []

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
