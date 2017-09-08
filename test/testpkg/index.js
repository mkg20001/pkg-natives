const level = require("leveldown")
const db = new level(process.cwd() + "/testdb")
db.open(err => {
  if (err) throw err
  db.close(err => {
    if (err) throw err
  })
})
