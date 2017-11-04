'use strict'
var Utils = require("./utils");
var Express = require('express')

exports.host = function(projectpath) {
	// console.log("hosting project: " + projectpath);
  	Utils.info(projectpath, "host");
  	Utils.info("Maggic happens on http://localhost:3000/", "host");
  	Utils.info("hit Ctrl+C to abort", "host");

	var app = Express();
	app.use(Express.static(projectpath));
	app.listen(3000)
}