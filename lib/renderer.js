'use strict'

var utils = require('./utils');
var fs = require('fs');
var mustache = require('mustache');

exports.renderSync = function(temp_in, obj_in, dat_out) {
	var temp_data = fs.readFileSync(temp_in).toString();
	var res = mustache.render(temp_data, obj_in);
	fs.writeFileSync(dat_out, res);
}

