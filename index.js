'use strict'
var generator = require("./lib/generator")
	, server = require("./lib/server")
	, utils = require("./lib/utils")
	, router = require("./lib/router")
	, renderer = require("./lib/renderer")


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
		generator.buildWorkspace(utils.pathNormalize(projectpath));
	} catch (ex) {
		utils.error(ex, "build");
		utils.info("build -h for details");
	}
}

// host a project
// projectpath can be relative or absolute
exports.host = function(projectpath = ".") {
	var cache = {}
	try {
		// build project into cache
		var project_router = router.createRouter({}, renderer.renderProjects);
		generator.buildCachedWorkspace(utils.pathNormalize(projectpath), (url, data) => {
			project_router.addDataPair(url, data);
		});
		server.host(utils.pathNormalize(projectpath), project_router);
	} catch (ex) {
		utils.error(ex, "run");
		utils.info("-h for details");
	}
}

