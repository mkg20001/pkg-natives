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
  "pkg-native": {
    "scan": "all", //all = scan all modules recursivly for natives, entry = scan only the entry file and all files it requires recursivly, manual = do nothing
    "mode": "bundle", //bundle = put the natives in the pkg binary, dir = the natives need to be in the folder of the executable
    "modules": [] //module that pkg-natives may have missed
  }
}
```

# Limitations
 - Linux only (mac maybe?)
 - Only current node version
 - Buggy
