'use strict'
var utils = require('./utils');
var fs = require('fs');
var mustache = require('mustache');

var ws_build_folder = "_static_cs_";
//var ws_temps_folder = "_templates_cs_";
var ws_settings_file = "_workspace_cs_";

// var template_main_yml = require("./templates/main.yml");

// expand the settings for a new workspace
exports.createSettings = function(workspace_path) {
	return {
		workspace : {
			version: utils.version,
			root: workspace_path,
			paths: {
				build: workspace_path + "/" + ws_build_folder,
				//templates: workspace_path + "/" + ws_temps_folder,
				//projects: workspace_path + "/projects",
				//common: workspace_path + "/_cs_common_",
			}
		}
	};
} 

// helper function
function createPath(item, path, callback, check_exists) {
	var _path = utils.pathNormalize(path);
	check_exists = typeof check_exists  !== 'undefined' ? check_exists : true;
	if (check_exists && utils.fileExists(_path)) {
		throw ( item + " path already exists.");
	}
	utils.mkdirp(_path, (err) => {
  		if (err) {throw(err);}
  		if(callback) callback(item);
  	});
}

// create a new project workspace
// projectpath can be relative or absolute
exports.createWorkspace = function( settings ) {
	if (!settings) throw("No workspace settings were provided.");
	var settings_path = utils.pathNormalize(settings.workspace.root + "/" + ws_settings_file);
	if (utils.fileExists(settings_path)) throw ("workspace already exists.");
	createPath("root", settings.workspace.root, (item) => {
		Object.keys(settings.workspace.paths).forEach( function(key) {
			createPath(key, settings.workspace.paths[key]);
		}, false);
		utils.storeJsonFile(settings_path, settings);
		// utils.info(settings);
		utils.info("workspace created: " + utils.pathDirname(settings_path));
	}, false);
}

// create a new project
// projectpath can be relative or absolute
exports.createProject = function(projectpath) {
	if (!projectpath) throw("No project name was provided, abort.");
	if (utils.fileExists(projectpath)) throw ("project already exists.");

	// search for workspace file
	var workspace_dir = utils.findParentDir(projectpath, ws_settings_file, 10);
	if (workspace_dir) {
		utils.info("workspace found: " + workspace_dir);
	} else {
		// utils.warn("no workspace found.");
		// create new one
		var temp_dir = utils.pathTemplates();
		var set = exports.createSettings(utils.pathDirname(projectpath));
		exports.createWorkspace(set);
	}

	utils.mkdirp(projectpath, (err) => {
  		if (err) {throw(err);}
  		// create default data

  		// utils.storeFile(mustache.render(template_main_yml, {author:"", name:""}));
  		var main_obj = {author:"foo", name:"bar"};
  		renderSync(utils.pathTemplates() + "/main.yml", main_obj, projectpath + "/main.yml");
	});

  	utils.info("new project created: " + projectpath);

  	/*
  	try {
		var pro_path = path.basename(project_dir);
		var outpath = out_dir + "/" + pro_path;
		var apipath = api_dir + "/" + pro_path;

		mkdirp(outpath, function (err) {
		    if (err) {
				console.error("mkdir failed: " + out_dir)
		    	console.error(err)
		    }
		   	else {
		   		mkdirp(apipath, function (err) {
				    if (err) {
				    	console.error("mkdir failed: " + api_dir)
				    	console.error(err)
				    }
				   	else {
						try {
							process_project(user_id, project_dir, html_dir, outpath, apipath, false);
						} catch(err) {
							console.log(project_dir + ": project creation failed!");
							console.log(err);
						}
					}
				});
		   	}
		});
	} catch(err) {
		console.log(project_dir + ": project creation failed!");
		console.log(err);
	}
	*/
}

// build a project
// projectpath can be relative or absolute
exports.buildProject = function(projectpath = ".") {
	if (!projectpath) throw("No project name was provided, abort.");
	
	// find main.yml
  	utils.info("build project: " + projectpath, "build");
}

var renderSync = function(temp_in, obj_in, dat_out) {
	var temp_data = fs.readFileSync(temp_in).toString();
	var res = mustache.render(temp_data, obj_in);
	fs.writeFileSync(dat_out, res);
}