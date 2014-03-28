var express = require('express');
var http = require('http');
var redis = require('redis');
var fs = require('fs');
var ws = require('ws');
var url = require('url'); 

var GIFEncoder = require('./lib/GIFEncoder.js');

// Common settings
var common = require('./common.js');

var redisCreateClient = function() {
    if (process.env.REDISTOGO_URL) {
        var rtg   = url.parse(process.env.REDISTOGO_URL);
        var client = redis.createClient(rtg.port, rtg.hostname);
        client.auth(rtg.auth.split(":")[1]);
        return client;
    } else {
        return redis.createClient();
    }
};

// Create app and websockets
var app = express();
var server = http.createServer(app);
var client = redisCreateClient();
var sockets = new ws.Server({
    server: server
});

// Port
var isProduction = (process.env.NODE_ENV === 'production');
var port = (isProduction ? 80 : 8000);

server.listen(port);

/*
 * Load images.
 */
var loadRAWImage = function(name) {
  var path = __dirname + '/res/' + name +  '-' +
             common.WIDTH + 'x' + common.HEIGHT + '.json';
  var data = fs.readFileSync(path, 'utf8');
  return JSON.parse(data);
};

var adjustment = loadRAWImage('adjustment');
var establishing = loadRAWImage('establishing');

/*
 * Configure express app.
 */
app.configure(function() {
  app.set('views', __dirname + '/templates');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'topsecret' }));
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/static'));
  app.use(express.favicon(__dirname + '/static/img/favicon.ico'));
});

/**
 * Redirect to index.htm
 */
app.get('/', function(req, res) {
  res.redirect('/index.htm');
});

/**
 * Index
 */
app.get('/index.htm', function(req, res) {
  res.render('app.jade', {});
});

/**
 * Why
 */
app.get('/why.htm', function(req, res) {
  res.render('why.jade', {});
});

/**
 * Really
 */
app.get('/really.htm', function(req, res) {
  res.render('really.jade', {});
});

/**
 * About
 */
app.get('/about.htm', function(req, res) {
  res.render('about.jade', {});
});

/**
 * FAQ
 */
app.get('/faq.htm', function(req, res) {
  res.render('faq.jade', {});
});

/**
 * Watch a stream.
 */
app.get('/:id.gif', function(req, res) {
  var client = redisCreateClient();
  var encoder = new GIFEncoder(common.WIDTH, common.HEIGHT);

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', 'Mon, 26 Jul 1997 05:00:00 GMT');
  
  /*
   * Write GIF header.
   */
  encoder.stream().onWrite(function(data) {
    res.write(String.fromCharCode(data), 'binary');
  });
  encoder.setFrameRate(common.RECV_FRAMERATE);
  encoder.writeHeader();
  encoder.writeLSD(); // logical screen descriptior
  encoder.writeGlobalPalette();
  encoder.addFrame(establishing);

  /*
   * Read frames from Redis channel.
   */
  client.psubscribe('*.' + req.params.id);
  client.on('pmessage', function(pattern, channel, data) {
    channel = channel.split('.');

    var type = channel[0];
    var gifId = channel[1];

    if (type == common.redis.CH_FRAME) {
      console.log('Received frame');
      res.write(data, 'binary');
    } else if (type == common.redis.CH_EVENT) {
      console.log('Received event: ' + data);
      if (data == common.redis.EVT_DISCONNECT) {
        encoder.addFrame(adjustment);
        res.end();
      }
    }
  });

  /*
   * Close output stream.
   */
  req.connection.addListener('close', function() {
    client.unsubscribe();
    client.end();
  });
});

/**
 * Generate an id using A-Z,a-z,0-9.
 */
var generateId = function() {
  var id = '';
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                 "abcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < 5; i++) {
    id += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return id;
};

/**
 * Setup new socket connection.
 */
sockets.on('connection', function(socket) {
  var gifId = generateId();

  socket.send(String.fromCharCode(common.events.EVT_NEW_ID) + gifId);

  /*
   * Receive frames and write to Redis channel.
   */
  socket.on('message', function(data) {
    var evt = data[0].charCodeAt(0);
    var data = data.substr(1);
    if (evt == common.events.EVT_FRAME) {
      client.publish(common.redis.CH_FRAME + '.' + gifId, data);
      socket.send(String.fromCharCode(common.events.EVT_FRAME_RECEIVED));
    }
  });

  /*
   * Close input stream.
   */
  socket.on('close', function() {
    client.publish(common.redis.CH_EVENT + '.' + gifId,
                   common.redis.EVT_DISCONNECT);
  });
});
