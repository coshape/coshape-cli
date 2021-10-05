'use strict'
var log = require('npmlog');
var version = require('../package.json').version;

log.heading = "coshape";
// log.enableProgress();

//var fs = require('fs').promises;
var fs = require('fs');
var fs_promise = require('fs').promises;


var path = require('path');
var resolve = path.resolve;
var relative = path.relative;
var mkdirp = require('mkdirp');
var copydir = require('copy-dir');

var jsonfile = require('jsonfile')
var yaml = require('js-yaml');
var yamlinc = require('yaml-include');

const { getInstalledPathSync } = require('get-installed-path')
const rootPath = __dirname //getInstalledPathSync('coshape')

const chokidar = require('chokidar');

var templates_path = path.join(rootPath, "templates");
var frontend_path =  path.join(rootPath, "frontend");

exports.version = version;

/*

this module serves as thin wrapper for os dependant functions.

*/

exports.info = function(what, where = "") {
	log.info(where, what);
}

exports.error = function(what, where = "") {
	log.error(where, what);
	console.trace();
}

exports.warn = function(what, where = "") {
	log.warn(where, what);
}
exports.progress = function(name, todo, weight) {
	return log.newItem(name, todo, weight);
}

exports.pathTemplates = function(){
	return templates_path;
}

exports.pathFrontend = function(){
	return frontend_path;
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
	if (!filepath) throw "path is undefined";
	return path.dirname(filepath);
}

exports.pathResolve = function(lhs_path, rhs_path) {
	return path.resolve(lhs_path, rhs_path);
}

exports.pathJoin = function(lhs_path, rhs_path) {
	return path.join(lhs_path, rhs_path);
}

exports.fileExistsSync = function(path) {
	// use fs.statSync(path) insted!
	return fs.existsSync(path);
}


/*
exports.fileExists = function(path) {
	// use fs.statSync(path) insted!
	return fs.existsSync(path);
}*/

 exports.fileExistsAsync = async function(path) {
	 return fs_promise.access(path, fs.constants.F_OK)
            .then(() => true)
            .catch(() => false)
}

/*
exports.fileExistsAsync = async function(path) {
	//fs.access(path, fs.F_OK, callback)
	//return await fs.access(path, fs.F_OK)
	try {
		//return [(null), (await fs.access(path, fs.F_OK))]
		return await fs.access(path, fs.F_OK)
	} catch(ex) {
		//return [ex, null]
		exports.warn("fileExists Err", ex, "build")
		return null
	}
}
*/

// list files in the path
exports.listDirSync = function(path) {
	return fs.readdirSync(path);
}

// list files in the path
exports.listDir = function(path, callback) {
	return fs.readdir(path, callback);
}

// returns the lower file/folder name of a filepath (/a/b/c -> c)
exports.pathBasename = function(filepath) {
	return path.basename(filepath);
}

// read yml tree into json
exports.loadYamlFile = function(file_path, callback) {
	fs.readFile(file_path, (err, data) => {
		if (err) {
			callback(err)
		} else {
			callback(null, yaml.load(data, { schema: yamlinc.YAML_INCLUDE_SCHEMA }))
		}
	})
}

// read yml tree into json
exports.loadYamlFileAsync = async function(file_path) {
	try {
		let data = await fs_promise.readFile(file_path)
		return yaml.load(data, { schema: yamlinc.YAML_INCLUDE_SCHEMA })
	} catch(ex) {
		throw ex
	}
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

exports.storeJsonFileAsync = async function(file_path, json_obj) {
	return new Promise((resolve, reject)=>{
		exports.storeJsonFile(file_path, json_obj, (err) => {
			if (err) {
				reject(err)
			} else {
				resolve()
			}
		});
	})
}

exports.loadFile = function(file_path, callback) {
	callback = typeof callback  !== 'undefined' ? callback : (err, data) => {if(err) throw(err);};
	fs.readFile(file_path, 'utf8', callback);
}

exports.loadFileAsync = function(file_path) {
	return new Promise((resolve, reject) => {
		exports.loadFile(file_path, (err, data) => {
			if (err) {
				reject(err)
			} else {
				resolve(data)
			}
		})
	})
}

exports.storeFile = function(file_path, data, callback) {
	callback = typeof callback  !== 'undefined' ? callback : (err) => {if(err) throw(err);};
	fs.writeFile(file_path, data, callback);
}

exports.storeFileAsync = function(file_path, data) {
	return new Promise((resolve, reject) => {
		exports.storeFile(file_path, data, (err) => {
			if (err) {
				reject(err)
			} else {
				resolve()
			}
		})
	})
}

// create new directory tree, calls callback(err)
exports.mkdirp = function(path, callback) {
	callback = typeof callback  !== 'undefined' ? callback : (err) => {if(err) throw(err);};
	mkdirp(path, callback);
}

exports.mkdirpAsync = function(path) {
	return new Promise((resolve, reject)=>{
		exports.mkdirp(path, (err)=>{
			if (err)
				reject(err)
			else {
				resolve()
			}
		})
	})
}

/*
exports.findParentDir = async function(dir_path, filename, levels = 2) {
	if (levels > 0) {
		console.log("parent dir", exports.pathJoin(dir_path, filename))
		let found = await exports.fileExistsAsync(exports.pathJoin(dir_path, filename));
		if (found) {
			exports.info("parent dir found", found)
			return dir_path;
		} else {
			return exports.findParentDir(exports.pathDirname(dir_path), filename, levels-1);
		}
	} else {
		return null;
	}
}
*/


exports.findParentDir = function(dir_path, filename, levels = 2) {
	if (levels > 0) {
		if (exports.fileExistsSync(exports.pathJoin(dir_path, filename))) {
			return dir_path;
		} else {
			return exports.findParentDir(exports.pathDirname(dir_path), filename, levels-1);
		}
	} else {
		return null;
	}
}


// descent file tree
// test file with condition function
// react with on_true and on_false callbacks (filename, dirpath)
exports.walkDir = function(filepath, condition, on_true, on_false) {
	var files = exports.listDir(filepath, (err, files) => {
		if (files) {
			files.forEach(file => {
				if (condition) {
					if (condition(file)) {
						if (on_true)
							on_true(file, filepath);
					} else {
						if (on_false)
							on_false(file, filepath);
					}
				}
				exports.walkDir(path.join(filepath, file), condition, on_true, on_false);
			});
		}
	});
}

// maybe there is a better way to copy files around
exports.copyFile = function(source, target, /*meta,*/ callback) {
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
	    	callback(err /*, source, target, meta,  err*/);
	      	//callback(source, target, meta,  err);
	      	cbCalled = true;
	    }
	  }
}

exports.copyFileAsync = function(path_from, path_to) {
	return new Promise((resolve, reject)=>{
		exports.copyFile(path_from, path_to, (err)=>{
			if (err) {
				reject(err)
			} else {
				resolve()
			}
		})
	})
}

exports.trimUrl = function(url) {
	return url.replace(/\/$/, "");
}

exports.watchFolder = function(path, callback) {
	if (callback) {
		chokidar.watch(path).on('all', (evtype, filename) => {
			if (evtype!='addDir' && evtype!='add' && evtype!='unlinkDir'  && evtype!='unlink') {
				exports.info(filename, evtype );
				callback();
			}
		});
	}
}

exports.forEachAsync = async function(array, callback) {
	for(let i=0; i<array.length; i++) {
		await callback(array[i], i, array)
	}
}
