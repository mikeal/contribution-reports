var request = require('request').defaults({headers:{'user-agent':'get-org-from-archive-v0.0.1'}})
var zlib = require('zlib')
var path = require('path')
var jsonstream = require('JSONStream')
var levelup = require('levelup')
var sublevel = require('level-sublevel')
var once = require('once')

var base = 'http://data.githubarchive.org'
var test = '2015-01-26-15.json.gz'
var noop = _ => {}

function getDay (day, db, filter, cb) {
  var i = 0
  function getHour () {
    if (i === 24) return cb(null)
    var u = `${base}/${day}-${i}.json.gz`
    console.log('GET', u)
    var gunzip = zlib.createGunzip()
    gunzip.on('error', function (err) {
      console.error('ERROR in gzip', u)
      r.emit('end')
    })
    var r = request(u).pipe(gunzip).pipe(jsonstream.parse())
    .on('data', function (obj) {
      if (filter(obj)) {
        db.sublevel(obj.repo.name).put(obj.id, obj, noop)
      }
    })
    .on('end', once(function () {
      i++
      getHour()
    }))
  }
  getHour()
}

function filter (obj) {
  if (!obj.repo) return console.error(obj)
  return obj.repo.name.slice(0, 'nodejs/'.length) === 'nodejs/'
}

var db = sublevel(levelup(path.join(__dirname, 'orgarchive'), {valueEncoding: 'json'}))

var ts = new Date('2016-01-26T00:00:00Z')
var oneday = 1000 * 60 * 60 * 24

function _go () {
  ts = new Date(ts.getTime() + oneday)
  if (ts > new Date()) return console.log('done')
  getDay(ts.toISOString().slice(0, '2015-09-01'.length), db, filter, (err, count) => {
    _go()
  })
}

ts = new Date(ts.getTime() - oneday)

_go()
_go()
_go()