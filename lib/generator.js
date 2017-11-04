'use strict'
var utils = require('./utils');
var fs = require('fs');
var mustache = require('mustache');

// expand the settings for a new workspace
exports.createSettings = function(workspace_path) {
	return {
		workspace : {
			version: utils.version,
			workspace_path: workspace_path,
			build_path: workspace_path + "/build",
			templates_path: workspace_path + "/templates",
			projects_path: workspace_path + "/projects",
			settings_path: workspace_path + "/settings.json"
		}
	};
} 

// create a new project workspace
// projectpath can be relative or absolute
exports.createWorkspace = function( settings /*workspace_path, build_path, template_path, project_path*/) {
	var _set = settings;

  	_set.workspace.workspace_path = utils.normalizePath(_set.workspace.workspace_path);
	_set.workspace.build_path = utils.normalizePath(_set.workspace.workspace_path);
	_set.workspace.templates_path = utils.normalizePath(_set.workspace.workspace_path);
	_set.workspace.projects_path = utils.normalizePath(_set.workspace.workspace_path);
	_set.workspace.settings_path = utils.normalizePath(_set.workspace.workspace_path);

	if (!_set) throw("No workspace settings were provided, abort.");
	if (fs.existsSync(_set.workspace.workspace_path)) throw("workspace path already exists, abort.");
	if (fs.existsSync(_set.workspace.build_path))     throw("build path already exists, abort.");
	if (fs.existsSync(_set.workspace.templates_path)) throw("templates path already exists, abort.");
	if (fs.existsSync(_set.workspace.projects_path))  throw("projects path already exists, abort.");
	if (fs.existsSync(_set.workspace.settings_path))  throw("settigns file already exists, abort.");

  	utils.mkdirp(_set.workspace.workspace_path, (err) => {
  		if (err) {throw(err);}
  		else {
  			utils.mkdirp(_set.workspace.build_path);
  			utils.mkdirp(_set.workspace.templates_path);
  			utils.mkdirp(_set.workspace.projects_path);

  			// make paths relative for portability
  			_set.workspace.workspace_path = utils.pathRelative(_set.workspace.workspace_path, process.cwd());
  			_set.workspace.build_path = utils.pathRelative(_set.workspace.workspace_path, _set.workspace.build_path);
  			_set.workspace.templates_path = utils.pathRelative(_set.workspace.workspace_path, _set.workspace.templates_path);
  			_set.workspace.projects_path = utils.pathRelative(_set.workspace.workspace_path, _set.workspace.projects_path);
  			_set.workspace.settings_path = utils.pathRelative(_set.workspace.workspace_path, _set.workspace.settings_path);

  			// store settings file ...
  			utils.storeJsonFile(_set.workspace.settings_path, _set);
			utils.info(_set);
  		}
  	});

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

// create a new project
// projectpath can be relative or absolute
exports.createProject = function(projectpath) {
	if (!projectpath) throw("No project name was provided, abort.");

  	utils.info(projectpath, "new");
}

// build a project
// projectpath can be relative or absolute
exports.buildProject = function(projectpath = ".") {
	if (!projectpath) throw("No project name was provided, abort.");
	
	// find main.yml
  	utils.info("build project: " + projectpath, "build");
}

var render = function(temp_in, obj_in, dat_out) {
	var temp_data = fs.readFileSync(temp_in).toString();
	var res = mustache.render(temp_data, obj_in);
	fs.writeFileSync(dat_out, res);
}