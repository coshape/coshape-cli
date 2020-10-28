// title: glas plate
// (c) 2017, andreas@coshape.com

function getParameterDefinitions() {
  return [
   { name: 'width', type: 'float', default: 100, caption: "Width:" },
   { name: 'depth', type: 'float', default: 5, caption: "Depth:" },
   { name: 'height', type: 'float', default: 100, caption: "Height:" },
   { name: 'layers', type: 'int', default: 2, caption: "Layers:" },
   ]
}

function main(p) {
	var n_layers = p.layers;

	var layer_depth = p.depth * 0.1;

	var plates = union([
	cube({size: [p.width, layer_depth, p.height]}).translate([0, p.depth *0.5,0]),
	cube({size: [p.width, layer_depth, p.height]}).translate([0, -p.depth *0.5,0])
	]);

	return plates.translate([-p.width*0.5,0,-p.height*.5]);
}
