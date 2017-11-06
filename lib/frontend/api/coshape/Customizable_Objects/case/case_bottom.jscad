// title: Electronics Case
// (c) 2014 Solify, andreas@solify.de

function getParameterDefinitions() {
  return [
   { name: 'length', type: 'float', default: 100, caption: "Length:" },
    { name: 'width', type: 'float', default: 80, caption: "Width:" },
    { name: 'height', type: 'float', default: 25, caption: "Height:" },
    //{ name: 'depth', type: 'float', default: 70, caption: "Depth:" },
    //{ name: 'cut_out', type: 'choice', caption: 'Display Cut Out', values: [0, 1], captions: ["No Cut Out", "Display Cut out"], default: 1 },
    //{ name: 'cut_x', type: 'float', default: 0, caption: "Left:" },
    //{ name: 'cut_y', type: 'float', default: 0, caption: "Top:" },
    //{ name: 'cut_width', type: 'float', default: 64, caption: "Width:" },
    //{ name: 'cut_height', type: 'float', default: 48, caption: "Height:" },
    //{ name: 'cut_height', type: 'float', default: 48, caption: "Height:" }
    { name: 'breakout', type: 'choice', caption: 'PCB Breakout', 
    values: [0, 1], 
    captions: ["No Breakout", "Arduino Uno"], default: 1 },

    //,
    //{ name: 'thickness', type: 'float', default: 2, caption: "Wall Thickness:" },
    //{ name: 'screws', type: 'choice', caption: 'Screws', values: [0, 1,2,3], captions: ["No Screws", "M3", "M4", "M5"], default: 1 },
    //{ name: 'rounded', type: 'choice', caption: 'Round the corners', values: [0, 1], captions: ["No", "Yes"], default: 1 }
  ];
}

function main(params) {
  var result;
  var d = 2;




  var dx = params.length; var dy = params.width; var dz = params.height;
  //var d = params.thickness;

  if(params.breakout == 1)
  {
  if(dx<80) dx = 80;
  if(dy<80) dy = 80;
  if(dz-d<15) dx = 15+d;
  }
  dx -= d*2;
  dy -= d*2;
  dz -= d;

  var outer = planeRoundBox(dx + d*2, dy + d*2, dz+d, 8+d);
  var inner = planeRoundBox(dx, dy , dz, 8).translate([0,0,d]);

  var bottom = difference(outer, inner);

  inner = planeRoundBox(dx, dy , dz + d *2, 8).translate([0,0,d]);
  var inner2 = planeRoundBox(dx - d, dy - d , dz + d*2 , 8).translate([0,0,d]);
  //var top = difference( union(outer, inner), inner2);

  /*
  if(params.cut_out == 1)
  {
  disw = params.cut_width;
  dish = params.cut_height;

  disx = -disw/2 + params.cut_x;
  disy = -dish/2 + params.cut_y;

  display = cube({size: [disw, dish,d*2]});
  display = display.translate([disx, disy,0]);
  top = difference( top, display);
  }
  */

  var screw_d = 3;
  var ds = 5; 
  var off = screw_d/2*3;

  var p1 = [-(dx/2-off), -(dy/2-off), d];
  var p2 = [ (dx/2-off), -(dy/2-off), d];
  var p3 = [-(dx/2-off),  (dy/2-off), d]; 
  var p4 = [ (dx/2-off),  (dy/2-off), d];

  var pole1 = screwPole(screw_d/2, screw_d+2, dz-d).translate(p1);
  var pole2 = screwPole(screw_d/2, screw_d+2, dz-d).translate(p2);
  var pole3 = screwPole(screw_d/2, screw_d+2, dz-d).translate(p3);
  var pole4 = screwPole(screw_d/2, screw_d+2, dz-d).translate(p4);
  bottom = union( bottom, pole1,pole2,pole3,pole4 );

  p1 = [-(dx/2-off), -(dy/2-off), -d];
  p2 = [ (dx/2-off), -(dy/2-off), -d];
  p3 = [-(dx/2-off),  (dy/2-off), -d];
  p4 = [ (dx/2-off),  (dy/2-off), -d];

  var hole1 = cylinder({r: screw_d, h: dz-d}).translate(p1);
  var hole2 = cylinder({r: screw_d, h: dz-d}).translate(p2);
  var hole3 = cylinder({r: screw_d, h: dz-d}).translate(p3);
  var hole4 = cylinder({r: screw_d, h: dz-d}).translate(p4);

  var bottom_holes = union(hole1, hole2, hole3, hole4);
  bottom = difference(bottom, bottom_holes);

  if(params.breakout == 1)
  {
  var hole_usb = cube({size: [12, 12,12]}).translate([-dx/2-4, 5.5, 4+d]);
  bottom = difference(bottom, hole_usb);
  var support = cube({size: [3,54,3]}).translate([-dx/2, -27, d]);
  var support2 = union(cube({size: [5,5,3]}).translate([-dx/2+68-2.5, -20-2.5,d]), cylinder({r: 1.5, h: 3}).translate([-dx/2+68, -20,d+3]));
  bottom = union(bottom, support, support2);
  bottom = union(bottom, support, support2.translate([0,28,0]));
  }


  return bottom;
/*
  p1 = [-(dx/2-off), -(dy/2-off), d];
  p2 = [ (dx/2-off), -(dy/2-off), d];
  p3 = [-(dx/2-off),  (dy/2-off), d];
  p4 = [ (dx/2-off),  (dy/2-off), d];

  pole1 = screwPole(screw_d/2*4/5, screw_d, dz+d*2).translate(p1);
  pole2 = screwPole(screw_d/2*4/5, screw_d, dz+d*2).translate(p2);
  pole3 = screwPole(screw_d/2*4/5, screw_d, dz+d*2).translate(p3);
  pole4 = screwPole(screw_d/2*4/5, screw_d, dz+d*2).translate(p4);
  top = union( top, pole1,pole2,pole3,pole4 );
*/
  //result = union(bottom.translate([0,-dy/2-10,0]), top.translate([0,dy/2+10,0]));
  //return result;
}

function planeRoundBox(dx,dy,dz, r)
{
    var path = CAG.roundedRectangle({center: [0,0], radius: [dx/2, dy/2], roundradius: r, resolution: 32});
  return linear_extrude({ height: dz }, path);
}

function screwPole(r_in, r_out, height)
{
  var res;
  res = difference(cylinder({r: r_out, h: height}), cylinder({r: r_in, h: height+2}).translate([0,0,-1]));                
  return res;
}