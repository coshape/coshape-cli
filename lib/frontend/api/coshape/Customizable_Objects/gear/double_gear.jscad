// title: Gear
// author: Joost Nieuwenhuijse, Andreas Fuchs
// license: MIT License

// Here we define the user editable parameters: 
function getParameterDefinitions() {
  return [
    { name: 'numTeeth1', caption: 'Number of teeth (1):', type: 'int', initial: 30 },
    { name: 'circularPitch1', caption: 'Circular pitch (1):', type: 'float', initial: 2 },
    { name: 'thickness1', caption: 'Thickness (1):', type: 'float', initial: 5 },
    //{ name: 'pressureAngle', caption: 'Pressure angle:', type: 'float', initial: 20 },
    //{ name: 'clearance', caption: 'Clearance:', type: 'float', initial: 0 },
    { name: 'numTeeth2', caption: 'Number of teeth (2):', type: 'int', initial: 10 },
    { name: 'circularPitch2', caption: 'Circular pitch (2):', type: 'float', initial: 2 },
    { name: 'thickness2', caption: 'Thickness (2):', type: 'float', initial: 10 },
    { name: 'centerholeradius', caption: 'Radius of center hole (0 for no hole):', type: 'float', initial: 1.5 }
  ];
}

// Main entry point; here we construct our solid: 
function main(params)
{
  var gear = involuteGear(
    params.numTeeth1,
    params.circularPitch1,
    20,
    0,
    params.thickness1
  );
  var gear2 = involuteGear(
    params.numTeeth2,
    params.circularPitch2,
    20,
    0,
    params.thickness2
  );
  if(params.centerholeradius > 0)
  {
    var centerhole = CSG.cylinder({start: [0,0,-params.thickness1], end: [0,0,params.thickness1+params.thickness2], radius: params.centerholeradius, resolution: 16});
    gear = gear.subtract(centerhole);
    gear = gear.translate([0,0,-params.thickness1/2]);
    gear2 = gear2.subtract(centerhole);
    gear2 = gear2.translate([0,0,params.thickness2/2]);
  }
  
// return gear;

return union(
    gear,
    gear2
    )

}

/*
  For gear terminology see: 
    http://www.astronomiainumbria.org/advanced_internet_files/meccanica/easyweb.easynet.co.uk/_chrish/geardata.htm
  Algorithm based on:
    http://www.cartertools.com/involute.html

  circularPitch: The distance between adjacent teeth measured at the pitch circle
*/ 
function involuteGear(numTeeth, circularPitch, pressureAngle, clearance, thickness)
{
  // default values:
  if(arguments.length < 3) pressureAngle = 20;
  if(arguments.length < 4) clearance = 0;
  if(arguments.length < 4) thickness = 1;
  
  var addendum = circularPitch / Math.PI;
  var dedendum = addendum + clearance;
  
  // radiuses of the 4 circles:
  var pitchRadius = numTeeth * circularPitch / (2 * Math.PI);
  var baseRadius = pitchRadius * Math.cos(Math.PI * pressureAngle / 180);
  var outerRadius = pitchRadius + addendum;
  var rootRadius = pitchRadius - dedendum;

  var maxtanlength = Math.sqrt(outerRadius*outerRadius - baseRadius*baseRadius);
  var maxangle = maxtanlength / baseRadius;

  var tl_at_pitchcircle = Math.sqrt(pitchRadius*pitchRadius - baseRadius*baseRadius);
  var angle_at_pitchcircle = tl_at_pitchcircle / baseRadius;
  var diffangle = angle_at_pitchcircle - Math.atan(angle_at_pitchcircle);
  var angularToothWidthAtBase = Math.PI / numTeeth + 2*diffangle;

  // build a single 2d tooth in the 'points' array:
  var resolution = 5;
  var points = [new CSG.Vector2D(0,0)];
  for(var i = 0; i <= resolution; i++)
  {
    // first side of the tooth:
    var angle = maxangle * i / resolution;
    var tanlength = angle * baseRadius;
    var radvector = CSG.Vector2D.fromAngle(angle);    
    var tanvector = radvector.normal();
    var p = radvector.times(baseRadius).plus(tanvector.times(tanlength));
    points[i+1] = p;
    
    // opposite side of the tooth:
    radvector = CSG.Vector2D.fromAngle(angularToothWidthAtBase - angle);    
    tanvector = radvector.normal().negated();
    p = radvector.times(baseRadius).plus(tanvector.times(tanlength));
    points[2 * resolution + 2 - i] = p;
  }

  // create the polygon and extrude into 3D:
  var tooth3d = new CSG.Polygon2D(points).extrude({offset: [0, 0, thickness]});

  var allteeth = new CSG();
  for(var j = 0; j < numTeeth; j++)
  {
    var ang = j*360/numTeeth;
    var rotatedtooth = tooth3d.rotateZ(ang);
    allteeth = allteeth.unionForNonIntersecting(rotatedtooth);
  }

  // build the root circle:  
  points = [];
  var toothAngle = 2 * Math.PI / numTeeth;
  var toothCenterAngle = 0.5 * angularToothWidthAtBase; 
  for(var k = 0; k < numTeeth; k++)
  {
    var angl = toothCenterAngle + k * toothAngle;
    var p1 = CSG.Vector2D.fromAngle(angl).times(rootRadius);
    points.push(p1);
  }

  // create the polygon and extrude into 3D:
  var rootcircle = new CSG.Polygon2D(points).extrude({offset: [0, 0, thickness]});

  var result = rootcircle.union(allteeth);

  // center at origin:
  result = result.translate([0, 0, -thickness/2]);

  return result;
}