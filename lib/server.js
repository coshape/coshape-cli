'use strict'
var utils = require("./utils");
var express = require('express')

exports.host = function(projectpath) {
	// console.log("hosting project: " + projectpath);
  	utils.info(projectpath, "host");
  	utils.info("Maggic happens on http://localhost:3000/", "host");
  	utils.info("hit Ctrl+C to abort", "host");

	var app = express();
	app.use(express.static(projectpath));
	var f_path = utils.pathFrontend();
	utils.info(f_path);
	app.use(express.static(f_path));
	app.listen(3000)
}