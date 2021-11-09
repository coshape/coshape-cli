// title: table plate
// (c) 2017, andreas@coshape.com

function getParameterDefinitions() {
  return [
   { name: 'length', type: 'float', default: 100, caption: "Length:" },
   { name: 'width', type: 'float', default: 100, caption: "Width:" },
   { name: 'height', type: 'float', default: 100, caption: "Height:" },
   ]
}

function main(p) {
	var plate = cube({size: [p.length, p.width, p.height]})
	.translate([-p.length*0.5, -p.width*0.5,0]);
	return plate;
}
