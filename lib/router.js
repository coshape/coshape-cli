var express = require('express');
var utils = require('./utils');
var path = require('path');



// setup a router with ram data
exports.createRouter = function(container = {}, func_render_home) {
	var router  = express.Router();
	if (container) 
		router._urlDataContainer = container;
	else
		router._urlDataContainer = {};

	router.get('/api', function(req, res) {
		res.send('{msg:"welcome to the api"}');
	});

	router.get('/api/urls', function(req, res) {
		res.send(router._urlDataContainer);
	});

	router.get("/*", function(req, res, next) {
		if (req.originalUrl.startsWith('/reload')) {
			next();
		} else {
			var url = utils.trimUrl(req.params[0]);
			var data = router._urlDataContainer[url];
			if (data)
				res.send(data);
			else {
				var html = url + " is empty.";
				if (func_render_home) {
					html = func_render_home(router._urlDataContainer, html => {
						res.send(html);
					});
				} else {
					utils.warn("no render func");
					res.send(html)
				}
			}
		}

		
	});
	

	router.addDataPair = function(url, data) {
		router._urlDataContainer [url] = data;
	}
	return router;
}


