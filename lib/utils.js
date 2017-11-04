'use strict'
var log = require('npmlog');
var fs = require('fs');
var path = require('path');
var resolve = path.resolve;
exports.info = function(what, where = "") {
	log.info(where, what);
}

exports.error = function(what, where = "") {
	log.error(where, what);
}

exports.warn = function(what, where = "") {
	log.warn(where, what);
}

exports.normalize_path = function(path) {
	if (!path) throw "path is undefined";
	return resolve(path);
}