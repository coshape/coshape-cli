// title: Fridge Handle
// (c) 2017 coshape.is, Andreas Fuchs
// Here we define the user editable parameters: 

function getParameterDefinitions() {
    return [
      
{ name: 'handleL', caption: 'Handle Length:', type: 'float', default: 180 },
 { name: 'handleW', caption: 'Handle Width:', type: 'float', default: 10 },
      { name: 'handleH', caption: 'Handle Height:', type: 'float', default: 25 },
      
      { name: 'holeD', caption: 'Hole Diameter:', type: 'float', default: 4 },
{ name: 'holeDist', caption: 'Hole Distance:', type: 'float', default: 160 },

      { name: 'padW', caption: 'Pad Width:', type: 'float', default: 20 },
      { name: 'handleDist', caption: 'Handle Clearance:', type: 'float', default: 25 },
      { name: 'padT', caption: 'Pad Thickness:', type: 'float', default: 3 },

    ];
  }

function main(p) {
    
    var holeDist = p.holeDist; //100;
    var holeD = p.holeD; //4;
    var padW  = p.padW; //20;
    var handleDist = p.handleDist; //30;
    var padT  = p.padT; //5;
    var handleW = p.handleW; //20;
    var handleH = p.handleH;
    var handleL = p.handleL; //120;
    
    var handle = getHandle(handleL,handleH, handleW, handleW/8, handleW/2); //cube([handleL, handleW, handleW], center = false).translate([-handleL/2,0,0]);
    handle = handle.translate([-handleL/2,0,0]);
    var padLeft = cube([padW, handleW/2, handleW+handleDist+padW], center = false).translate([-holeDist/2-padW/2, 0,0]);
    var padRight = cube([padW, handleW/2, handleW+handleDist+padW], center = false).translate([holeDist/2-padW/2, 0,0]);
    var pad = cube([holeDist+padW, padT,padW], center = false).translate([-holeDist/2-padW/2,0,handleW+handleDist]);
    
    var base = union(handle, union(padLeft, padRight));
    var base = union(base, pad);
    var holeLeft = cylinder({r:holeD, h: padT + 2}).rotateX(-90).translate([-holeDist/2,-1,handleW+handleDist+padW/2]);
    var holeRight = cylinder({r:holeD, h: padT + 2}).rotateX(-90).translate([holeDist/2,-1,handleW+handleDist+padW/2]);
    var holes = union(holeLeft, holeRight);
    res = difference(base, holes);
    var mount = cube([holeDist+padW, padW/2+padT, padT], center = false).translate([-holeDist/2-padW/2,0,handleW + handleDist - padT]);
    res = union(res, mount);
    var cutoff = cube([holeDist+padW, padW/2+padT, padW]).translate([-holeDist/2-padW/2,padT,handleW+handleDist]);
    res = difference(res, cutoff);
    res = res.rotateX(90);
    
   return res;
}

function getHandle(l,w,height, rad, rad2)
{
    var handle = cube([l, w, height], center = false);
    var cutoff = cube([l, rad, rad], center = false).translate([0,w-rad, height-rad]);
    var res = difference(handle, cutoff);
    cutoff = cube([l, rad2, rad2], center = false).translate([0,w-rad2, 0]);
    res = difference(res, cutoff);
    var rounding = cylinder({r:rad, h:l}).rotateY(90).translate([0,w-rad, height-rad]);
    res = union(res, rounding);
    rounding = cylinder({r:rad2, h:l}).rotateY(90).translate([0,w-rad2, rad2]);
    return union(res, rounding);
}
