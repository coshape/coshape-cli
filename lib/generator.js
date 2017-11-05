'use strict'
var utils = require('./utils');
var renderer = require('./renderer');

var ws_build_folder = "_static_cs_";
var ws_temps_folder = "_templates_cs_";
var ws_settings_file = "workspace.json";

// expand the settings for a new workspace
exports.createSettings = function(workspace_path) {
	return {
		workspace : {
			version: utils.version,
			root: workspace_path,
			paths: {
				build: utils.pathJoin(workspace_path, ws_build_folder),
				templates: workspace_path + "/" + ws_temps_folder,
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
	var settings_path = utils.pathNormalize(utils.pathJoin(settings.workspace.root,ws_settings_file));
	if (utils.fileExists(settings_path)) throw ("workspace already exists.");
	createPath("root", settings.workspace.root, (item) => {
		Object.keys(settings.workspace.paths).forEach( function(key) {
			createPath(key, settings.workspace.paths[key]);
		}, false);
		utils.storeJsonFile(settings_path, settings);
		// utils.info(settings);
		utils.info("workspace: " + utils.pathDirname(settings_path), "init");
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
  		renderer.renderSync(utils.pathJoin(utils.pathTemplates(), "main.yml"), main_obj, utils.pathJoin(projectpath, "main.yml"));
	});

  	utils.info("new project created: " + projectpath);
}

// build single project
function buildProject(project_path, workspace_dir) {
  	var build_root = utils.pathJoin(workspace_dir, ws_build_folder);
  	var relative_project_path = utils.pathRelative(workspace_dir, project_path);
  	var build_path = utils.pathJoin(build_root, relative_project_path);
  	utils.info(relative_project_path + " -> " + build_path, "build");



}


// build a project
// projectpath can be relative or absolute
exports.buildWorkspace = function(projectpath = ".") {
	if (!projectpath) throw("No project name was provided, abort.");

	var workspace_dir = utils.findParentDir(projectpath, ws_settings_file, 10);
	if (workspace_dir) {
		utils.info("workspace found: " + workspace_dir, "build");
	} else {
		utils.warn("no workspace found. use command 'init' to create one.");
		// create new one
		var temp_dir = utils.pathTemplates();
		var set = exports.createSettings(utils.pathDirname(projectpath));
		// exports.createWorkspace(set);
		return ;
	}

	// walk current dir and build projects
	utils.walkDir(projectpath, file => {
		return (utils.basename(file) === "main.yml") 
	}, (file, dir_path) => {
		var project_dir = dir_path;
		buildProject(project_dir, workspace_dir);
	});

	/*
	// determine build paths
	var build_root = utils.pathJoin(workspace_dir, ws_build_folder);
  	utils.info("build root: " + build_root, "build");

  	var relative_project_path = utils.pathRelative(workspace_dir, projectpath);
  	var build_path = utils.pathJoin(build_root, relative_project_path);
  	utils.info("build path: " + build_path, "build");

  	utils.listDirSync();
	

	// find main.yml
  	utils.info("build project: " + projectpath, "build");
  	*/
}

