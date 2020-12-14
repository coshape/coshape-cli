// title: quadrocopter chassis
// (c) 2017 andreas@coshape.com

// Here we define the user editable parameters:
  function getParameterDefinitions() {
    return [
      { name: 'body_length', caption: 'base length', type: 'float', default: 150 },
      { name: 'body_width', caption: 'base width', type: 'float', default: 50 },
      { name: 'body_height', caption: 'base width', type: 'float', default: 50 },
      { name: 'motor_diameter', caption: 'motor diameter', type: 'float', default: 30 },
      { name: 'arm_length', caption: 'diameter', type: 'float', default: 160 },
      { name: 'wall_thickness', caption: 'wall thickness', type: 'float', default: 2 }
    ];
  }

function arm(depth, length, height) {
  return cylinder({r: depth/2, h: length}).rotateY(-90).scale([1,1,height/depth]);
}

function arm2(depth, length, height) {
  return CSG.roundedCube({ // rounded cube
      center: [-length/2, 0, 0],
      radius: [length/2, depth/2, height/2],
      roundradius: depth / 10,
      resolution: 2
  });
}

function arm_motor_mount(motor_d, motor_depth, thickness, arm_depth, arm_length) {
  return difference(
  union(cylinder({r:motor_d/2 + thickness, h:motor_depth + thickness}).translate([0,0,-thickness])
  ,arm2(arm_depth, arm_length, arm_depth/2).translate([0,0, motor_depth/2]))
  , cylinder({r:motor_d/2,h: motor_depth + 1}) ).translate([0,0,-motor_depth/2]);
}

function arm_motor_mount2(motor_d, motor_depth, thickness, arm_depth, arm_length) {
  return difference(
  union(cylinder({r:motor_d/2 + thickness, h:motor_depth + thickness}).translate([0,0,-thickness])
  ,arm2(arm_depth, arm_length, arm_depth/2).translate([0,0, motor_depth/2]))
  , cylinder({r:motor_d/2,h: motor_depth + 1}) ).translate([0,0,-motor_depth/2]);
}

function planeRoundBox(dx,dy,dz, r) {
  var path = CAG.roundedRectangle({center: [0,0], radius: [dx/2, dy/2], roundradius: r, resolution: 32});
  return linear_extrude({ height: dz }, path);
}

function body(l,w,h) {
    var d = Math.min(l,w,h)
    return CSG.roundedCube({ // rounded cube
    center: [0, 0, h/4],
    radius: [l/2, w/2, h/2],
    roundradius: d / 10,
    resolution: 2
});
}

function body_shell(l,w,h, h2) {
  var b = body(l, w,h)
  var cut = cube({size:[l+1, w+1, h+1], center:true}).translate([-(l-w)/4,0,h2])
  return difference(b, cut)
}


function main(p) {
	res = []

	// add base case

  //res.push(body(p.body_length, p.body_width, p.body_height));

  //res.push(body(p.body_width*2, p.body_width*1.5, p.body_height/2));

  res.push(body_shell(p.body_length, p.body_width, p.body_height, -p.body_height*0.25));


	// cut space for battery and electronics
	return union(res);
}