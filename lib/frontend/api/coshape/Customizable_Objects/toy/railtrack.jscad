// -- OpenJSCAD.org logo

// Here we define the user editable parameters: 
function getParameterDefinitions() {
  return [
      {
      name: 'dir', 
      type: 'choice',
      caption: 'Direction:',
      values: ["left", "right"],
      captions: ["left", "right"], 
      initial: "left"
    },
    
    {name: 'width', 
    caption: 'Track Width:', 
    type: 'float', 
    initial: 14},
    
    {name: 'radius', 
    caption: 'Track Radius:', 
    type: 'float', 
    initial: 100},
    
    {name: 'angle', 
    caption: 'Track Angle:', 
    type: 'float', 
    initial: 45},
    
    {name: 'height', 
    caption: 'Track Height:', 
    type: 'float', 
    initial: 5}
  ];
}

function main(par) {
    
var rad = par.radius;
var spur = par.width;
var railWidth = spur/8;
var railDepth = par.height/2;
var trackWidth = spur+railWidth*4;
var trackHeight = par.height;
var dir = -1;
var trackAngle = par.angle;
var res = (3.1415692*trackAngle/180)*rad

if(par.dir == "left")
{
dir = -1;    
}
else if(par.dir == "right")
{
dir = 1;    
rad = -rad;
trackAngle = -trackAngle;
}
else
{
dir = 0;   
}

// We can make arcs and circles:
var basepath = CSG.Path2D.arc({
  center: [0,0,0],
  radius: rad,
  startangle: 0,
  endangle: trackAngle*1.1,
  resolution: res
});

var rail1path = CSG.Path2D.arc({
  center: [0,0,0],
  radius: rad-spur/2,
  startangle: 0,
  endangle: trackAngle,
  resolution: res
});

var rail2path = CSG.Path2D.arc({
  center: [0,0,0],
  radius: rad+spur/2,
  startangle: 0,
  endangle: trackAngle,
  resolution: res
});
    
    
// var rail = rectangular_extrude(curvedpath,  // path is an array of 2d coords
//    {w: 1, h: 3, closed: true});
    
var base = basepath.rectangularExtrude(trackWidth, trackHeight, 0, false);
var rail1 = rail1path.rectangularExtrude(railWidth, railDepth+1, 0, false).translate([0,0,trackHeight-railDepth]);
var rail2 = rail2path.rectangularExtrude(railWidth, railDepth+1, 0, false).translate([0,0,trackHeight-railDepth]);



// var rail = union(base, rail1, rail2);
var rail = difference(base, rail1, rail2);
rail = rail.translate([-rad,0,0]);

var conA = connectionA(trackWidth, trackHeight, spur ).translate([0,-trackWidth/2,0]);
rail = difference(rail, conA);

var conB = cube({size: [trackWidth*2,trackWidth*2,trackHeight], center: [true,true, false]}).translate([0,trackWidth,0]);
conB = difference(conB, conA);
conB = conB.rotateZ(trackAngle);
conB = conB.translate([cos(trackAngle)*(rad)-rad,sin(trackAngle)*(rad),0]);

   return difference(rail, conB);
}

function connectionA(w, hei, s)
{
    var con  = cube({size: [w,w,hei], center: [true,true, false]});
    var link = cube({size: [s/4,s/2,hei], center: [true,true, false]}).translate([0,w/2+s/4,0]);
    var cyl  = cylinder({r: s/4, h: hei, center: true}).translate([0,w/2+s/2,hei/2]);
    return union(con, link, cyl);
}
