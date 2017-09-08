"use strict"

const path = require("path")
const fs = require("fs")

function NativeLoader(mode, dir, meta, uid) {
  const m = require("module")
  const oload = m._load

  let missing = []

  for (var mod in meta) {
    const _m = meta[mod]
    switch (mode) {
    case "bundle":
      const from = path.join(__dirname, "natives", mod)
      const to = path.join("/tmp/", uid, mod + ".node")
      if (!fs.existsSync(to)) {
        try {
          fs.mkdirSync(path.join("/tmp/", uid))
        } catch (e) {
          if (!fs.existsSync(path.join("/tmp/", uid))) throw e
        }
        fs.writeFileSync(to, fs.readFileSync(from))
      }
      _m.get_file = to
      break;
    }
    if (!fs.existsSync(_m.get_file)) missing.push(_m.get_file)
  }

  if (missing.length) {
    console.error("ERROR: The following files should have been installed with the application but do not seem to exist:")
    console.error(" - " + missing.join("\n - "))
  }

  function mockery(mod) {
    if (!meta[mod]) {
      throw new Error("Native module " + mod + " was not packaged by pkg-natives! Please report!")
    }
    const r = require(meta[mod].get_file)
    r.path = meta[mod].real_file
    return r
  }

  m._load = (request, parent, ismain) => {
    if (request == "bindings") {
      //IT'S MOCKING TIME!!!
      return mockery
    } else return oload(request, parent, ismain)
  }
}
global.NATIVE_LOADER = NativeLoader("MODENAME", "MODEDIR", "METADATA", "UNIQUE_ID")
