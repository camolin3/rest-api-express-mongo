var express = require('express'),
    mongoskin = require('mongoskin'),
    bodyParser = require('body-parser'),
    multer = require('multer'),
    Promise = require('promise'),
    Twit = require('twit');

var EARTH_RADIUS_KM = 6371;

var app = express();
app.use(bodyParser());
app.use(multer({inMemory: true}));
app.set('etag', false);

var db = mongoskin.db(
  'mongodb://dsas3_cl:sro1pwRjGxS1@localhost:27017/streamsaster_development', 
  {safe:true}
);

var t = new Twit({
  consumer_key: 'qIxLeqAVHDevyS6bdUfyFmSVg',
  consumer_secret: 'ZLzqzjGfJayCsQStibiUHdrB2wtRZEFJfjPDkJKVsB7ZnzODYA',
  access_token: '2559626324-eF4FxEnSF5zj02NeUFifYui8ECMoRiAVgkxSe63',
  access_token_secret: '4A8J0bUwWcsPWktQ8GkF7SGxzgu3t8MXuV4YnOIoldjw3'
});

app.all('*', function(req, res, next) { 
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, '+
             'Content-Type, Accept, X-File-Type, X-File-Name, X-File-Size');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT');
  if (!req.reports)
    req.reports = db.collection('tweets');
  next();
});

app.get('/', function(req, res, next) {
  res.send('please select a collection, e.g., /reports');
});

app.get('/reports', function(req, res, next) {
  var newQuery = {in_reply_to_status_id: null};
  if (req.query.lat && req.query.lng && req.query.within)
    newQuery.coordinates = {$geoWithin: {
      $centerSphere: [
        [parseFloat(req.query.lng), parseFloat(req.query.lat)],
        req.query.within / EARTH_RADIUS_KM
      ]
    }};
  if (req.query.channel)
    newQuery.channel = req.query.channel;
  if (req.query.q)
    newQuery.$text = {
      $search: req.query.q,
      $language: 'es'
    };
  if (req.query.offset && 'newest' in req.query) {
    if (JSON.parse(req.query.newest))
      newQuery.id = {$gt: req.query.offset};
    else
      newQuery.id = {$lt: req.query.offset};
  }

  var params = {
    limit: req.query.limit || 9,
    sort: {_id: -1}
  };
  req.reports.find(newQuery, params).toArray(function(e, results) {
    if (e) return next(e);
    var json = {reports: results};
    if (results) {
      json.meta = {
        offset: req.query.offset || 0,
        limit: params.limit,
        next: {
          newest: true, 
          limit: params.limit, 
          offset: results[0].id
        }
      };
      if (params.limit <= results.length)
        json.meta.previous = {
          newest: false, 
          limit: params.limit, 
          offset: results[results.length-1].id
        };
    }
    res.send(json);
  });
});

function postReport(req, res, next, model) {
  var params = req.body[model], 
      coordinates = params.coordinates.coordinates;
  var newReport = {
    status: params.text, 
    in_reply_to_status_id: params.in_reply_to_status_id, 
    long: coordinates[0], 
    lat: coordinates[1], 
    display_coordinates: true,
    media_ids: params.media_ids
  };
  t.post('statuses/update', newReport, function(error, data, response) {
    if (error) return next(error);
    // If succefully posted on Twitter, then save it on the db
    // adding the 'channel' attribute
    data.channel = params.channel;
    // fixing the id
    data.id = data.id_str;
    data.in_reply_to_status_id = data.in_reply_to_status_id_str;
    // adding the comment_ids
    if (model == 'report')
      data.comment_ids = [];
    req.reports.insert(data, {}, function(e, result) {
      if (e) return next(e);
      // if it is a comment, update the original report
      if (model == 'comment') {
        var update = {$push: {comment_ids: data.id}};
        req.reports.update({id: params.in_reply_to_status_id}, update, 
                           {safe: true, multi: false}, function(e,r) {
            if (e) console.error(e);
        });
      }
      var json = {};
      json[model] = result;
      res.send(json);
    });
  });
}

app.post('/reports', function (req, res, next) {
  postReport(req, res, next, 'report');
});

function getReport(req, res, next, model) {
  req.reports.findOne(req.params, function(e, result) {
    if (e) return next(e);
    var json = {};
    json[model] = result;
    res.send(json);
  });
}

app.get('/reports/:id', function(req, res, next) {
  getReport(req, res, next, 'report');
});

app.put('/reports/:id', function(req, res, next) {
  var query = {id: req.params.id},
      update = {$set: req.body.report},
      options = {new: true};
  if (update.$set.denounce) {
    var key = 'denounces.'+update.$set.denounce.reason;
    update.$inc = {};
    update.$inc[key] = 1;
  }
  delete update.$set.denounce;
  req.reports.findAndModify(query, {}, update, options, function(e, result) {
    if (e) return next(e);
    var json = {report: result};
    res.send(json);
  });
});

/*
app.delete('/reports/:id', function(req, res, next) {
  req.reports.removeById(req.params.id, function(e, result) {
    if (e) return next(e);
    res.send((result === 1) ? {msg: 'success'} : {msg: 'error'});
  });
});
*/

app.get('/comments/:id', function(req, res, next) {
  getReport(req, res, next, 'comment');
});

app.post('/comments/', function(req, res, next) {
  postReport(req, res, next, 'comment');
});

function uploadFile(file) {
  var params = {
    media: file.buffer.toString('base64')
  };
  return new Promise(function (resolve, reject) {
    t.post('media/upload', params, function(error, data, response) {
      if (error) reject(error);
      resolve(data);
    });
  });
}

app.post('/upload/', function(req, res, next) {
  var files = req.files['file[]'],
      promises = [];

  if (!Array.isArray(files)) {
    // just one file, send it to Twitter
    promises.push(uploadFile(files));
  }
  else {
    files.forEach(function(file) {
      promises.push(uploadFile(file));
    });
  }

  Promise.all(promises).then(function(files) {
    res.send({ files: files, success: true });
    res.end();
  }, function(error) {
    return next(error);
  });
});

app.listen(28017);
