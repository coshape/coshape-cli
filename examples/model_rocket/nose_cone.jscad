// title: model rocket
// (c) 2017 andreas@coshape.com

// Here we define the user editable parameters:
function getParameterDefinitions() {
  return [
    { name: 'tube_height', caption: 'tube height', type: 'float', default: 160 },
    { name: 'cone_height', caption: 'nose cone height', type: 'float', default: 75 },
    { name: 'tube_dia', caption: 'tube diameter', type: 'float', default: 25 },
    { name: 'bladeN', caption: 'number of fins', type: 'int', default: 3 },

    { name: 'tube_thickness', caption: 'tube thickness', type: 'float', default: 1 },
    { name: 'fin_unit_height', caption: 'fin unit height', type: 'float', default: 16 },
    { name: 'fin_height', caption: 'fin height', type: 'float', default: 30 },
    { name: 'fin_length', caption: 'fin length', type: 'float', default: 30 },

  ];
}

// funtions for nose cone profile.
// we use a ogive shape.
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

  // expand 2D path to a 1mm line and rotate it around the central axis to
  // obtain a ogive shell
  var res = rotate_extrude({fn:40},
    curvedpath.expandToCAG(1));

  return res;
}

function main(p)
{
  return cone(p.tube_dia, p.cone_height, p.tube_thickness)
}
