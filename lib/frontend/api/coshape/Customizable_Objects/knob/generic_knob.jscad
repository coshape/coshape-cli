// title: button
// (c) 2014 Solify, andreas@solify.de
function getParameterDefinitions() {
 return [
   { name: 'diameter', type: 'float', default: 30, caption: "Base Diameter:" },
   { name: 'height', type: 'float', default: 20, caption: "Height:" },
   { name: 'handle_length', type: 'float', default: 35, caption: "Handle Length:" },
   { name: 'handle_width', type: 'float', default: 10, caption: "Handle Width:" },
   { name: 'hole_type', type: 'choice', caption: 'Shaft Shape', values: [0, 1, 2], captions: ["Square", "Circle", "Half Circle"], default: 2 },
   { name: 'hole_diameter', type: 'float', default: 5, caption: "Hole Diameter:" },
   { name: 'hole_depth', type: 'float', default: 15, caption: "Hole Depth:" }
 ];
}

function main(p) {
  var h_width = p.handle_width;
  var h_length = p.handle_length;
  var h_height = p.height;

  var base_r1 = p.diameter/2;
  var base_h = h_height/3;
  var base_r2 = base_r1 - base_h*0.2;

  var hole_d = p.hole_diameter;
  var hole_t = p.hole_depth;

  var base = cylinder({r1:base_r1, r2: base_r2, h: base_h});

  var h_path = new CSG.Path2D(
      [
       [0,h_length/2],
       [h_width/2,h_length/2-h_width/2],
       [h_width/2,-h_length/2],
       [-h_width/2,-h_length/2],
       [-h_width/2,h_length/2-h_width/2]
      ],
       true)
       .innerToCAG()
       ;


  var handle = linear_extrude({ height: h_height },h_path);
  //var handle = linear_extrude({ height: h_height }, square([h_width,h_length]) );
  handle = handle.translate([0,-h_length/16, 0]);
  //var handle = hull( h_path,h_path.translate([0,0,h_height]) );

  var hole;

  if (p.hole_type == 0)
  {
    hole = cube({size: [hole_d,hole_d,hole_t], center: [true,true, false]});
  }
  else if (p.hole_type == 1)
  {
    hole = cylinder({r: hole_d/2, h: hole_t, center: true});
  }
  else if(p.hole_type == 2)
  {
    hole = cylinder({r: hole_d/2, h: hole_t, center: true});
    var shaft = cube({size: [hole_d,hole_d,hole_t], center: [true, true, false] }).translate([0,3*hole_d/4,0]);
    hole = difference(hole, shaft);
  }

  var res = difference(union(base, handle), hole)

  // var res = union( base, handle);


  return res;
}