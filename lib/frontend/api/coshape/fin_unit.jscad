// title: model rocket
// (c) 2017 coshape.is, Andreas Fuchs
// Here we define the user editable parameters: 

  function getParameterDefinitions() {
    return [
      { name: 'tube_height', caption: 'tube height', type: 'float', default: 160 },
      { name: 'cone_height', caption: 'nose cone height', type: 'float', default: 50 },
      { name: 'tube_dia', caption: 'tube diameter', type: 'float', default: 25 },
      { name: 'bladeN', caption: 'number of fins', type: 'int', default: 3 },

      { name: 'tube_thickness', caption: 'tube thickness', type: 'float', default: 1 },
      { name: 'fin_unit_height', caption: 'fin unit height', type: 'float', default: 40 },
      { name: 'fin_height', caption: 'fin height', type: 'float', default: 50 },
      { name: 'fin_length', caption: 'fin length', type: 'float', default: 60 },

    ];
  }

function tube(height, d, t) {
  return difference(cylinder({r: d/2, h: height, fn:80})
    , cylinder({r: d/2-t, h: height+2, fn:80}).translate([0,0,-1]));
}

function fin(height, length, angle, thickness) {
  var path = new CSG.Path2D([ [-0.2,0], [-0.2,height], [length, height/2], [length, 0] ], true);
  var bl = linear_extrude({height: thickness}, path.innerToCAG());
  bl = bl.rotateX(90);
  return bl;
}

function fins(n, height, length, angle, thickness, radius, offz) {
  var res = [];
  var da = 360.0/n;   
    for (var i=0; i < n; i++)
    {
        var blade = fin(height, length,15, thickness*2);
        blade = blade.translate([radius,thickness/2,offz]);
        blade = blade.rotateZ(i*da);
        res[i] = blade;
    }
  return union(res);
}

function fin_unit(h, d, t) {
  var res = union(tube(h, d, t), tube(h+d/4, d-t*2, t).translate([0,0,0]));
  return res;
}

function ogiverho(r,l) {
  return (r*r+l*l)/(2*r);
}
function ogivey(rho,x,r,l) {
  return sqrt(rho*rho-pow(l-x,2))+r-rho;
}
function nosex0(r,l,rho,rn) {
  return l-sqrt(pow(rho-rn,2)-pow(rho-r,2));
}
function noseyt(rn,rho,r) {
  return rn*(rho-r)/(rho-rn);
}
function nosext(x0,rn,yt) {
  return x0-sqrt(rn*rn-yt*yt);
}

function cone(dia, height, tube_thick) {

     
     r = dia/2-1;
  rho = ogiverho(r,height);

     var curvedpath = new CSG.Path2D.arc({
  center: [r-rho,0,0],
  radius: rho,
  startangle: asin(height/rho)*180/acos(-1),
  endangle: 0,
  resolution: 256
});

curvedpath.points.push(new CSG.Vector2D(dia/2-tube_thick*2,0));
curvedpath.points.push(new CSG.Vector2D(dia/2-tube_thick*2,-10));
curvedpath.points.push(new CSG.Vector2D(2.5,-10));


//console.log(curvedpath);

//return curvedpath.expandToCAG(0.5);

var res = rotate_extrude({fn:40}, 
    curvedpath.expandToCAG(1));
    return res;
}

function engine_mount(dia, height, thickness, outer_dia) {
    var res = []
    res.push(tube(height, dia+thickness*2, thickness));
    res.push(tube(thickness*2, dia+thickness*2, thickness*2).translate([0,0,height]));
    res.push(tube(height/2, outer_dia, (outer_dia-dia)/2).translate([0,0,height/4]));
    
    return union(res);
}

function main(p)
{

  var group=[];

/*
    var _t = tube(p.tube_height, p.tube_dia, p.tube_thickness);
    group.push(_t.translate([0,0,-p.tube_height/3*2]));
  */
  group.push(fin_unit(p.fin_unit_height, p.tube_dia, p.tube_thickness).translate([0,0,-p.fin_unit_height]));
  
  group.push(fins(p.bladeN,p.fin_height, p.fin_length, 15, p.tube_thickness, p.tube_dia/2, -p.fin_unit_height));

var eng_d = 18;
var eng_h = 55;
//group.push(tube( eng_h, eng_d, 1).translate([0,0,-25]));
group.push(engine_mount( eng_d, eng_h, 1, p.tube_dia-p.tube_thickness*2).translate([0,0,-p.fin_unit_height]));
  
  var hole = [];
    
    var n = 3;
    var da = 360/n;
    for (var i=0; i < n; i++)
    {
        hole.push(cylinder({r:0.75, h: 4}).rotateX(90).translate([0,eng_d/2+2,eng_h+0.75-p.fin_unit_height]).rotateZ(i * da));
        hole.push(cylinder({r:0.75, h: eng_h+4}).translate([0,eng_d/2+1.5,-2-p.fin_unit_height]).rotateZ(i*da)); 
        hole.push(cube({size:[1.5,1.5,15]}).rotateX(5).translate([-0.75,eng_d/2+1.75,-2-p.fin_unit_height]).rotateZ(i*da));
    
    }
    
  var res = difference(union(group), union(hole));
  
  
  return res;
}
