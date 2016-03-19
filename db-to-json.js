var fs = require('fs')
var zlib = require('zlib')
var path = require('path')

var writer = fs.createWriteStream(path.join(__dirname, 'db.json'))

var levelup = require('levelup')
var sublevel = require('level-sublevel')

var db = levelup(path.join(__dirname, 'orgarchive'), {valueEncoding: 'json'})

db.createValueStream().on('data', function (obj) {
  writer.write(JSON.stringify(obj)+'\n')
})