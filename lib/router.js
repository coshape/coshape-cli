var express = require('express');

// setup a router with ram data
exports.createRouter = function(container = {}) {
	var router  = express.Router();
	if (container) 
		router._urlDataContainer = container;
	else
		router._urlDataContainer = {};

	router.get('/api', function(req, res) {
		res.send('{msg:"welcome to the api"}');
	});

	router.get('/*', function(req, res) {
		var url = req.params[0];
		var data = router._urlDataContainer[url];
		if (data)
			res.send(data);
		else
			res.send(url + " is empty.")
	});

	router.addDataPair = function(url, data) {
		this._urlDataContainer [url] = data;
	}
	return router;
}


