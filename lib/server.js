'use strict'
var utils = require("./utils");
var express = require('express')

exports.host = function(projectpath, port = 3000) {
	// console.log("hosting project: " + projectpath);
  	utils.info(projectpath, "host");

	var app = express();
	app.use(express.static(projectpath));
	var f_path = utils.pathFrontend();
	//utils.info(f_path);
	app.use(express.static(f_path));

	/// catch 404 and forward to error handler
	/*
	app.use(function(req, res, next) {
	    var err = {}; // new Error('serve to: localhost:' + port + "/");
	    err.res = 'serve to: localhost:' + port + "/";
	    err.status = 404;
	    next(err);
	});
	*/

  	utils.info("Maggic happens on http://localhost:3000/", "host");
  	utils.info("hit Ctrl+C to abort", "host");
	app.listen(port);
}