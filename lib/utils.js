'use strict'
var log = require('npmlog');
var version = require('../package.json').version;

var fs = require('fs');
var path = require('path');
var resolve = path.resolve;
var relative = path.relative;
var mkdirp = require('mkdirp');
var copydir = require('copy-dir');

var jsonfile = require('jsonfile')
var yaml = require('js-yaml');
var yamlinc = require('yaml-include');

const { getInstalledPathSync } = require('get-installed-path')
const rootPath = getInstalledPathSync('coshape')
var templates_path = rootPath + "/lib/templates";


exports.version = version;

exports.info = function(what, where = "") {
	log.info(where, what);
}

exports.error = function(what, where = "") {
	log.error(where, what);
}

exports.warn = function(what, where = "") {
	log.warn(where, what);
}

exports.pathTemplates = function(){
	return templates_path;
}  


// expand relative paths to absolute paths (~/ -> /home/<user>/)
exports.pathNormalize = function(path) {
	if (!path) throw "path is undefined";
	return resolve(path);
}

// expand relative paths to absolute paths (~/ -> /home/<user>/)
exports.pathRelative = function(base_path, path) {
	if (!base_path || !path) throw "path is undefined";
	return relative(base_path, path);
}

// returns directory path of a filepath
exports.pathDirname = function(filepath) {
	if (!path) throw "path is undefined";
	return path.dirname(filepath);
}

exports.fileExists = function(path) {
	return fs.existsSync(path);
}

// returns the lowesr file/folder name of a filepath (/a/b/c -> c)
exports.basename = function(path) {
	return path.basename(path);
}

// read yml tree into json
exports.loadYamlFileSync = function(file_path) {
	var src = fs.readFileSync(file_path, 'utf8');
	return yaml.load(src, { schema: yamlinc.YAML_INCLUDE_SCHEMA });
}

exports.storeJsonFile = function(file_path, json_obj, callback) {
	callback = typeof callback  !== 'undefined' ? callback : (err) => {if(err) throw(err);};
	jsonfile.writeFile(file_path, json_obj, {spaces: 2}, callback);
}
exports.storeFile = function(file_path, data, callback) {
	callback = typeof callback  !== 'undefined' ? callback : (err) => {if(err) throw(err);};

}

// create new directory tree, calls callback(err)
exports.mkdirp = function(path, callback) {
	callback = typeof callback  !== 'undefined' ? callback : (err) => {if(err) throw(err);};
	mkdirp(path, callback);
}

exports.findParentDir = function(dir_path, filename, levels = 2) {
	if (levels > 0) {
		if (exports.fileExists(dir_path + "/" + filename)) {
			return dir_path;
		} else {
			return exports.findParentDir(exports.pathDirname(dir_path), filename, levels-1);
		}
	} else {
		return null;
	}
}

// maybe there is a better way to copy files around
exports.copyFile = function(source, target, meta, callback) {
  var dir_path = path.dirname(target);
	var cbCalled = false;
	var rd = fs.createReadStream(source);
	  rd.on("error", function(err) {
	    done(err);
	  });
	  var wr = fs.createWriteStream(target);
	  wr.on("error", function(err) {
	    done(err);
	  });
	  wr.on("close", function(ex) {
	    done(ex);
	  });
	  rd.pipe(wr);

	  function done(err) {
	    if (!cbCalled) {
	      callback(source, target, meta,  err);
	      cbCalled = true;
	    }
	  }
}
