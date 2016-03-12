var requestModule = require('request')
var qs = require('querystring')
var _ = require('lodash')

function _module (token) {
  var request = requestModule.defaults(
    { json:true
    , headers:
      { 'user-agent':'gh-to-database-v0.0.1'
      , 'Authorization': 'token '+token
      }
    })
  function ghrequest (url, result, cb) {
    if (!cb) {
      cb = result
      result = []
    }
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

        result = result.concat(body)
        if (l.next) ghrequest(l.next, result, cb)
        else cb(null, result)
      } else {
        cb(null, body)
      }
    })
  }
  return ghrequest
}
  
module.exports = _module
