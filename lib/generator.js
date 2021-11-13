'use strict'
var utils = require('./utils');
var renderer = require('./renderer');

var ws_build_folder = "_static_cs_";
var ws_temps_folder = "_templates_cs_";
var ws_settings_file = "workspace.json";
var PROJECT_MAIN = "main.yml";

exports.PROJECT_MAIN = PROJECT_MAIN

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
	if (check_exists && utils.fileExistsSync(_path)) {
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
	if (utils.fileExistsSync(settings_path)) throw ("workspace already exists.");
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
exports.createProject = async function(projectpath) {
	if (!projectpath) throw("No project name was provided, abort.");
	if (utils.fileExistsSync(projectpath)) throw ("project already exists.");

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

	// let err = await

	try {
		await utils.mkdirpAsync(projectpath)
	} catch(err) {
		throw(err)
	}

	var project_name = utils.pathBasename(projectpath);
	var main_obj = {author:"local", name: project_name};
	renderer.renderSync(utils.pathJoin(utils.pathTemplates(), PROJECT_MAIN), main_obj, utils.pathJoin(projectpath, PROJECT_MAIN));
	renderer.renderSync(utils.pathJoin(utils.pathTemplates(), "base.jscad"), main_obj, utils.pathJoin(projectpath, "base.jscad"));
	renderer.renderSync(utils.pathJoin(utils.pathTemplates(), "top.jscad"), main_obj, utils.pathJoin(projectpath, "top.jscad"));
	utils.info("new project created: " + projectpath);

}

exports.createProjectAsync = function(projectpath) {
	return new Promise()
}

async function processProjectBuild(project_path, loop_callback, parent_project) {
	let raw_project = null
	let main_file_path = utils.pathJoin(project_path, PROJECT_MAIN)
	try {
		raw_project = await utils.loadYamlFileAsync(main_file_path)
	} catch (ex) {
		utils.error("project file not loaded ", ex);
		return null
	}

	var project = renderer.expandProject(raw_project /*, relative_project_path */);
	parent_project = parent_project || project

	await utils.forEachAsync(project.components, async component => {
		try {

			if (!component.inline_item) {
				if (component.shape && component.shape.file) {
					let com_path = component.shape.file;
					let from_path = utils.pathJoin(project_path, com_path);
					let exists = await utils.fileExistsAsync(from_path)
					if (!exists) {
						utils.error("file not found: " + from_path);
					} else {
						// create folder structure at destination
						await loop_callback(from_path, com_path, component, project_path)
					}

				} else if (component.project && component.project.file) {
					var com_path = component.project.file;
					var from_path = utils.pathJoin(project_path, com_path);

					let exists = await utils.fileExistsAsync(from_path)
					if (!exists) {
						utils.error("file not found: " + from_path);
					} else {
						// this has to happen in expandProject
						let sub_path = utils.pathDirname(from_path)
						console.log('from path', from_path, sub_path)
						let sub_project = await processProjectBuild(sub_path, loop_callback, parent_project)

						// move component to sub project node
						// const index = project.components.indexOf(component);
						// if (index > -1) {
					  	// project.components.splice(index, 1);
						// }

						// convert component to group 'null' object
						component.shape = {type:'null'}

						parent_project.sub_io = parent_project.sub_io || {}
						parent_project.sub_io[component.name] = sub_project.interface

						for (var sub_comp of sub_project.components) {
							sub_comp.name = component.name + "." + sub_comp.name
							sub_comp.inline_item = true
							sub_comp.sub_io = parent_project.sub_io[component.name]
							sub_comp.parent_name = component.name
							parent_project.components.push(sub_comp)
						}
						for (var [key, param] of Object.entries(component.parameters)) {
							//res += "io." + key + "=" + param.value + ";"
							sub_comp.sub_io[key].expression = param
						}
						component.parameters = null
					}
				}
			}
		} catch(ex) {
			utils.error("project processing failed", ex);
		}
	});

	project = renderer.expandProject(project /*, relative_project_path */);
	return project
}

async function buildProject(project_path, workspace_dir) {
	var build_root = utils.pathJoin(workspace_dir, ws_build_folder);
	var relative_project_path = utils.pathRelative(workspace_dir, project_path);
	var build_path = utils.pathJoin(build_root, relative_project_path);
	var temp_path = utils.pathTemplates();

	utils.info(relative_project_path + " -> " + build_path, "build");

	try {
		await utils.mkdirpAsync(build_path);
	} catch (ex) {
		utils.error("project folder creation failed: " + build_path, ex);
		return
	}

	let project = await processProjectBuild(project_path, async (from_path, com_path) => {
		// use component path to create absolute path
		var to_path = utils.pathJoin(build_path, com_path);
		// create folder structure at destination
		await utils.mkdirpAsync(utils.pathDirname(to_path))
		// copy component shape file to destination in the workspace folder
		await utils.copyFileAsync(from_path, to_path)
	})

	// store project to json
	try {
		await utils.storeJsonFileAsync(utils.pathJoin(build_path, "main.json"), project)
	} catch (ex) {
		utils.error("failed to store project object: " + build_path, relative_project_path);
	}

	// render html using template
	const html_temp_path = utils.pathJoin(temp_path, "index.html");
	let template = null
	try {
		template = await utils.loadFileAsync(html_temp_path)
	} catch(ex) {
		utils.error("failed to load html template: " + html_temp_path, relative_project_path);
	}

	// store rendered html
	try {
		var project_html = renderer.renderProject(project, template);
		await utils.storeFileAsync(utils.pathJoin(build_path, "index.html"), project_html)

	} catch(ex) {
		utils.error("check your html template, rendering failed.", relative_project_path);
		utils.error(ex, relative_project_path);
	}
}

// build all projects in and below current dir in workspace
exports.buildWorkspace = async function(projectpath = ".") {
	if (!projectpath) throw("No project name was provided, abort.");

	var workspace_dir = await utils.findParentDir(projectpath, ws_settings_file, 10);
	if (workspace_dir) {
		// console.log(JSON.stringify(workspace_dir))
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
	}, async (file, dir_path) => {
		// console.log("prj path", dir_path, workspace_dir)
		var project_dir = dir_path //.slice(0, dir_path.length-1).join("/") // dir_path;
		buildProject(project_dir, workspace_dir);
	});
}


