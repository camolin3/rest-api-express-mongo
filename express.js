var express = require('express'),
    mongoskin = require('mongoskin'),
    bodyParser = require('body-parser'),
    pluralize = require('pluralize'),
    Twit = require('twit');

var app = express();
app.use(bodyParser());

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

app.param('collectionName', function(req, res, next, collectionName) {
  req.collection = db.collection(collectionName);
  return next();
});

app.all('*', function(req, res, next) { 
  res.header("Access-Control-Allow-Origin", "*"); 
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept"); 
  next(); 
});

app.get('/', function(req, res, next) {
  res.send('please select a collection, e.g., /tweets');
});

app.get('/:collectionName', function(req, res, next) {
  req.collection.find({}, {limit: 30, sort: {'_id': -1}}).toArray(function(e, results) {
    if (e) return next(e);
    var json = {},
        wrapperName = req.params.collectionName;
    json[wrapperName] = results;
    res.send(json);
  });
});

app.post('/:collectionName', function(req, res, next) {
  var params = req.body.tweet, 
      coordinates = params.coordinates.coordinates;
  var newTweet = {
    status: params.text, 
    in_reply_to_status_id: params.in_reply_to_status_id, 
    long: coordinates[0], 
    lat: coordinates[1], 
    display_coordinates: true
  };
  t.post('statuses/update', newTweet, function(error, data, response) {
    if (error) console.log(error);
    // If succefully posted on Twitter, then save it on the db
    req.collection.insert(data, {}, function(e, result) {
      if (e) return next(e);
      var json = {},
          wrapperName = pluralize(req.params.collectionName, 1);
      result.channel = params.channel;
      json[wrapperName] = result;
      res.send(json);
    });
  });
});

app.get('/:collectionName/:id', function(req, res, next) {
  req.collection.findById(req.params.id, function(e, result) {
    if (e) return next(e);
    var json = {},
        wrapperName = pluralize(req.params.collectionName, 1);
    json[wrapperName] = result;
    res.send(json);
  });
});

app.put('/:collectionName/:id', function(req, res, next) {
  req.collection.updateById(req.params.id, {$set: req.body}, 
                            {safe: true, multi: false}, function(e, result) {
    if (e) return next(e);
    res.send((result === 1) ? {msg:'success'} : {msg: 'error'});
  });
});

/*
app.delete('/:collectionName/:id', function(req, res, next) {
  req.collection.removeById(req.params.id, function(e, result) {
    if (e) return next(e);
    res.send((result === 1) ? {msg: 'success'} : {msg: 'error'});
  });
});
*/

app.get('/:collectionName/channel/:channel', function(req, res, next) {
  req.collection.find({channel: req.params.channel}, {limit: 30, 
    sort: {'_id': -1}}).toArray(function(e, results) {
    if (e) return next(e);
    var json = {},
        wrapperName = req.params.collectionName;
    json[wrapperName] = results;
    res.send(json);
  });
});

app.get('/:collectionName/:id/comments', function(req, res, next) {
  req.collection.find({in_reply_to_status_id: req.params.id}, {limit: 30, 
    sort: {'_id': -1}}).toArray(function(e, results) {
    if (e) return next(e);
    var json = {},
        wrapperName = 'comments';
    json[wrapperName] = results;
    res.send(json);
  });
});

app.listen(28017);
