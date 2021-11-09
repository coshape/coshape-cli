//
// (c) 2017 andreas@coshape.com
//

function getParameterDefinitions() {
    return [
      { name: 'width', caption: 'width', type: 'float', default: 60 },
      { name: 'height', caption: 'height', type: 'float', default: 60 },
      { name: 'thickness', caption: 'thickness', type: 'float', default: 3 },

      { name: 'teeth_count_left', caption: 'teeths left', type: 'int', default: 6 },
      { name: 'teeth_count_top', caption: 'teeths top', type: 'int', default: 6 },
      { name: 'teeth_count_right', caption: 'teeths right', type: 'int', default: 6 },
      { name: 'teeth_count_bottom', caption: 'teeths bottom', type: 'int', default: 6 },

      { name: 'teeth_depth_left', caption: 'depth left', type: 'float', default: 3 },
      { name: 'teeth_depth_top', caption: 'depth top', type: 'float', default: 3 },
      { name: 'teeth_depth_right', caption: 'depth right', type: 'float', default: 3 },
      { name: 'teeth_depth_bottom', caption: 'depth bottom', type: 'float', default: 3},

      { name: 'teeth_offset_left', caption: 'offset left', type: 'float', default: 0 },
      { name: 'teeth_offset_top', caption: 'offset top', type: 'float', default: 0 },
      { name: 'teeth_offset_right', caption: 'offset right', type: 'float', default: 0 },
      { name: 'teeth_offset_bottom', caption: 'offset bottom', type: 'float', default: 0},
    ];

}

function create_teeth_path(from, to, teeth_count, teeth_depth, offset) {
    var dx = (to[0] - from[0]) / (teeth_count * 2.0);
    var dy = (to[1] - from[1]) / (teeth_count * 2.0);

    var dl = Math.sqrt(dx*dx+dy*dy);
    var dtx = dy / dl * teeth_depth;
    var dty = dx / dl * teeth_depth;

    var c = teeth_count-1;
    var path = new CSG.Path2D();
    var x,y;
    var ev;
    var i=0;

    from[0] += offset[0]
    from[1] += offset[1]
    to[0] += offset[0]
    to[1] += offset[1]

    var ox = from[0] + dx*0.5;
    var oy = from[1] + dy*0.5;

    path = path.appendPoint([from[0], from[1]]);

    for (; i<c; i++) {
        x = ox + dx*i*2;
        y = oy + dy*i*2;
        path = path.appendPoint([x,y]);

        x = ox + dx*(i*2+1);
        y = oy + dy*(i*2+1);
        path = path.appendPoint([x,y]);

        x+= dtx;
        y+= dty;
        path = path.appendPoint([x,y]);

        x = ox + dx*(i+1)*2;
        y = oy + dy*(i+1)*2;
        x+= dtx;
        y+= dty;
        path = path.appendPoint([x,y]);
    }

    i = c;

    x = ox + dx*i*2;
    y = oy + dy*i*2;
    path = path.appendPoint([x,y]);

    path = path.appendPoint([to[0], to[1]]);

    return path;
}


function main(params) {

var w2 = params.width * 0.5;
var h2 = params.height * 0.5;

var tcl = params.teeth_count_left;
var tct = params.teeth_count_top;
var tcr = params.teeth_count_right;
var tcb = params.teeth_count_bottom;

var tdl = params.teeth_depth_left;
var tdt = params.teeth_depth_top;
var tdr = params.teeth_depth_right;
var tdb = params.teeth_depth_bottom;

var td = params.thickness;

var tol = params.teeth_offset_left;
var tot = params.teeth_offset_top;
var tor = params.teeth_offset_right;
var tob = params.teeth_offset_bottom;



var path = new CSG.Path2D();

path = path.concat( create_teeth_path([-w2, h2],[w2, h2], tcl, tdl, [0,tot]) );
path = path.concat( create_teeth_path([w2, h2],[w2, -h2], tct, tdt, [tor,0]) );
path = path.concat( create_teeth_path([w2, -h2],[-w2, -h2], tcr, tdr, [0, tob]) );
path = path.concat( create_teeth_path([-w2, -h2],[-w2, h2], tcb, tdb, [tol,0]) );

path = path.close(); // close the path

return path.innerToCAG();
}
