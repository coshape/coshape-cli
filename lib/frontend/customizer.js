var XMOD = XMOD || {};

XMOD.Customizer = new function() {

	//this.component_callbacks = {};
	this.io = {};

	/// public interface
	this.set_shape_code = function (code) {
		if (code) {
			shape_code = code;
			update();
		}
	}

	this.SetRelativeCsgPath = function (path){
		XMOD.modeler.csg_path = path;
	}

	this.append_shape_code = function (code, transform_callback, io, material, parameters_callback) {
		if (code) {
			generate_shape(code, function(item){
				item.transform_callback = transform_callback;
				item.parameters_callback = parameters_callback;
				XMOD.Customizer.update_component_shape(item, io);
				// XMOD.Customizer.update_component_trans(item, io);
				XMOD.Customizer.components.push(item);
				item.mesh.material.color.r = material.color.r;
				item.mesh.material.color.g = material.color.g;
				item.mesh.material.color.b = material.color.b;
			});	
		}
	}

	this.append_shape_stl = function(stl, transform_callback, io, material, use_b64=false) {
		//if (stl != null) {
			//var stl_binary = stl;

			var item = XMOD.modeler.createMeshNode();
			if (use_b64) {
				var _stl = XMOD.importer.b64toArrayBuffer(stl);
				item.mesh.geometry = XMOD.importer.CreateBinarySTLGeo(_stl);
			} else {
				item.mesh.geometry = XMOD.importer.CreateBinarySTLGeo(stl);				
			}
			item.parameters_callback = function(io) {return null;}
			item.transform_callback = transform_callback;
			XMOD.Customizer.update_component_trans(item, io);
			XMOD.Customizer.components.push(item);
			item.mesh.material.color.r = material.color.r;
			item.mesh.material.color.g = material.color.g;
			item.mesh.material.color.b = material.color.b;

			XMOD.modeler.scene.add(item); 
			XMOD.modeler.sigChanged();


			/*
			var geo = XMOD.importer.CreateBinarySTLGeo(stl);
			generate_shape(null, function(item){
				
				// console.log(stl_binary);
				// XMOD.importer.importAndApplyBinaryStl(stl_binary, item.mesh);
				console.log(geo);
				item.mesh.geo = geo;
				item.update();

				item.transform_callback = transform_callback;
				XMOD.Customizer.update_component_trans(item, io);
				XMOD.Customizer.components.push(item);
				item.mesh.material.color.r = material.color.r;
				item.mesh.material.color.g = material.color.g;
				item.mesh.material.color.b = material.color.b;
			});
			*/
		//}
	}

	this.set_parameter = function(parameter_id, value) {
		if (XMOD.modeler.SELECTED) {
			var pars = XMOD.modeler.SELECTED;
			pars.parameters.controls[parameter_id].value = value;
			thisview.modeler.SELECTED.rebuild(false);
		}
	}

	this.download = function(filename) {
		XMOD.mainview.onExport(filename);
	}

	this.image = function() {
		if (XMOD.mainview) {
			return XMOD.mainview.renderer.domElement.toDataURL();
		}
		return "";
	}

	this.update_components = function(io) {
		for (var c of this.components) {
			this.update_component_shape(c, io);
			// this.update_component_trans(c, io);
		}
	    //XMOD.modeler.sigChanged();
	}

	/// internals

	this.update_component_trans = function(item, io) {
		if (item){
			// var t = this.component_callbacks[item]();
			var t = item.transform_callback(io);
			if (t) {
				console.log(t);
				item.position.set( t[0], t[1], t[2] );
				// item.rotation.set( t[3], t[4], t[5] );	
				item.rotation.set( t[3]*Math.PI/180, t[4]*Math.PI/180, t[5]*Math.PI/180 );
				item.scale.set( t[6], t[7], t[8] );
			}
		}
	}

	this.update_component_shape = function(item, io) {
		if (item){
			var paras = item.parameters_callback(io);
			if (paras) {
				//console.log(paras);
				
				for (c of item.parameters.controls) {
					var val = paras[c.name];
					if (val) {
						c.value = val;
					}
				}
				item.rebuild(false, function() {
					
					var t = item.transform_callback(io);
					if (t) {
						console.log(t);
						item.position.set( t[0], t[1], t[2] );
						item.rotation.set( t[3]*Math.PI/180, t[4]*Math.PI/180, t[5]*Math.PI/180 );
						item.scale.set( t[6], t[7], t[8] );

						// item.rotateX(t[3]);
						// item.rotateY(t[4]);	
						// item.rotateZ(t[5]);	

					}
					
					XMOD.modeler.sigChanged();
				});
			} else {
				this.update_component_trans(item, io);
			}
		}
	}

	this.MeshBlobs = function(res_callback) {
		var res = [];
		var i=0;
		var group_2d = [];
		for (var c of this.components) {
			var item = {};
			item.data = XMOD.exporter.exportBinaryStl(c.mesh.geometry);
			item.filename = "part_" + i + "_3D.stl";
			res.push(item);

			var path = c.mesh.group.path_2d;
			if (path && path.length>0) {
				var item = {};
				item.filename = "part_" + i + "_2D.svg";
				item.data = XMOD.exporter.exportSvg(path, "part_" + i);
				res.push(item);
				group_2d.push(path);
			}
			i++;
		}

		if (group_2d.length>1) {
			// reload nest script to avoid errors ...
			$.getScript("/js/svgnest.js", function() {
				var merged_svg = XMOD.exporter.exportSvgMerged(group_2d, function(merged_svg) {
				    var item = {};
					item.filename = "merged_2d.svg";
					item.data = merged_svg;
					res.push(item);
					res_callback(res);
				});
			});
		} else {
			res_callback(res);
		}
		
		
		return res;
	}

	this.modify_selected_mesh = function() {
		// var res = [];
		// return res;
		console.log("mod mesh");
		var sel = XMOD.modeler.SELECTED;
		if (sel) {
			console.log(sel.mesh);
			console.log(sel.mesh.geometry);
			console.log(sel.mesh.geometry.vertices);
			console.log(sel.mesh.geometry.faces);


			var item = XMOD.modeler.createMeshNode();
			var v = sel.mesh.geometry.vertices;
			var f = sel.mesh.geometry.faces;
			var three_raw = XMOD.importer.convertThreeToRaw(v,f);

			console.log("before collapse");
			console.log(three_raw);
			// var raw = collapse_mesh(three_raw[0], three_raw[1]);
			var raw = window.weld(three_raw[0], three_raw[1]);

			console.log("after collapse");
			console.log(raw);
			var res = window.wireframe(raw[0], raw[1], 0.5);

			raw = window.triangulate(res[0], res[1]);
			// res = window.subdivide(raw[0], raw[1]);

			item.mesh.geometry = XMOD.importer.importRaw(raw[0], raw[1]);

			//item.parameters_callback = function(io) {return null;}
			// item.transform_callback = transform_callback;
			//XMOD.Customizer.update_component_trans(item, io);
			// XMOD.Customizer.components.push(item);
			//item.mesh.material.color.r = material.color.r;
			//item.mesh.material.color.g = material.color.g;
			//item.mesh.material.color.b = material.color.b;

			XMOD.modeler.scene.add(item); 
			XMOD.modeler.sigChanged();
		}
	}

	this.import_mesh = function(event) {
		//XMOD.mainview.onUpload(event);
		XMOD.mainview.onUpload(event);
	}

	function collapse_mesh(verts, faces) {
		var res_v, res_f;
		res_v = [];
		res_f = [];

		var vc = verts.length;
		var fc = faces.length;

		var faces_per_vert = [];
		for (var i=0; i<vc; i++) {
			faces_per_vert.push([]);
			res_v.push(verts[i]);
		}

		for (var i=0; i<fc; i++) {
			for (var t=0; t<faces[i].length; t++) {
				faces_per_vert[faces[i][t]].push(i);
			}
			res_f.push(faces[i]);
		}

		for (var i=0; i<vc; i++) {
			var v_l = verts[i];
			for (var j=0; j<vc; j++) {
				if (j != i) {
					var v_r = verts[j];
					if (v_l[0] == v_r[0] && v_l[1] == v_r[1] && v_l[2] == v_r[2]) {
						var vr_faces = faces_per_vert[j]; // list of face ids
						for (var k=0; k<vr_faces.length; k++) {
							var r_faceId = vr_faces[k];
							var r_face = faces[r_faceId];
							for (var t=0; t<r_face.length; t++) {
								if (r_face[t] == j) {
									res_f[r_faceId][t] = i;
								}
							}
						}
					}
				}
			}
		}

		return [res_v, res_f];
	}

	function on_lib_loaded() {
		var all_loaded = true;
		for (var lib of libs_to_load) {
			all_loaded &= libs_state[lib];
			if (!all_loaded) {
				return;
			}
		}
		console.log("all libs loaded.");
		on_libs_loaded();
	}

	function load_lib(lib) {
		var _lib = lib
		$.getScript(_lib, function() {
			console.log("loaded: " + _lib);
			libs_state[_lib] = true;
			on_lib_loaded();
		});
	}

	function on_libs_loaded() {
		init();
	}

	this.init = function(dom_id = "customizer", allowZoom = true, allowSelection = false) {
		XMOD.modeler = new XMOD.CModeler();
		XMOD.modeler.init(allowSelection);

		XMOD.mainview.init(dom_id, allowZoom, allowSelection);
		XMOD.mainview.attachModeler(XMOD.modeler);
		XMOD.modeler.sigChanged();

		_includePath = './';
		me='web-online';
		gMemFs = [];

		is_initialized = true;
		update();
	}

	function update() {
		if (is_initialized && shape_code) {
			console.log("up!");
			generate_shape(shape_code, function(item) {
	            XMOD.modeler.SELECTED = item;
	        	XMOD.modeler.sigItemSelected();
	            XMOD.modeler.sigChanged();
	            // XMOD.mainview.autoZoomScene();
	            // XMOD.mainview.onWindowResize();
	            console.log(item);
	      	});
		}
	}

	function generate_shape(code, callback) {
		if (XMOD.modeler != null) {
			XMOD.modeler.createBody(code, function(item) {
			callback(item);
	   	 });
		}
	}


	// jquery has to be loaded already
	var libs_to_load = [
		"/js/bootstrap.min.js",
		"/js/dat.gui.min.js",
		"/openjscad.js",
		"/csg.js",
		"/js/three.min.js",
		"/js/STLLoader.js",
		"/js/TrackballControls.js",
		"/js/OrbitControls.js",
		"/js/TransformControlls.js",
		"/js/modeling/importer.js",
		"/js/modeling/exporter.js",
		"/js/modeling/view.js",
		"/js/modeling/modeler.js"
	];

	var libs_state = {}
	var shape_code = null;
	var is_initialized = false;
	var jseditor;

	this.components = [];


	// run this to load the modules
	//for (var lib of libs_to_load) {
	//	libs_state[lib] = false;
	//	load_lib(lib);
	//}	

}();
