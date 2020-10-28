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
    return CSG.roundedCube({ // rounded cube
    center: [0, 0, h/4],
    radius: [l/2, w/2, h/2],
    roundradius: w / 10,
    resolution: 2
});
}

function main(p) {
	res = []

	// add base case

	// add arms
	res.push(arm_motor_mount(p.motor_diameter, p.motor_diameter/2
	, p.wall_thickness, p.motor_diameter, p.arm_length).translate([p.arm_length, 0, 0]).rotateZ(45));
  res.push(arm_motor_mount(p.motor_diameter, p.motor_diameter/2
  	, p.wall_thickness, p.motor_diameter, p.arm_length).translate([p.arm_length, 0, 0]).rotateZ(45+90));
  res.push(arm_motor_mount(p.motor_diameter, p.motor_diameter/2
  	, p.wall_thickness, p.motor_diameter, p.arm_length).translate([p.arm_length, 0, 0]).rotateZ(45+180));
  res.push(arm_motor_mount(p.motor_diameter, p.motor_diameter/2
  	, p.wall_thickness, p.motor_diameter, p.arm_length).translate([p.arm_length, 0, 0]).rotateZ(45+270));
  res.push(body(p.body_length, p.body_width, p.body_height));


	// cut space for battery and electronics
	return union(res);
}
