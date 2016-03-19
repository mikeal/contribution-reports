var levelup = require('levelup')
var sublevel = require('level-sublevel')
var path = require('path')
var requestModule = require('request')
var index = require('level-index')
var qs = require('querystring')
var _ = require('lodash')

function getRepository (token, org, repoid, starttime, endtime, db, cb) {
  db = getDatabase(db)
  var type

  // customized ghrequest
  var request = requestModule.defaults(
    { json:true
    , headers:
      { 'user-agent':'gh-to-database-v0.0.1'
      , 'Authorization': 'token '+token
      }
    })
  
  var intime = o => {
    var dt = (new Date(o.created_at)).getTime()
    if (dt > starttime && dt < endtime) return true
    return false  
  }
  
  function addEvents (body, cb) {
    body.forEach(function (o) {
      console.log(o.url)
      o._type = type
    })
    var ops = body.filter(intime).map(o => ({type: 'put', 'key': o.url, value: o}))
    db.batch(ops, function (e, results) {
      cb(e, ops.length === body.length)
    })
  }   
    
  function ghrequest (url, cb) {
    console.log('ghrequest', url)
    request(url, function (e, resp, body) {
      if (e) return cb(e)
      if (resp.headers.link) {
        var links = resp.headers.link.split(', ')
          , l = {}
          ;
        links.forEach(function (link) {
          var start = link.indexOf('rel="') + 'rel="'.length
            , end = link.indexOf('"', start)
            ;
          l[link.slice(start, end)] = link.slice(1, link.indexOf('>;'))
        })
        addEvents(body, function (e, next) {
          if (next && l.next) ghrequest(l.next, cb)
          else cb(null, db)
        })
      } else {
        addEvents(body, function (e, next) {
          cb(null, db)
        })
      }
    })
  }
  var iso = (new Date(starttime)).toISOString()
  var opts = qs.stringify({since: iso, sort: 'updated'})
  var lopts = qs.stringify({state: 'all', sort: 'created'})
  var host = 'https://api.github.com'
  
  var urls = {
    issue: `${host}/repos/${org}/${repoid}/issues?${lopts}`,
    event: `${host}/repos/${org}/${repoid}/issues/events`,
    issue_comment: `${host}/repos/${org}/${repoid}/issues/comments?${opts}`,
    pull: `${host}/repos/${org}/${repoid}/pulls?${lopts}`,
    pull_comment: `${host}/repos/${org}/${repoid}/pulls/comments?${opts}`
  }
  
  function getAllCommits () {
    var _ghrequest = require('./ghrequest')(token)
    var u = `${host}/repos/${org}/${repoid}/branches`
    _ghrequest(u, function (e, branches) {
      if (e) return cb(e)
      branches = branches.map(b => b.name)
      function getBranchCommits () {
        if (branches.length === 0) return cb(e, db)
        var branch = branches.shift()
        console.log('Get branch commmits', repoid, branch)
        var opts = qs.stringify({since: iso, sha:branch})
        var u = `${host}/repos/${org}/${repoid}/commits?${opts}`
        _ghrequest(u, function (e, commits) {
          if (e) return cb(e)
          commits.forEach(function (commit) {
            commit._branch = branch
            commit._type = 'commit'
            commit.created_at = commit.commit.committer.date
          })
          var ops = commits.map(o => ({
            type: 'put', 'key': `${o.url}?branch=${branch}`, value: o
          }))
          console.log(ops)
          db.batch(ops, function (e, results) {
            if (e) return cb(e)
            getBranchCommits()
          })
        })
      }
      getBranchCommits()
    })
    // cb(e, db)
  } 
  
  var types = Object.keys(urls)
  function _request () {
    var t = types.shift()
    type = t
    ghrequest(urls[t], function (e, db) {
      if (e) return cb(e)
      if (types.length === 0) getAllCommits()
      else _request()
    })
  }
  _request()
  
}

function getDatabase (db) {
  db.byTime = index(db, 'byTime', function (key, value, emit) {
    var obj = value
    if (!obj.created_at) {
      console.log(obj)
      throw new Error('adf')
    }
    emit(obj.created_at, obj)
  })
  return db
}

module.exports = getRepository
module.exports.getDatabase = getDatabase

function testCreate () {
  var token = process.env.GHTOKEN
  var db = sublevel(levelup(path.join(__dirname, 'db'), {valueEncoding: 'json'}))
  
  var endtime = (new Date()).getTime()
  var starttime = endtime - (1000 * 60 * 60 * 24 * 60)
  
  db.put('meta', {starttime: starttime, endtime: endtime}, function (e, info) {
    var sub = db.sublevel('nodejs/node', {valueEncoding: 'json'})

    getRepository(token, 'nodejs', 'node', starttime, endtime, sub, function (e, _db) {
      if (e) throw e
      console.log("done")
    })
    
  })
}

// testCreate()