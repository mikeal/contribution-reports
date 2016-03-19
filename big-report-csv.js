var report = require('./lib/report')
var levelup = require('levelup')
var path = require('path')
var sublevel = require('level-sublevel')
var _ = require('lodash')

var db = sublevel(levelup(path.join(__dirname, 'wholeorg'), {valueEncoding: 'json'}))
var sub = db.sublevel('nodejs/node', {valueEncoding: 'json'})

report(sub, function (e, months) {
  console.log(_.keys(months).map(key => key + ' ' + months[key].total.count))
})