"use strict"

const natives = require("./natives")
const fs = require("fs")
const path = require("path")

function getMatches(string, regex, index) {
  index = index || 1 // default to the first capturing group
  var matches = []
  var match
  while ((match = regex.exec(string)))
    matches.push(match[index])
  return matches
}

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
module.exports = {
  getTree,
  getFlatTree
}
