// author: Andreas Fuchs, coshape

var XMOD = XMOD || {};

XMOD.exporter = {
	exportBinaryStl: function(geometry) {
		// returns blob

		// first check if the host is little-endian:
	    var buffer = new ArrayBuffer(4);
	    var int32buffer = new Int32Array(buffer, 0, 1);
	    var int8buffer = new Int8Array(buffer, 0, 4);
	    int32buffer[0] = 0x11223344;
	    if (int8buffer[0] != 0x44) {
	        throw new Error("Binary STL output is currently only supported on little-endian (Intel) processors");
	    }

	    var numtriangles = geometry.faces.length;
    	var headerarray = new Uint8Array(80);
    	for (var i = 0; i < 80; i++) {
	        headerarray[i] = 65;
	    }
	    var ar1 = new Uint32Array(1);
    	ar1[0] = numtriangles;

    	// write the triangles to allTrianglesBuffer:
	    var allTrianglesBuffer = new ArrayBuffer(50 * numtriangles);
	    var allTrianglesBufferAsInt8 = new Int8Array(allTrianglesBuffer);
	    // a tricky problem is that a Float32Array must be aligned at 4-byte boundaries (at least in certain browsers)
	    // while each triangle takes 50 bytes. Therefore we write each triangle to a temporary buffer, and copy that
	    // into allTrianglesBuffer:
	    var triangleBuffer = new ArrayBuffer(50);
	    var triangleBufferAsInt8 = new Int8Array(triangleBuffer);
	    // each triangle consists of 12 floats:
	    var triangleFloat32array = new Float32Array(triangleBuffer, 0, 12);
	    // and one uint16:
	    var triangleUint16array = new Uint16Array(triangleBuffer, 48, 1);
	    var byteoffset = 0;

	    var numvertices = geometry.vertices.length;

	    for (var i=0; i<numtriangles; i++) {
	    	var face = geometry.faces[i];
	    	//console.log(face);
	    	triangleFloat32array[0] = face.normal.x;
            triangleFloat32array[1] = face.normal.y;
            triangleFloat32array[2] = face.normal.z;
            var k = 3;
            var indices = [face.a, face.b, face.c];
            for (var v = 0; v < 3; v++) {
                var vert = geometry.vertices[indices[v]];
                triangleFloat32array[k++] = vert.x;
                triangleFloat32array[k++] = vert.y;
                triangleFloat32array[k++] = vert.z;
            }

            triangleUint16array[0] = 0;
            // copy the triangle into allTrianglesBuffer:
            allTrianglesBufferAsInt8.set(triangleBufferAsInt8, byteoffset);
            byteoffset += 50;
	    }
	    return new Blob([headerarray.buffer, ar1.buffer, allTrianglesBuffer], {
	        type: "application/sla"
	    });
	},

	bbox : function(path) {
		if (path && path.length>0) {
			var c = path.length;
			var maxx = -Number.MAX_VALUE;
			var maxy = maxx;
			var minx = -maxx;
			var miny = minx;
			for (var i=0; i<c; i++) {
				var line = path[i];
				if (maxx<line[0]) {
					maxx = line[0]
				}
				if (minx>line[0]) {
					minx = line[0]
				}
				if (maxy<line[1]) {
					maxy = line[1]
				}
				if (miny>line[1]) {
					miny = line[1]
				}
			}
			return [minx,miny,maxx,maxy, maxx-minx, maxy-miny];
		}
		return [0,0,0,0];
	},

	exportSvg : function(path, name) {

		// determine bounding box and center shape ...
		var bb = XMOD.exporter.bbox(path);
		//var offset = [0,0]; //[-(bb[2]-bb[0]) * 0.5+width/2, (bb[3]-bb[1]) * 0.5+height/2];

		bb[0] -= 15;
		bb[1] -= 15;
		bb[2] += 15;
		bb[3] += 15;

		var offset = [(bb[2]-bb[0]) * 0.5, (bb[3]-bb[1]) * 0.5];

		var width = bb[2]-bb[0];
		var height = bb[3]-bb[1];

		var head = '<svg width="' + width + 'mm" height="' + height + 'mm" viewBox="0 0 ' + width + ' ' + height + '"><g id="svgGroup" stroke-linecap="round" fill-rule="evenodd" font-size="9pt" stroke="#f00" stroke-width="0" fill="none" style="stroke:#f00;stroke-width:0;fill:none"><path d="';
		var tail = '" vector-effect="non-scaling-stroke"/></g></svg>';


		var c = path.length;
		var data = head;
		for (var i=0; i<c; i++) {
			var line = path[i];
			line[0] += offset[0];
			line[1] += offset[1];
			line[2] += offset[0];
			line[3] += offset[1];

			data += "M " + line[0] + " "+ line[1] + " "+ line[2] + " "+ line[3] + " ";
		}
		data += tail;

		return new Blob(data.split(), {
	        type: "image/svg+xml"
	    });
	},

	exportSvgMerged : function(paths, res_callback) {

		var pc = paths.length;
		var bboxes = []
		var width = 0;
		var height = 0;

		var min_h = 0;
		var min_w = 0;

		var area = 0;

		for (var i=0; i<pc; i++) {
			var bb = XMOD.exporter.bbox(paths[i]);
			bboxes.push(bb);
			width += bb[4];
			height += bb[5];
			area += bb[4] * bb[5];
			if (min_w<bb[4]) {min_w=bb[4];}
			if (min_h<bb[5]) {min_h=bb[5];}
		}

		var sqr_len = Math.sqrt(area);
		if (sqr_len<min_w) {
			width = min_w;
		} else {
			width = sqr_len;
		}
		sqr_len = area / width;
		if (sqr_len<min_h) {
			height = min_h;
		} else {
			height = sqr_len;
		}
		width *= 1.5;
		// height *= 1.5;

		var doc_head = '<svg version="1.1" id="svg2" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + width + 'mm" height="' + height + 'mm" viewBox="0 0 ' + width + ' ' + height + '">';
		var doc_tail = '</svg>';

		var g_head = '<g id="svgGroup" stroke-linecap="round" fill-rule="evenodd" font-size="9pt" stroke="#f00" stroke-width="0.25mm" fill="none" style="stroke:#f00;stroke-width:0.01mm;fill:none"><path d="';
		var g_tail = '" vector-effect="non-scaling-stroke"/></g>';

		var data = doc_head;
		var offset = [0,0];

		data += '<g id="svg_bin_g" stroke-linecap="round" fill-rule="evenodd" font-size="9pt" stroke="#f00" stroke-width="0.25mm" fill="none" style="stroke:#f00;stroke-width:0.01mm;fill:none">'
		data += '<polygon fill="none" stroke="#f00" stroke-width="0.1mm" id="svg_bin" points="';
		data += "" + 0 + "," + 0 + " "
		data += "" + width + "," + 0 + " "
		data += "" + width + "," + height + " "
		data += "" + 0 + "," + height + " "

		data += '" vector-effect="non-scaling-stroke"/></g>';

		for (var e=0; e<pc; e++) {
			var path = paths[e];
			var c = path.length;
			data += '<g id="group_' + e + '" stroke-linecap="round" fill-rule="evenodd" font-size="9pt" stroke="#f00" stroke-width="0.25mm" fill="none" style="stroke:#f00;stroke-width:0.01mm;fill:none">';
			data += '<polygon fill="none" stroke="#f00" stroke-width="0.1mm" points="';
			offset[0] += bboxes[e][4];
			offset[1] += bboxes[e][5];

			for (var i=0; i<c; i++) {
				var line = path[i];
				line[0] += offset[0];
				line[1] += offset[1];
				line[2] += offset[0];
				line[3] += offset[1];
				data += "" + line[0] + "," + line[1] + " ";
			}
			data += '" vector-effect="non-scaling-stroke"/></g>';
		}
		data += doc_tail;

		// optimize
		//var parser = new DOMParser();
		//var svg = parser.parseFromString(data, "image/svg+xml");

		var done = false;
		function progress(percent) {
			console.log("nest progress: " + percent);
		}

		var iterations = 0;

		function renderSvg(svglist, efficiency, numplaced) {
			console.log(efficiency);
			console.log(numplaced);

			if (svglist && svglist.length>0) {
				SvgNest._xmod_svg_result = svglist;
			}

			SvgNest._xmod_iterations += 1;
			if ( SvgNest._xmod_iterations > 40 || efficiency > 0.50) {
				SvgNest.stop();
				done=true;

				if (SvgNest._xmod_svg_result && SvgNest._xmod_svg_result.length>0) {
					xmls = new XMLSerializer();
					var res_svg = SvgNest._xmod_svg_result[0];
					res_svg.getElementById("svg_bin").remove();
					var svg_result = xmls.serializeToString(res_svg);
					console.log("svg nest done!");

					var blob = new Blob(
						svg_result.split()
						, {
				        type: "image/svg+xml"
				    });
					res_callback(blob);
				} else {
					console.log("svg nest failed!");
					// nesting failed ...
					res_callback(null);
				}
			}
		}

		var _svg = SvgNest.parsesvg(data);
		SvgNest.setbin( _svg.getElementById("svg_bin") );
		SvgNest._xmod_iterations = 0;
		SvgNest._xmod_total = pc;

		var err = SvgNest.start(progress, renderSvg);
		if (!err) {
			console.log("svg nest started!");
		} else {
			console.log("svg nest errors!");
			console.log(err);
		}
	}
}