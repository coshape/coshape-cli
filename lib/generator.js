'use strict'
var utils = require('./utils');
var renderer = require('./renderer');

var ws_build_folder = "_static_cs_";
var ws_temps_folder = "_templates_cs_";
var ws_settings_file = "workspace.json";
var PROJECT_MAIN = "main.yml";

// expand the settings for a new workspace
exports.createSettings = function(workspace_path) {
	return {
		workspace : {
			version: utils.version,
			root: workspace_path,
			paths: {
				build: utils.pathJoin(workspace_path, ws_build_folder),
				templates: utils.pathJoin(workspace_path,ws_temps_folder),
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
			settings.workspace.paths[key] = utils.pathRelative(settings.workspace.root, settings.workspace.paths[key]);
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

  		var project_name = utils.pathBasename(projectpath);
  		var main_obj = {author:"foo", name:"bar"};
  		renderer.renderSync(utils.pathJoin(utils.pathTemplates(), PROJECT_MAIN), main_obj, utils.pathJoin(projectpath, PROJECT_MAIN));
  		renderer.renderSync(utils.pathJoin(utils.pathTemplates(), "base.jscad"), main_obj, utils.pathJoin(projectpath, "base.jscad"));
  		renderer.renderSync(utils.pathJoin(utils.pathTemplates(), "top.jscad"), main_obj, utils.pathJoin(projectpath, "top.jscad"));
  		utils.info("new project created: " + projectpath);
	});
}


// build single project
function buildProject(project_path, workspace_dir) {
	// TODO: read build dir from workspace file ...
  	var build_root = utils.pathJoin(workspace_dir, ws_build_folder);

  	var relative_project_path = utils.pathRelative(workspace_dir, project_path);
  	var build_path = utils.pathJoin(build_root, relative_project_path);
  	// local template
  	//var temp_path = utils.pathJoin(workspace_dir, ws_temps_folder);
  	// global template
	var temp_path = utils.pathTemplates();
  	utils.info(relative_project_path + " -> " + build_path, "build");

  	// load project
  	utils.loadYamlFile(utils.pathJoin(project_path, PROJECT_MAIN), (err, raw_project) => {
	  	if (err) {
			utils.error("failed loading " + PROJECT_MAIN + " : " + err, relative_project_path);
	  	} else {
	  		// create out dir
			utils.mkdirp(build_path, err => {
				if (err) {
					utils.error("project folder creation failed: " + build_path, relative_project_path);
				} else {
			  		try {
			  			// read project file
				  		var project = renderer.expandProject(raw_project);
						utils.storeJsonFile(utils.pathJoin(build_path, "main.json"), project, err => {
							if (err)
					  			utils.error("failed to store project object: " + build_path, relative_project_path);
					  	});

					  	// copy project data
					  	project.components.forEach( component => {
					  		if (component.shape && component.shape.file) {

					  			var com_path = component.shape.file;
					  			var from_path = utils.pathJoin(project_path, com_path);
					  			utils.fileExists(from_path, (exists) => {
					  				if (exists) {
					  					
					  					var to_path = utils.pathJoin(build_path, com_path);
					  					// create folder structure at destination
					  					utils.mkdirp(utils.pathDirname(to_path), err => {
					  						if (err)
					  							utils.error("failed to create folder structure", relative_project_path);
					  						else
					  							utils.copyFile(from_path, to_path, err => {
					  								if (err)
					  									utils.error("failed to copy file: " + com_path, relative_project_path);
					  							});
					  					})
					  				} else {
					  					utils.error("file not found: " + from_path, relative_project_path);
					  				}
					  			});
					  		}
					  	});

					  	// render html using template
					  	var html_temp_path = utils.pathJoin(temp_path, "index.html");
					  	utils.loadFile(html_temp_path, (err, template) => {
					  		if (err) {
					  			utils.error("failed to load html template: " + html_temp_path, relative_project_path);
					  		} else {
					  			try {
							  		var project_html = renderer.renderProject(project, template);
							  		utils.storeFile(utils.pathJoin(build_path, "index.html"), project_html, err => {
							  			if (err)
					  						utils.error("failed to store project file: " + build_path, relative_project_path);
							  		})
						  		} catch(ex) {
					  				utils.error("check your html template, rendering failed.", relative_project_path);
					  				utils.error(ex, relative_project_path);
						  		}
					  		}
					  	});
				  	} catch(ex) {
				  		utils.error(ex, relative_project_path);
				  	}
				}
			});
	  	}
  	} );
}


// build all projects in and below current dir in workspace
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
		// TODO: could be dangerous to just create without asking ...
		// exports.createWorkspace(set);
		return ;
	}

	// walk current dir and build projects
	utils.walkDir(projectpath, file => {
		return (utils.pathBasename(file) === PROJECT_MAIN) 
	}, (file, dir_path) => {
		var project_dir = dir_path;
		buildProject(project_dir, workspace_dir);
	});
}

// 2017, freakwave2@gmx.de :D
