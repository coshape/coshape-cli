
// title: Base for sub
// author: foo
// date: 2017-08-25 18:34:45.222774

// define paramaters with this function
function getParameterDefinitions() {
  return [
    { name: 'length',    type: 'float', default: 50,  caption: "Length"    },
    { name: 'width',     type: 'float', default: 40,  caption: "Width"     },
    { name: 'height',    type: 'float', default: 15,  caption: "Height"    },
    { name: 'radius',    type: 'float', default: 3,   caption: "Radius"    },
    { name: 'thickness', type: 'float', default: 1.5, caption: "Thickness" },
    ];
}

// helper function to create box with round corners
function planeRoundBox(length, width, height, radius)
{
    var path = CAG.roundedRectangle({center: [0,0], radius: [length/2, width/2], roundradius: radius, resolution: 16 });
  	return linear_extrude({ height: height }, path);
}

// this is the entry point of the object definition
function main(parameters) {
	var outer_box = planeRoundBox(parameters.length, parameters.width, parameters.height, parameters.radius);
	var inner_box = planeRoundBox(parameters.length-parameters.thickness*2, 
		parameters.width - parameters.thickness * 2, 
		parameters.height - parameters.thickness * 2, 
		parameters.radius - parameters.thickness).translate([ 0, 0, parameters.thickness ]);
	
	// boolean operation: subtract the inner rounded box from the outer rounded box to create a shell
	var object = difference(outer_box, inner_box);

	var rim = planeRoundBox(parameters.length-parameters.thickness, 
			parameters.width - parameters.thickness, 
			parameters.thickness, 
			parameters.radius - parameters.thickness / 2).translate([ 0, 0, parameters.height - parameters.thickness ]);
				
	// boolean operation to create an inner rim
	object = difference(object, rim);
	return object;
}
					