'use strict'
var Utils = require("./utils");

// create a new project workspace
// projectpath can be relative or absolute
exports.init = function(projectpath) {
	if (!projectpath) throw("No workspace name was provided, abort.");

  	Utils.info(projectpath, "init");
}

// create a new project
// projectpath can be relative or absolute
exports.init = function(projectpath) {
	if (!projectpath) throw("No project name was provided, abort.");

  	Utils.info(projectpath, "new");
}

// build a project
// projectpath can be relative or absolute
exports.build = function(projectpath = ".") {
	if (!projectpath) throw("No project name was provided, abort.");
	
	// find main.yml
  	Utils.info("build project: " + projectpath, "build");
}

var render = function(temp_in, obj_in, dat_out) {
	var temp_data = fs.readFileSync(temp_in).toString();
	var res = mustache.render(temp_data, obj_in);
	fs.writeFileSync(dat_out, res);
}