// build single project into cache
exports.buildCachedProjectAsync = async function(project_path, workspace_dir, register_callback) {
  	var build_root = utils.pathJoin(workspace_dir, ws_build_folder);
  	var relative_project_path = utils.pathRelative(workspace_dir, project_path);
  	var build_path = utils.pathJoin(build_root, relative_project_path);
		var temp_path = utils.pathTemplates();
  	utils.info(relative_project_path + " -> " + relative_project_path, "build");

  	// load project

		let project = await processProjectBuild(project_path, async (from_path, com_path, component, ppath) => {
			// map the relative path
			var relative_project_path = utils.pathRelative(workspace_dir, ppath);
			component.shape.file = utils.pathJoin(relative_project_path, component.shape.file);
		})

		console.log("cached processed")

		let template = null
		try {
			// render html using template
			var html_temp_path = utils.pathJoin(temp_path, "index.html");
			template = await utils.loadFileAsync(html_temp_path)
		} catch(ex) {
			utils.error("failed to load html template: " + html_temp_path, relative_project_path);
			utils.error(ex, relative_project_path);
		}

		try {
			var project_url = relative_project_path;
			var project_html = renderer.renderProject(project, template);
			utils.info("register: '" + project_url + "'");
			register_callback(project_url, project_html);
		} catch(ex) {
			utils.error("check your html template, rendering failed.", relative_project_path);
			utils.error(ex, relative_project_path);
		}
}

/*
exports.buildCachedProject = function(project_path, workspace_dir, register_callback) {
	var build_root = utils.pathJoin(workspace_dir, ws_build_folder);
	var relative_project_path = utils.pathRelative(workspace_dir, project_path);
	var build_path = utils.pathJoin(build_root, relative_project_path);
	// local template
	//var temp_path = utils.pathJoin(workspace_dir, ws_temps_folder);
	// global template
	var temp_path = utils.pathTemplates();
	utils.info(relative_project_path + " -> " + relative_project_path, "build");

	// load project
	utils.loadYamlFile(utils.pathJoin(project_path, PROJECT_MAIN), (err, raw_project) => {
		try {
			var project = renderer.expandProject(raw_project, relative_project_path);
			// render html using template
				var html_temp_path = utils.pathJoin(temp_path, "index.html");
				utils.loadFile(html_temp_path, (err, template) => {
					if (err) {
						utils.error("failed to load html template: " + html_temp_path, relative_project_path);
					} else {
						try {
							var project_url = relative_project_path;
							var project_html = renderer.renderProject(project, template);
							utils.info("register: '" + project_url + "'");
							register_callback(project_url, project_html);
						} catch(ex) {
							utils.error("check your html template, rendering failed.", relative_project_path);
							utils.error(ex, relative_project_path);
						}
					}
				});
			} catch(ex) {
				utils.error("check your YAML file, parsing failed.", relative_project_path);
					utils.error(ex, relative_project_path);
			}
			});
}
*/


// build all projects in and below current dir in workspace into cache
exports.buildCachedWorkspace = function(projectpath = ".", register_callback) {
	if (!projectpath) throw("No project name was provided, abort.");
	// walk current dir and build projects
	// console.log("start cached build", projectpath)
	utils.info("start cached build " + String(projectpath))
	let ppath = projectpath
	utils.walkDir(ppath, file => {
		// console.log(file)
		utils.info(file)
		// throw(file)
		return (utils.pathBasename(file) === PROJECT_MAIN)
		// return (file === PROJECT_MAIN)
	}, (file, dir_path) => {
		// throw("project file found");
		var project_dir = dir_path
		console.log("start cached build")
		exports.buildCachedProjectAsync(project_dir, process.cwd(), register_callback);
		// exports.buildCachedProject(project_dir, process.cwd(), register_callback);
	});
}
