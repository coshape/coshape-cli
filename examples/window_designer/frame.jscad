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
  var t = p.thickness;
  var w = p.width+t*2.0;
  var h = p.height+t*2.0;
  var d = p.depth;

  var frm_out = cube({size: [w + t*2.0, d, h + t*2.0]});
  var frm_in = cube({size: [w, d*2.0, h]}).translate([t,-d,t]);

  return difference(frm_out, frm_in).translate([-w*0.5-t,-d*0.25,-h*.5-t]);
}
