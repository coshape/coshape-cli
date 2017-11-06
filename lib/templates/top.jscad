
// title: Top for sub
// author: foo
// date: 2017-08-25 18:34:45.222774

// define paramaters with this function
function getParameterDefinitions() {
  return [
	{ name: 'length',    type: 'float', default: 50,  caption: "Length"    },
	{ name: 'width',     type: 'float', default: 40,  caption: "Width"     },
	{ name: 'radius',    type: 'float', default: 3,   caption: "Radius"    },
	];
}

// this is the entry point of the object definition
function main(parameters) {

	// create a 2D path for laser cutter or CNC routers
	var object = CAG.roundedRectangle({center: [0,0], radius: [parameters.length/2, parameters.width/2], roundradius: parameters.radius, resolution: 16 });
	return object;
}
										