var fs = require('fs')
var path = require('path')
var jsonstream = require('JSONStream')
var _ = require('lodash')
var csvWriter = require('csv-write-stream')
var lodash = _

var events = {}
var repos = {}

function csv (filename) {
  var writer = csvWriter()
  writer.pipe(fs.createWriteStream(path.join(__dirname, filename)))
  return writer
}

function add (type, person, ts) {
  var month = ts.slice(0, '2015-09'.length)
  if (!events[month]) events[month] = {}
  if (!events[month][type]) events[month][type] = {}
  if (!events[month][type][person]) events[month][type][person] = 0 
  events[month][type][person] += 1 
}
function addCommit (rep, person, ts) {
  var month = ts.slice(0, '2015-09'.length)
  if (!repos[month]) repos[month] = {}
  if (!repos[month][rep]) repos[month][rep] = {}
  if (!repos[month][rep][person]) repos[month][rep][person] = 0 
  repos[month][rep][person] += 1 
}

function keysWithoutCommit (dict) {
  return Object.keys(dict).filter(key => key !== 'commit')
}

// var _contribChart = csv('contrib.csv')
function contributions (key, mo) {
  var line = {month: key}
  keysWithoutCommit(mo).forEach(type => {
    var people = mo[type]
    line[type] = _.sum(_.values(people))
  })
  _contribChart.write(line)
}
// var _peopleChart = csv('peopleChart.csv')
function peopleChart (key, mo) {
  var line = {month: key}
  keysWithoutCommit(mo).forEach(type => {
    var people = mo[type]
    line[type] = _.keys(people).length
  })
  _peopleChart.write(line)
}
// var _peopleGraph = csv('peopleGraph.csv')
function peopleGraph (key, mo) {
  var people = _.uniq(_.flatten(keysWithoutCommit(mo).map(key => _.keys(mo[key])))).length
  var line = {month: key, people: people}
  _peopleGraph.write(line)
}
// var _commitGraph = csv('commitGraph.csv')
function commitData (key, commits) {
  var line = {month: key}
  line.people = _.keys(commits).length
  line.commits = _.sum(_.values(commits))
  _commitGraph.write(line)
}

var count = 0

var lastObj

var s = fs.createReadStream(path.join(__dirname, 'db.json')).pipe(jsonstream.parse())
.on('data', obj => {
  count++

  if (obj.type === 'PushEvent') {
    obj.payload.commits.forEach(commit => {
      add('commit', commit.author.email, obj.created_at)
      addCommit(obj.repo.name+'/'+obj.payload.ref, commit.author.email, obj.created_at)
    })
  }
  lastObj = obj
  
  if (obj.actor) return add(obj.type, obj.actor.login, obj.created_at)
  throw new Error('no actor '+obj.type)
})
.on('end', _ => {
  console.log('end')
  clearInterval(_set)
  Object.keys(events).sort().forEach(key => {
    console.log(key)
    var mo = events[key]
    // contributions(key, mo)
    // peopleChart(key, mo)
    // peopleGraph(key, mo)
    // commitData(key, mo.commit)
  })
  // _contribChart.end()
  // _peopleChart.end()
  // _peopleGraph.end()
  // _commitGraph.end()

  var _repoCommitGraph = csv('repoCommitGraph.csv')
  var _repoPeopleGraph = csv('repoPeopleGraph.csv')
  Object.keys(events).sort().forEach(key => {
    console.log(key)
    var mo = repos[key]
    var commitLine = {month: key}
    var peopleLine = {month: key}
    for (var k in mo) {
      commitLine[k] = lodash.sum(lodash.values(mo[k]))
      peopleLine[k] = lodash.keys(mo[k]).length
    }
    _repoCommitGraph.write(commitLine)
    _repoPeopleGraph.write(peopleLine)
  })
  _repoCommitGraph.end()
  _repoPeopleGraph.end()

  console.log('finished')
})

var _set = setInterval(_ => {
  console.log(count)
  // if (count > 2000) {
  //   s.emit('end')
  //   setTimeout(_ => {
  //     throw new Error('asdf')
  //   }, 100)
  // }
}, 1000)