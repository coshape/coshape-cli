// title: quadrocopter arm
// (c) 2017 andreas@coshape.com

// Here we define the user editable parameters:
  function getParameterDefinitions() {
    return [
      { name: 'length', caption: 'diameter', type: 'float', default: 150 },
      { name: 'arm_thickness', caption: 'arm thickness', type: 'float', default: 30 },
      { name: 'motor_diameter', caption: 'motor diameter', type: 'float', default: 30 },
      { name: 'length', caption: 'diameter', type: 'float', default: 160 },
      { name: 'wall_thickness', caption: 'wall thickness', type: 'float', default: 1.5 }
    ];
  }

function tube(height, d, t) {
  return difference(cylinder({r: d/2, h: height, fn:40})
    , cylinder({r: d/2-t, h: height+2, fn:40}).translate([0,0,-1]));
}

function body_mount(d, height) {
  return cylinder({r:d/2, h:height, fn:40});
}

function arm(depth, length, height) {
  return cylinder({r: depth/2, h: length}).rotateY(-90).scale([1,1,height/depth]);
}

function motor_mount(motor_d, depth, thickness) {
  return difference( cylinder({r:motor_d/2 + thickness, h:depth + thickness}).translate([0,0,-thickness])
  , cylinder({r:motor_d/2,h: depth + 1}) ).translate([0,0,-depth/2]);
}

function arm_motor_mount(motor_d, motor_depth, thickness, arm_depth, arm_length) {
  return difference(
  union(cylinder({r:motor_d/2 + thickness, h:motor_depth + thickness}).translate([0,0,-thickness])
  ,arm(arm_depth, arm_length, arm_depth / 3).translate([0,0, motor_depth/2]))
  , cylinder({r:motor_d/2,h: motor_depth + 1}) ).translate([0,0,-motor_depth/2]);
}

function main(p) {
  return arm_motor_mount(p.motor_diameter, p.motor_diameter/2, p.wall_thickness, p.arm_thickness+p.wall_thickness*2, p.length);
}
