'use strict'

var utils = require('./utils');
var fs = require('fs');
var mustache = require('mustache');

exports.renderSync = function(temp_in, obj_in, dat_out) {
	var temp_data = fs.readFileSync(temp_in).toString();
	var res = mustache.render(temp_data, obj_in);
	fs.writeFileSync(dat_out, res);
}

function get_js_trans(component) {
	if (component) {
		var res = "";
		var has_pos = false;
		var has_rot = false;
		var has_scl = false;
		if (component.position) {
			has_pos = true;
			if (component.position.x) {
				res += "var x = " + component.position.x + ";";
			} else {
				res += "var x = 0;";
			}
			if (component.position.y) {
				res += "var y = " + component.position.y + ";";
			} else {
				res += "var y = 0;";
			}
			if (component.position.z) {
				res += "var z = " + component.position.z + ";";
			} else {
				res += "var z = 0;";
			}
		}
		if (component.rotation) {
			has_rot = true;
			if (component.rotation.x) {
				res += "var rx = " + component.rotation.x + ";";
			} else {
				res += "var rx = 0;";
			}
			if (component.rotation.y) {
				res += "var ry = " + component.rotation.y + ";";
			} else {
				res += "var ry = 0;";
			}
			if (component.rotation.z) {
				res += "var rz = " + component.rotation.z + ";";
			} else {
				res += "var rz = 0;";
			}
		}
		if (component.scale) {
			has_scl = true;
			if (component.scale.x) {
				res += "var sx = " + component.scale.x + ";";
			} else {
				res += "var sx = 1;";
			}
			if (component.scale.y) {
				res += "var sy = " + component.scale.y + ";";
			} else {
				res += "var sy = 1;";
			}
			if (component.scale.z) {
				res += "var sz = " + component.scale.z + ";";
			} else {
				res += "var sz = 1;";
			}
		}
		if (has_pos | has_rot | has_scl) {
			if (has_pos) {
				res += "return [x,y,z, ";
			} else {
				res += "return [0,0,0, ";
			}
			if (has_rot) {
				res += "rx,ry,rz, ";
			} else {
				res += "0,0,0, ";
			}
			if (has_scl) {
				res += "sx,sy,sz];";
			} else {
				res += "1,1,1];";
			}
			return res;
		}
	}
}

function get_js_para(component) {
	var res = null;
	var parameters_list = [];
	if (component) {
		if (component.parameters) {
			res = "var res = {};";
			for (var key in component.parameters) {
			  if (component.parameters.hasOwnProperty(key)) {
				res += "res." + key + " = " +component.parameters[key] + "; ";
				var comp = {};
				comp["label"] = key;
				comp["value"] = component.parameters[key];
				parameters_list.push(comp);
			  }
			}
			res += "return res;";
		}
	}
	return [res, parameters_list];
}

function get_js_io_mapping(component) {
	if (component.sub_io) {
		var res = "io={"
		for (var [key, param] of Object.entries(component.sub_io)) {
			if (param.expression) {
				res +=  key + ":" + param.expression + ","
			} else {
				res +=  key + ":" + param.value + ","
			}
		}
		res += "}"
		return res
	} else {
		return ""
	}
}

function get_js_regroup(component) {
	if (component.parent_name) {
	}
}

/*
function get_js_clones(component) {
	var res = null;
	if (component) {
		if (component.clones) {
			var cl = component.clones;
			cl.items = cl.items || 1;
			cl.type = cl.type ||"radial";
			cl.axis = cl.axis || {};
			cl.axis.x = cl.axis.x || 0;
			cl.axis.y = cl.axis.y || 0;
			cl.axis.z = cl.axis.z || 0;
			cl.offset = cl.offset || 0;

			res = "var res = {};";
			res += "res.items=" + cl.items +";";
			res += "res.type='" + cl.type +"';";
			res += "res.axis=[" + cl.axis.x+","+cl.axis.y+","+cl.axis.z+"];";
			res += "res.offset=" + cl.offset +";";

			res += "return res;"
		}
	}
	return res;
}
*/

function label_from_key_unit(key, unit) {
	var capitalizedString = key == "" ? "Undefined" :
	key.split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
	return capitalizedString.replace(/_/g, " ") +  (typeof unit != 'undefined' ? " <small><i>" + unit + "</i></small>" : "");
}

function renderJSON(obj) {
	var keys = [],
		retValue = "";
	for (var key in obj) {
		if (typeof obj[key] === 'object') {
			retValue += "<div class='tree'>" + key;
			retValue += renderJSON(obj[key]);
			retValue += "</div>";
		} else {
			retValue += "<div class='tree'>" + key + " = " + obj[key] + "</div>";
		}

		keys.push(key);
	}
	return retValue;
}

