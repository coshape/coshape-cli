// title: brushless motor
// (c) 2017 andreas@coshape.com

// Here we define the user editable parameters:
  function getParameterDefinitions() {
    return [
      { name: 'diameter', caption: 'diameter', type: 'float', default: 30 },
      { name: 'height', caption: 'height', type: 'float', default: 25 },
      { name: 'shaft_diameter', caption: 'shaft diameter', type: 'float', default: 3 },
      { name: 'shaft_length', caption: 'shaft length', type: 'float', default: 10 }
    ];
  }

function body(d, height) {
  return cylinder({r:d/2, h:height, fn:40});
}

function shaft(d, length) {
  return cylinder({r: d/2, h: length});
}

function main(p) {
  return union(body(p.diameter, p.height)
  , shaft(p.shaft_diameter, p.shaft_length).translate([0,0,p.height]));
}
