var levelup = require('levelup')
var sublevel = require('level-sublevel')
var path = require('path')
var requestModule = require('request')
var index = require('level-index')
var qs = require('querystring')
var _ = require('lodash')
var main = require('./')
var ghrequest = require('./ghrequest')(process.env.GHTOKEN)

function testReport () {
  var db = sublevel(levelup(path.join(__dirname, 'db'), {valueEncoding: 'json'}))
  var sub = db.sublevel('nodejs/node', {valueEncoding: 'json'})
  sub = main.getDatabase(sub)  
  
  db.get('meta', function (e, info) {
    var u = 'https://api.github.com/repos/nodejs/node/collaborators'
    ghrequest(u, function (e, results) {
      if (e) return cb(e)
      var collabs = results.map(function (r) {return r.login})
      
      sub.byTime.createReadStream()
      .on('data', function (o) {
        var obj = o.value
        report(obj, collabs, info.starttime, info.endtime)
      })
      .on('end', function () {
        printall()
      })
    })
  })
}

testReport()

var d = _.cloneDeep
var people = {all:[], committers:[], contributors:[]}
var result = {count: 0, people: d(people), countCommit: 0, countContrib: 0}

var lastMonth = {
  total: d(result),
  issues: d(result),
  closed: d(result),
  pulls: d(result),
  issue_comments: d(result),
  pull_comments: d(result) 
}
var thisMonth = d(lastMonth)
var noMonth = d(lastMonth)

function getMonth (dt, starttime, endtime) {
  var half = starttime + ((endtime - starttime) / 2)
  dt = (new Date(dt)).getTime()
  if (dt < half && dt > starttime) return lastMonth
  if (dt > half && dt < endtime) return thisMonth  
  
  return noMonth
}

function printall () { 

  compact()
  function calc (mo) {
    for (var key in mo) {
      var val = mo[key]
      val.totalPeople = val.people.all.length
      val.totalCommiters = val.people.committers.length
      val.totalContrib = val.people.contributors.length
      val.contribToCommit = Math.round(val.totalContrib / val.totalPeople * 100)
    }
  }
  
  calc(lastMonth)
  calc(thisMonth)
  
  for (var key in thisMonth) {
    thisMonth[key].increase = thisMonth[key].count - lastMonth[key].count
    thisMonth[key].percentIncrease = Math.round(thisMonth[key].increase / lastMonth[key].count * 100)
    thisMonth[key].lastMonth = lastMonth[key]
  }
  
  console.log('In the last 30 days there were:')
  for (var key in thisMonth) {
    var val = thisMonth[key]
    if (val.count !== 0 && key !== 'total') {
      key = key.replace('_', ' ')
      console.log(`* **${val.count}** ${key} were created. **${val.increase} (%${val.percentIncrease})** over previous 30 days (${val.lastMonth.count} total).`)
      console.log(` * **${val.countCommit}** were created by commiters, **${val.countContrib}** by contributors.`)
      console.log(
      ` * **${val.totalContrib} / ${val.totalCommiters} (%${val.contribToCommit})** commiter to contrib ratio, compared to ` + 
      `**${val.lastMonth.totalContrib} / ${val.lastMonth.totalCommiters} (%${val.lastMonth.contribToCommit})** over previous 30 days.`)
    } 
  }
  
  
  // console.log(JSON.stringify(lastMonth, null, 2))
  // console.log(JSON.stringify(thisMonth, null, 2))
  // console.log(JSON.stringify(noMonth, null, 2)) 
}

function compact () {
  [lastMonth, thisMonth, noMonth].forEach(function (mo) {
    for (var key in mo) {
      mo[key].people.all = _.uniq(mo[key].people.all)
      mo[key].people.committers = _.uniq(mo[key].people.committers)
      mo[key].people.contributors = _.uniq(mo[key].people.contributors)
    }
  })
}
 
function report (obj, collabs, starttime, endtime) {
  var types = {}
  var mo = getMonth(obj.updated_at || obj.created_at, starttime, endtime)
  
  function add (_type, person) {
    mo[_type].count += 1
    mo[_type].people.all.push(person)
    mo.total.count += 1
    mo.total.people.all.push(person)
    
    if (collabs.indexOf(person) !== -1) {
      // is a committer
      mo.total.countCommit += 1
      mo[_type].countCommit += 1
      mo[_type].people.committers.push(person)
    } else {
      // is a contributor
      mo.total.countContrib += 1
      mo[_type].countContrib += 1
      mo[_type].people.contributors.push(person)
    }
  }
  
  types.mentioned = _ => {
    // console.log(obj)
  }
  types.subscribed = _ => {
    
  }
  types.renamed = _ => {
    
  }
  types.referenced = _ => {
    
  }
  types.labeled = _ => {
    
  }
  types.assigned = _ => {
    
  }
  types.head_ref_deleted = _ => {
    
  }
  types.closed = _ => {
    add('closed', obj.actor.login)
  }
  types.locked = _ => {
    
  }
  types.unlabeled = _ => {
    
  }
  types.issue_comment = _ => {
    add('issue_comments', obj.user.login)
  }
  types.pull_comment = _ => {
    add('pull_comments', obj.user.login)
  }
  types.pull = _ => {
    add('pulls', obj.user.login)
  }
  types.issue = _ => {
    add('issues', obj.user.login)
  }
  if (!obj.event) {
    if (types[obj._type]) return types[obj._type]()
    console.log(obj)
  } else {
   console.log('event', obj.event)
   types[obj.event]() 
  }
}

