// title: window frame
// (c) 2017, andreas@coshape.com

function getParameterDefinitions() {
  return [
   { name: 'width', type: 'float', default: 500, caption: "Width:" },
   { name: 'depth', type: 'float', default: 30, caption: "Depth:" },
   { name: 'height', type: 'float', default: 500, caption: "Height:" },
   { name: 'thickness', type: 'float', default: 20, caption: "Thickness:" },
   ]
}

function main(p) {
	var frm_out = cube({size: [p.width + p.thickness*2.0, p.depth, p.height + p.thickness*2.0]});
	var frm_in = cube({size: [p.width, p.depth*2.0, p.height]}).translate([p.thickness,-p.depth,p.thickness]);
	return difference(frm_out, frm_in).translate([-p.width*0.5-p.thickness,-p.depth*.5,-p.height*.5-p.thickness]);
}
