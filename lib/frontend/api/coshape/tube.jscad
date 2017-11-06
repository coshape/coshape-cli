// title: model rocket
// (c) 2017 coshape.is
// Here we define the user editable parameters: 

  function getParameterDefinitions() {
    return [
      { name: 'tube_height', caption: 'tube height', type: 'float', default: 260 },
      { name: 'tube_dia', caption: 'tube diameter', type: 'float', default: 25 },
      { name: 'tube_thickness', caption: 'tube thickness', type: 'float', default: 1 },
    ];
  }

function tube(height, d, t) {
  return difference(cylinder({r: d/2, h: height, fn:40})
    , cylinder({r: d/2-t, h: height+2, fn:40}).translate([0,0,-1]));
}

function main(p)
{
  return tube(p.tube_height, p.tube_dia, p.tube_thickness)
}
