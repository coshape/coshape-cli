// author: Andreas Fuchs, coshape

var XMOD = XMOD || {};

XMOD.importer = {
    convertThreeToRaw: function(vertices, _faces) {
        var v = [];
        var faces = [];

        var triangles = _faces.length;
        var verts = vertices.length;
        for (var i=0; i<verts; i++) {
            v.push(
                [
                    vertices[i]["x"],
                    vertices[i]["y"],
                    vertices[i]["z"]
                ]
            );
        }

        for (var i=0; i<triangles; i++) {
            faces.push([ _faces[i]["a"],_faces[i]["b"],_faces[i]["c"] ]);
        }

        return [v, faces];
    },

    importRaw: function (vertices, faces) {
        var geo = new THREE.Geometry();
        var triangles = faces.length;
        var verts = vertices.length;
        for (var i=0; i<verts; i++) {
            geo.vertices.push(
                new THREE.Vector3(
                    vertices[i][0],
                    vertices[i][1],
                    vertices[i][2]
                )
            );
        }

        for (var i=0; i<triangles; i++) {
            var normal = new THREE.Vector3(
                1,
                0,
                0
            );
            geo.faces.push(new THREE.Face3(faces[i][0],faces[i][1],faces[i][2], normal));
        }
        /*
        for (var i = 0; i < triangles; i++) {
            var normal = new THREE.Vector3(
                1,
                0,
                0
            );
            for (var j = 0; j < 3; j++) {
                geo.vertices.push(
                    new THREE.Vector3(
                        dv.getFloat32(offset, isLittleEndian),
                        dv.getFloat32(offset+4, isLittleEndian),
                        dv.getFloat32(offset+8, isLittleEndian)
                    )
                );
                offset += 12
            }
            offset += 2;   
            geo.faces.push(new THREE.Face3(i*3, i*3+1, i*3+2, normal));
        }
        */
        geo.computeFaceNormals();
        return geo;
    },
    b64toArrayBuffer : function(base64_string) {
        return Uint8Array.from(atob(base64_string), function(c) {return c.charCodeAt(0);}).buffer;
    },
    b64toBlob: function(b64Data, contentType, sliceSize) {
      contentType = contentType || '';
      sliceSize = sliceSize || 512;

      var byteCharacters = atob(b64Data);
      var byteArrays = [];

      for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        var slice = byteCharacters.slice(offset, offset + sliceSize);

        var byteNumbers = new Array(slice.length);
        for (var i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }

        var byteArray = new Uint8Array(byteNumbers);

        byteArrays.push(byteArray);
      }

      var blob = new Blob(byteArrays, {type: contentType});
      return blob;
    }
    ,
	importBinaryStl: function(stl, material) {
		var geo = new THREE.Geometry();
        var dv = new DataView(stl, 80); // 80 == unused header
        var isLittleEndian = true;
        var triangles = dv.getUint32(0, isLittleEndian); 
        var offset = 4;
        for (var i = 0; i < triangles; i++) {
            var normal = new THREE.Vector3(
                dv.getFloat32(offset, isLittleEndian),
                dv.getFloat32(offset+4, isLittleEndian),
                dv.getFloat32(offset+8, isLittleEndian)
            );
            offset += 12;
            for (var j = 0; j < 3; j++) {
                geo.vertices.push(
                    new THREE.Vector3(
                        dv.getFloat32(offset, isLittleEndian),
                        dv.getFloat32(offset+4, isLittleEndian),
                        dv.getFloat32(offset+8, isLittleEndian)
                    )
                );
                offset += 12
            }
            offset += 2;   
            geo.faces.push(new THREE.Face3(i*3, i*3+1, i*3+2, normal));
        }
        geo.computeFaceNormals();
        stl = null;
        return new THREE.Mesh( geo, material);
	},
    CreateBinarySTLGeo: function(stl) {
        var geo = new THREE.Geometry();
        var dv = new DataView(stl, 80); // 80 == unused header
        var isLittleEndian = true;
        var triangles = dv.getUint32(0, isLittleEndian); 
        var offset = 4;
        for (var i = 0; i < triangles; i++) {
            var normal = new THREE.Vector3(
                dv.getFloat32(offset, isLittleEndian),
                dv.getFloat32(offset+4, isLittleEndian),
                dv.getFloat32(offset+8, isLittleEndian)
            );
            offset += 12;
            for (var j = 0; j < 3; j++) {
                geo.vertices.push(
                    new THREE.Vector3(
                        dv.getFloat32(offset, isLittleEndian),
                        dv.getFloat32(offset+4, isLittleEndian),
                        dv.getFloat32(offset+8, isLittleEndian)
                    )
                );
                offset += 12
            }
            offset += 2;   
            geo.faces.push(new THREE.Face3(i*3, i*3+1, i*3+2, normal));
        }
        geo.computeFaceNormals();
        return geo;
    }
}