'use strict'
var Generator = require("./lib/generator")
	, Server = require("./lib/server")
	, Utils = require("./lib/utils");

// create a new project
// projectpath can be relative or absolute
exports.init = function(projectpath) {
	try {
		Generator.init(Utils.normalize_path(projectpath));
	} catch (ex) {
		Utils.error(ex, "init");
		Utils.info("init -h for details");
	}
}

// build a project
// projectpath can be relative or absolute
exports.build = function(projectpath = ".") {
	try {
		Generator.build(Utils.normalize_path(projectpath));
	} catch (ex) {
		Utils.error(ex, "build");
		Utils.info("build -h for details");
	}
}

// host a project
// projectpath can be relative or absolute
exports.host = function(projectpath = ".") {
	try {
		Server.host(Utils.normalize_path(projectpath));
	} catch (ex) {
		Utils.error(ex, "host");
		Utils.info("host -h for details");
	}
}

