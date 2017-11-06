'use strict'
var utils = require("./utils");
var express = require('express')

exports.host = function(projectpath, router, port = 3000) {
  	utils.info(projectpath, "host");
  	var p = utils.progress("init", 5, 1);

	var app = express();
	app.use(express.static(projectpath));
	var f_path = utils.pathFrontend();
	
	app.use(express.static(f_path));

	if (router) {
		app.use	(router);
	}

	/// catch 404 and forward to error handler
	/*
	app.use(function(req, res, next) {
	    var err = {}; // new Error('serve to: localhost:' + port + "/");
	    err.res = 'serve to: localhost:' + port + "/";
	    err.status = 404;
	    next(err);
	});
	*/
  	utils.info("", "host");
  	utils.info("Maggic happens on http://localhost:3000/", "host");
  	utils.info("", "host");

  	p.completeWork(5)
  	utils.info("hit Ctrl+C to abort", "host");
	app.listen(port);
}