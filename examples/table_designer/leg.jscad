// title: table leg
// (c) 2017, andreas@coshape.com

function getParameterDefinitions() {
  return [
   { name: 'length', type: 'float', default: 100, caption: "Length:" },
   { name: 'width', type: 'float', default: 100, caption: "Width:" },
   { name: 'height', type: 'float', default: 100, caption: "Height:" },
   { name: 'thickness', type: 'float', default: 10, caption: "Thickness:" },
   ]
}

function main(p) {
	var leg_out = cube({size: [p.length, p.width, p.height]})
	var leg_in = cube({size: [p.length*2, p.width-p.thickness*1.0, p.height-p.thickness*1.0]}).translate([0,p.thickness*0.5,p.thickness*0.5]);
	return difference(leg_out, leg_in).translate([-p.length*0.5,-p.width*0.5,0]);
}
