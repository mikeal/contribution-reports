var levelup = require('levelup')
var sublevel = require('level-sublevel')
var path = require('path')
var requestModule = require('request')
var index = require('level-index')
var qs = require('querystring')
var _ = require('lodash')
var getRepository = require('./')
var fs = require('fs')
var ghrequest = require('./ghrequest')(process.env.GHTOKEN)

function getRepos (org, cb) {
  var u = `https://api.github.com/orgs/${org}/repos`

  ghrequest(u, function (e, results) {
    if (e) return cb(e)
    cb(null, results.map(function (r) {return r.name}))
  })
}

function getDatabase () {
  var token = process.env.GHTOKEN
  var db = sublevel(levelup(path.join(__dirname, 'db2'), {valueEncoding: 'json'}))
  
  var endtime = (new Date()).getTime()
  var starttime = endtime - (1000 * 60 * 60 * 24 * 60)
  
  db.put('meta', {starttime: starttime, endtime: endtime}, function (e, info) {
    
    getRepos('nodejs', function (e, repos) {
      if (e) throw e
      
      function _get () {
        if (!repos.length) return console.log('done')
        var repo = repos.shift()
        var sub = db.sublevel('nodejs/'+repo, {valueEncoding: 'json'})
        getRepository(token, 'nodejs', repo, starttime, endtime, sub, function (e, _db) {
          if (e) throw e
          _get()
        })
      }
      _get()
    }) 
  })
}
// getDatabase()

module.exports = 