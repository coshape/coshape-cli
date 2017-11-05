'use strict'
var generator = require("./lib/generator")
	, server = require("./lib/server")
	, utils = require("./lib/utils");

// create a new project
// projectpath can be relative or absolute
exports.init = function(projectpath) {
	try {
		var settings = generator.createSettings(projectpath);
		generator.createWorkspace(settings);
	} catch (ex) {
		utils.error(ex, "init");
		utils.info("init -h for details");
	}
}

// create a new project
// projectpath can be relative or absolute
exports.new = function(projectpath) {
	try {
		generator.createProject(utils.pathNormalize(projectpath));
	} catch (ex) {
		utils.error(ex, "init");
		utils.info("init -h for details");
	}
}

// build a project
// projectpath can be relative or absolute
exports.build = function(projectpath = ".") {
	try {
		generator.buildProject(utils.pathNormalize(projectpath));
	} catch (ex) {
		utils.error(ex, "build");
		utils.info("build -h for details");
	}
}

// host a project
// projectpath can be relative or absolute
exports.host = function(projectpath = ".") {
	try {
		server.host(utils.pathNormalize(projectpath));
	} catch (ex) {
		utils.error(ex, "host");
		utils.info("host -h for details");
	}
}

