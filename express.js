var express = require('express'),
    mongoskin = require('mongoskin'),
    bodyParser = require('body-parser'),
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

app.all('*', function(req, res, next) { 
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  if (!req.tweets)
    req.tweets = db.collection('tweets');
  next();
});

app.get('/', function(req, res, next) {
  res.send('please select a collection, e.g., /tweets');
});

app.get('/tweets', function(req, res, next) {
  req.tweets.find({in_reply_to_status_id: null}, 
    {limit: 30, sort: {'_id': -1}}).toArray(function(e, results) {
    if (e) return next(e);
    var json = {tweets: results};
    res.send(json);
  });
});

app.post('/tweets', function(req, res, next) {
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
    req.tweets.insert(data, {}, function(e, result) {
      if (e) return next(e);
      result.channel = params.channel;
      var json = {tweet: result};
      res.send(json);
    });
  });
});

app.get('/tweets/:id', function(req, res, next) {
  req.tweets.findById(req.params.id, function(e, result) {
    if (e) return next(e);
    var json = {tweet: result};
    res.send(json);
  });
});

app.put('/tweets/:id', function(req, res, next) {
  req.tweets.updateById(req.params.id, {$set: req.body}, 
                        {safe: true, multi: false}, function(e, result) {
    if (e) return next(e);
    res.send((result === 1) ? {msg:'success'} : {msg: 'error'});
  });
});

/*
app.delete('/tweets/:id', function(req, res, next) {
  req.tweets.removeById(req.params.id, function(e, result) {
    if (e) return next(e);
    res.send((result === 1) ? {msg: 'success'} : {msg: 'error'});
  });
});
*/

app.get('/tweets/channel/:channel', function(req, res, next) {
  req.tweets.find({channel: req.params.channel}, {limit: 30, 
    sort: {'_id': -1}}).toArray(function(e, results) {
    if (e) return next(e);
    var json = {tweets: results};
    res.send(json);
  });
});

app.get('/tweets/:id/comments', function(req, res, next) {
  req.tweets.find({in_reply_to_status_id: req.params.id}, {limit: 30, 
    sort: {'_id': -1}}).toArray(function(e, results) {
    if (e) return next(e);
    var json = {comments: results};
    res.send(json);
  });
});

app.listen(28017);