function renderJSON_Interface(obj) {
	var keys = [],
		retValue = "";
		var id=0;
		var label = "";
		for (var key in obj) {
			label = label_from_key_unit(key, obj[key].unit)
			retValue += '<div style="margin: 10px; vertical-align: middle;" >';
			//retValue += '<form action="#"><div class="mdl-textfield mdl-js-textfield" id="text_01"><input style="width:50px; float:rigth;" class="mdl-textfield__input" type="text" id="inp_text_01"></div></form>'
			retValue += '<form action="#">'; //<div class="mdl-textfield mdl-js-textfield" id="text_01">';
			retValue += '<label style="float:left;" for="' + key + '">' + label + "     </label>" ;
			retValue += '<input style="float:right; max-width:100px; padding-left:10px;" class="mdl-textfield__input" onchange="$(\'#' + key + '\').val(this.value); update(' + id + ', this.value );" type="number" id="' + key + '_number"  min="' + obj[key].min + '" max="' + obj[key].max + '" value="' + obj[key].value + '" />'
			retValue += '<input id="' + key + '" class="mdl-slider mdl-js-slider" oninput="$(\'#' + key + '_number\').val(this.value);" onchange="$(\'#' + key + '_number\').val(this.value); update(' + id + ', this.value );" type="range" min="' + obj[key].min + '" max="' + obj[key].max + '" value="' + obj[key].value + '" step="' + obj[key].step + '" />'
			retValue += '</form>';
			retValue += "</div>";
			id += 1;
		}
		keys.push(key);
	return retValue;
}

exports.expandProject = function( obj /*, relative_project_path*/ ) {
	var project_name = obj.name;

	obj.html = renderJSON_Interface(obj.interface);
	obj.html_string = obj.html.replace(/'/g, "\\'");

	obj.interface_list = [];

	var io_env = "var io={}; function rgb(r,g,b,a){return [r,g,b,a];}; function rgba(r,g,b,a){return [r,g,b,a];};"//{io:{}};
	for (var key in obj.interface) {
		if (obj.interface.hasOwnProperty(key)) {
			obj.interface[key].name = key;
			obj.interface_list.push(obj.interface[key]);
			io_env += "io." + key + "=" + obj.interface[key].value + ";";
		}
	}

	//var preview_obj = [];
	var _files_to_load = 0;
	var _files_loaded = 0;

	obj.cad_components = [];
	obj.mesh_components = [];

	if (!obj.components) throw("No components defined");

	for (var i = 0; i < obj.components.length; i++) {
		obj.components[i].name = obj.components[i].name || Object.keys(obj.components[i])[0];
		obj.components[i].html = renderJSON(obj.components[i]);
		// obj.components[i].js_clones = get_js_clones(obj.components[i]);
		obj.components[i].js_transformation = get_js_trans(obj.components[i]);
		var comp_paras = get_js_para(obj.components[i]);
		obj.components[i].js_parameters = comp_paras[0];
		obj.components[i].parameters_list = comp_paras[1];
		obj.components[i].js_io_mapping = get_js_io_mapping(obj.components[i]);
		// obj.components[i].js_regroup = get_js_regroup(obj.components[i]);
		obj.components[i].parent_name = obj.components[i].parent_name || ""


		if (typeof obj.components[i].clone === "undefined") {
			obj.components[i].clone_function = "0";
		} else {
			obj.components[i].clone_function = JSON.stringify(obj.components[i].clone);
		}

		var js_col = "rgb(1,0.5,0)";
		if (obj.components[i] && obj.components[i].material){
			if (obj.components[i].material.color) {
				js_col = obj.components[i].material.color;
			}
		}

		var exp = "function(){" +io_env + " return [function(){" + obj.components[i].js_transformation +"}(), function(){" + obj.components[i].js_parameters + "}(), " + js_col  + "];}();";
		var exp_res = exp;
		obj.components[i].init_transformation = exp_res[0];
		obj.components[i].init_parameters = exp_res[1];
		obj.components[i].init_color = exp_res[2]


		if (obj.components[i].shape) {
			// check if file is in project folder, user folder or global aka coshape folder
			//var fpath = obj.components[i].shape.file;
			//obj.components[i].shape.file = utils.pathJoin(relative_project_path, obj.components[i].shape.file);

		} else if (obj.components[i].project) {
			// no tempering with the file path
			// var fpath = obj.components[i].project.file;
			// obj.components[i].project.file = utils.pathJoin(relative_project_path, obj.components[i].project.file);
		} else {
			// throw("No shape defined for component: " + obj.components[i].name);
			utils.warn("No shape defined for component: " + obj.components[i].name, "renderer");
		}
	}

	if (obj.tools) {
		for (var i = 0; i < obj.tools.length; i++) {
			obj.tools[i].name = Object.keys(obj.tools[i])[0];
		}
	} else {
		obj.tools = [];
	}

	if (obj.instructions) {
		for (var i = 0; i < obj.instructions.length; i++) {
			if (obj.instructions[i].text) {
				obj.instructions[i].out = obj.instructions[i].text.replace(/(\r\n|\n|\r)/gm,"");
			} else {
				obj.instructions[i].out = "";
			}
		}
	}

	return obj;
}

exports.renderProject = function(obj, html_index_template ) {
	return mustache.render(html_index_template, obj);
}

exports.renderProjects = function(lib, callback) {
	if (callback) {
		// render html using template
		utils.loadFile(utils.pathJoin(utils.pathTemplates(), "home.html"), (err, template) => {
			if (err) {
				utils.error("failed to load home html template");
				template = '\
				<html>\
				<head></head>\
				<body>\
				<h1>Workspace</h1>\
				{{#projects}}\
				<a href="/{{url}}">{{name}}</a>\
				<br>\
				{{/projects}}\
				</body>\
				</html>\
				';
			}
			var obj = {projects: []};
			Object.keys(lib).forEach(function(key) {
				obj.projects.push({name:key, url: key});
			});
			callback(exports.renderProject(obj, template));
		});
	}
}
