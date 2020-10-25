'use strict'
var utils = require("./utils");
var express = require('express')
var reload = require('reload')
var bodyParser = require('body-parser')
var http = require('http')

exports.host = function(projectpath, router, port = 3000) {
  	utils.info(projectpath, "host");
  	var p = utils.progress("init", 5, 1);

	var app = express();
	app.use(express.static(projectpath));
	var f_path = utils.pathFrontend();
	
	app.use(express.static(f_path));
	app.use(bodyParser.json())

	if (router) {
		app.use	(router);
	}


  	utils.info("", "host");
  	utils.info("Maggic happens on http://localhost:3000/", "host");
  	utils.info("", "host");

  	p.completeWork(5)
  	utils.info("hit Ctrl+C to abort", "host");
	// app.listen(port);

	var server = http.createServer(app)
 
	// Reload code here
	exports.reload = null;
	reload(app).then(function (reloadReturned) {
	  // reloadReturned is documented in the returns API in the README
	 
	 	exports.reload = reloadReturned
	  // Reload started, start web server
	  server.listen(port, function () {
	    console.log('Web server listening on port ' + port)
	  })
	}).catch(function (err) {
	  console.error('Reload could not start, could not start server/sample app', err)
	})
}