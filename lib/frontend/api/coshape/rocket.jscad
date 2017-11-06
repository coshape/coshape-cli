// title: Radial Fan
// (c) 2014 Andreas Fuchs, andreas@solify.de
// Here we define the user editable parameters: 

  function getParameterDefinitions() {
    return [
      //{ name: 'baseD', caption: 'Base Diameter:', type: 'float', default: 80 },
      //{ name: 'bladeH', caption: 'Blade Height:', type: 'float', default: 15 },
      //{ name: 'bladeN', caption: 'Number Of Blades', type: 'int', default: 11 },
      //{ name: 'bladeD', caption: 'Blade Root Diameter:', type: 'float', default: 30 },
      //{ name: 'baseH', caption: 'Wall Thickness:', type: 'float', default: 2 },
      //{ name: 'hubH', caption: 'Hub Height:', type: 'float', default:  7.5},
      //{ name: 'hubD', caption: 'Hub Bore Hole Diameter:', type: 'float', default: 6 },
      //{ name: 'nutD', caption: 'Hub Nut Diameter:', type: 'float', default: 10 },
      //{ name: 'nutH', caption: 'Hub Nut Height:', type: 'float', default: 5 },
      //{ name: 'bladeA', caption: 'Blade Angle', type: 'float', default: 4 },
      
      { name: 'baseH', caption: 'height', type: 'float', default: 200 },
      { name: 'hubH', caption: 'coen height', type: 'float', default: 50 },
      { name: 'baseD', caption: 'diameter', type: 'float', default: 30 },
      { name: 'bladeN', caption: 'number of fins', type: 'int', default: 3 },
      { name: 'thrust', caption: 'thrust', type: 'float', default: 40 },

    ];
  }
  
  
function main(p)
{
  var baseR  = p.baseD / 2;
  var bladeH = p.baseH / 3;
  var bladeR = baseR*2;
  var baseH  = p.baseH;
  var hubH   = p.hubH;
  var bladeN = p.bladeN;

  var base = cylinder({r: baseR, h: baseH, fn:100}); 
  base = union(base, cylinder({r1: baseR, r2: baseR *0.1, h: (hubH), fn:100}).translate([0,0,baseH]) ); 

  var blades = getBlades(bladeR, baseR, baseR/5, bladeH, bladeN);
  var result = union(base, blades);
  //result = difference(result, cylinder({r:holeR, h:(hubH+2)}).translate([0,0,-1]));
  //result = difference(result, hexagon(nutR, nutH).translate([0,0,hubH-nutH]) );
  result = result.translate([0,0,-baseH*2/3]);
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
        blade = blade.translate([0,r1,0]);
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