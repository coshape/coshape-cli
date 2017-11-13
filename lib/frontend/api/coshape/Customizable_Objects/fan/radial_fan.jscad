// title: Radial Fan
// (c) 2017 coshape.is, Andreas Fuchs
// Here we define the user editable parameters: 

  function getParameterDefinitions() {
    return [
      { name: 'baseD', caption: 'Base Diameter:', type: 'float', default: 80 },
      { name: 'bladeH', caption: 'Blade Height:', type: 'float', default: 15 },
      { name: 'bladeN', caption: 'Number Of Blades', type: 'int', default: 11 },
      { name: 'bladeD', caption: 'Blade Root Diameter:', type: 'float', default: 30 },
      { name: 'baseH', caption: 'Wall Thickness:', type: 'float', default: 2 },
      { name: 'hubH', caption: 'Hub Height:', type: 'float', default:  7.5},
      { name: 'hubD', caption: 'Hub Bore Hole Diameter:', type: 'float', default: 6 },
      { name: 'nutD', caption: 'Hub Nut Diameter:', type: 'float', default: 10 },
      { name: 'nutH', caption: 'Hub Nut Height:', type: 'float', default: 5 },
      //{ name: 'bladeA', caption: 'Blade Angle', type: 'float', default: 4 },
    ];
  }
  
  
function main(p)
{
  
  var baseR  = p.baseD / 2;
  var bladeH = p.bladeH;
  var bladeR = p.bladeD / 2;
  var baseH  = p.baseH;
  var hubH   = p.hubH;
  var hubR   = p.nutD / 2 + 3;
  var holeR  = p.hubD / 2;
  var nutR   = p.nutD /2;
  var bladeN = p.bladeN;
  var nutH   = p.nutH;

  var base = cylinder({r: baseR, h: baseH, fn:100}); 
  var base = union(base, cylinder({r1: ((baseR-bladeR)/2+bladeR), r2: hubR, h: (hubH-baseH), fn:100}).translate([0,0,baseH]) ); 
  var hub  = cylinder({r: hubR, h: hubH});
  var blades = getBlades(bladeR, baseR, baseH, bladeH, bladeN);
  var result = union(union(base, hub), blades);
  //var result = union(base, hub);
  result = difference(result, cylinder({r:holeR, h:(hubH+2)}).translate([0,0,-1]));
  result = difference(result, hexagon(nutR, nutH).translate([0,0,hubH-nutH]) );
  
  return result;
  
}

function getBlade(l, w, h)
{  
  var path = new CSG.Path2D([ [w/10,0], [-w/10,0], [-w/2,l], [w/2,l] ], true);
  var bl = linear_extrude({height: h}, path.innerToCAG());
  return bl;
}

function getBlades(r1,r2, d, h, n)
{
    var dr = r2-r1-0.5;
    var blades = [];
    var da = 360.0/n;   
    for (var i=0; i < n; i++)
    {
        var blade = getBlade(dr, d, h); //cube([d, dr, h], center = false);
        blade = blade.translate([-d/2,r1,0]);
        blade = blade.rotateZ(i*da);
        blades[i] = blade;
    }
    return union(blades);
}

function hexagon(radius, height)
{
var vertices=[];
for(var i=0; i < 6; i++)
{
var point=CSG.Vector2D.fromAngleDegrees(-i*60).times(radius).toVector3D(0);
vertices.push(new CSG.Vertex(point));
}
var polygon=new CSG.Polygon(vertices);
var hex=polygon.extrude([0,0,height]);
return hex;
}