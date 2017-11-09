// title: Case
// (c) 2017 coshape.is, Andreas Fuchs
// license: MIT License

// Here we define the user editable parameters: 
function getParameterDefinitions() {
  return [

    {name: 'length', caption: 'Free Length:', type: 'float', initial: 80},
    {name: 'width', caption: 'Free Width:', type: 'float', initial: 50},
    {name: 'height', caption: 'Free Height:', type: 'float', initial: 25},
    {name: 'thickness', caption: 'Wall Thickness:', type: 'float', initial: 3}
    ,
    {name: 'rim', caption: 'Wall Rim Height:', type: 'float', initial: 2}
  ];
}

// Main entry point; here we construct our solid: 
function main(params)
{
  var inner2 = Case(
    params.length,
    params.width,
    params.height/2 + params.rim,
    params.thickness / 2 
  );
  
  var outer2 = Case(
    params.length + params.thickness,
    params.width + params.thickness,
    params.height/2,
    params.thickness / 2.0
  );
  
  bottom = union(inner2, outer2).translate([0,-params.width/2 - 10,0]);
  
  inner2 = Case(
    params.length,
    params.width,
    params.height/2,
    params.thickness / 2 
  );
  
  outer2 = Case(
    params.length + params.thickness,
    params.width + params.thickness,
    params.height/2 + params.rim,
    params.thickness / 2.0
  );
  
  top = union(inner2, outer2).translate([0,params.width/2 + 10,0]);
  
  
  return union(bottom, top);
}

function Case(l, w, h, d)
{
  var inner = cube([l,w,h], center = false).translate([-l/2, -w/2, d]);
  //var inner2 = cube([l,w,h], center = false).translate([-l/2, -w/2, d]);
  var outer = cube([l+d*2,w+d*2,h+d], center = false).translate([-l/2-d, -w/2-d, 0]);
  return difference(outer, inner);
}

