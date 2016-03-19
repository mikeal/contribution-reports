var levelup = require('levelup')
var sublevel = require('level-sublevel')
var path = require('path')
var requestModule = require('request')
var index = require('level-index')
var qs = require('querystring')
var _ = require('lodash')
var main = require('./')
var fs = require('fs')
var ghrequest = require('./ghrequest')(process.env.GHTOKEN)

function testReport () {
  var db = sublevel(levelup(path.join(__dirname, 'db'), {valueEncoding: 'json'}))
  var sub = db.sublevel('nodejs/live.nodejs.org', {valueEncoding: 'json'})
  sub = main.getDatabase(sub)  
  
  db.get('meta', function (e, info) {
    var u = 'https://api.github.com/repos/nodejs/live.nodejs.org/collaborators'
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

function getRepos (org, cb) {
  var u = `https://api.github.com/orgs/${org}/repos`

  ghrequest(u, function (e, results) {
    if (e) return cb(e)
    cb(null, results.map(function (r) {return r.name}))
  })
}

var repos = fs.readFileSync('./test.output').toString().split('\n').map(o => o.split(' ')[0])

function top (totals) {
  return people = _.orderBy(Object.keys(totals), key => {
    return totals[key]
  }).reverse()
}


function testOrgReport () {
  var db = sublevel(levelup(path.join(__dirname, 'db2'), {valueEncoding: 'json'}))
  
  db.get('meta', function (e, info) {
    // getRepos('nodejs', function (e, repos) {
      // if (e) throw e
      var count = 0
      repos.forEach(function (repo) {
        var sub = db.sublevel('nodejs/'+repo, {valueEncoding: 'json'})
        sub.createValueStream().on('data', v => {
          report(v, [], info.starttime, info.endtime)
         }).on('end', function () {
          count += 1
          if (count === repos.length) {
            var totals = thisMonth.total.activity
            for (var key in thisMonth) {
              var totals = thisMonth[key].activity
              var tops = top(totals).slice(0, 10)
              var line = tops.map(person => `${person} (**${totals[person]}**)`).join('\n * ')
              console.log(`* Top ${key}: \n * ${line}`)
            }
          }
        })
      })
    // }) 
  })
}

// testOrgReport()

var d = _.cloneDeep
var people = {all:[], committers:[], contributors:[]}
var result = {count: 0, people: d(people), countCommit: 0, countContrib: 0, activity:{}}

var lastMonth = {
  total: d(result),
  issues: d(result),
  closed: d(result),
  pulls: d(result),
  locks: d(result),
  assignments: d(result),
  labels: d(result),
  subscriptions: d(result),
  mentions: d(result),
  merged: d(result),
  milestoned: d(result),
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
      ` * **${val.totalContrib} / ${val.totalCommiters} (%${val.contribToCommit})** active contributors to committer ratio, compared to ` + 
      `**${val.lastMonth.totalContrib} / ${val.lastMonth.totalCommiters} (%${val.lastMonth.contribToCommit})** over previous 30 days.`)
      if (val.people.committers.length) console.log(` * Commiters: ${val.people.committers.join(', ')}`)
      if (val.people.contributors.length) console.log(` * Contributors: ${val.people.contributors.join(', ')}`)
    } 
  }
  
  // fs.writeFileSync(path.join(__dirname, 'raw.json'), JSON.stringify(thisMonth))
  
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
    if (!mo[_type].activity[person]) mo[_type].activity[person] = 0
    mo[_type].activity[person] += 1
    if (!mo.total.activity[person]) mo.total.activity[person] = 0
    mo.total.activity[person] += 1
    
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
    add('mentions', obj.actor.login)
  }
  types.subscribed = _ => {
    add('subscriptions', obj.actor.login)
  }
  types.renamed = _ => {

  }
  types.referenced = _ => {
    
  }
  types.labeled = _ => {
    add('labels', obj.actor.login)
  }
  types.assigned = _ => {
    add('assignments', obj.actor.login)
  }
  types.head_ref_deleted = _ => {
    
  }
  types.closed = _ => {
    add('closed', obj.actor.login)
  }
  types.locked = _ => {
    add('locks', obj.actor.login)
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
  types.merged = _ => {
    add('merged', obj.actor.login)
  }
  types.reopened = _ => {
    
  }
  types.unassigned = _ => {
    
  }
  types.milestoned = _ => {
    add('milestoned', obj.actor.login)
  }
  types.demilestoned = _ => {
    
  }
  types.unlocked = _ => {
    
  }
  types.head_ref_restored = _ => {
    
  }
  types.unsubscribed = _ => {
    
  }
  types.commit = _ => {
    
  }
  if (!obj.event) {
    if (types[obj._type]) return types[obj._type]()
    console.log(obj)
  } else {
  //  console.log('event', obj.event)
   types[obj.event]() 
  }
}

module.exports = report
module.exports.compact = compact

