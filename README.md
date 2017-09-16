# pkg-natives
Put natives in a pkg binary

# Usage
`pkg-natives [<folder>]`
 - `folder`: Directory of the module to pkg (default `cwd`)

# Package.json
```js
{
  "pkg": {
    "assets": "natives/**" //this tells pkg to drop the natives into the binary (if you already have sth else in this filed just turn it into an array)
  },
  "pkg-native": { //these are the defaults
    "scan": "all", //all = scan all modules recursivly for natives, entry = scan only the entry file and all files it requires recursivly, manual = do nothing
    "mode": "bundle", //bundle = put the natives in the pkg binary, dir = the natives need to be in the folder of the executable, static = file need to be in the dir specified with option "static"
    "modules": [] //module that pkg-natives may have missed
  }
}
```

# Limitations
 - Only current node version & os

 This is due to the fact that otherwise the natives for the other version/os would have to be downloaded/built

 The node version used is by defaul vMAJOR.0.0
 To override that use the `PKG_TARGET` env variable

 This is a goal that may be achived later but not now
