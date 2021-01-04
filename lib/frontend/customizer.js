// author: Andreas Fuchs, coshape
var XMOD = XMOD || {};

XMOD.Customizer = new function() {

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


	this.append_shape = function(
		{
			type="jscad", data, transform_callback, io, material, parameters_callback, use_b64=false, clone_function=null
		}) {

		parameters_callback = parameters_callback || function(io) {return null;}

		if (!!type && !!data) {
			let shape = {data:data, type: type, use_b64:use_b64}

			console.log("append_shape", type)

			generate_shape(shape, function(item) {
				item.transform_callback = transform_callback;
				item.parameters_callback = parameters_callback;
				item.clone_function = clone_function;

				item.mesh.material.color.r = material.color.r;
				item.mesh.material.color.g = material.color.g;
				item.mesh.material.color.b = material.color.b;

				if (material.color.a) {
					item.mesh.material.transparent = true;
					item.mesh.material.opacity = material.color.a;
				}
				
				if (type == "stl") {
					XMOD.Customizer.update_component_shape(item, io);
					// XMOD.modeler.scene.add(item); 
					XMOD.modeler.part_group.add(item);
					XMOD.modeler.sigChanged();
				} else {
					XMOD.Customizer.update_component_shape(item, io);
				}

				XMOD.Customizer.components.push(item);


			});	
		}

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
		if (XMOD.mainview && XMOD.mainview.renderer) {
			return XMOD.mainview.renderer.domElement.toDataURL();
		}
		return "";
	}

	this.update_components = function(io) {
		for (var c of this.components) {
			this.update_component_shape(c, io);
		}
	}

	/// internals
	this.update_component_trans = function(item, io) {
		if (item){
			// var t = this.component_callbacks[item]();
			var t = item.transform_callback(io);
			if (t) {
				//console.log(t);
				item.position.set( t[0], t[1], t[2] );
				// item.rotation.set( t[3], t[4], t[5] );	
				item.rotation.set( t[3]*Math.PI/180, t[4]*Math.PI/180, t[5]*Math.PI/180 );
				item.scale.set( t[6], t[7], t[8] );
			}
		}
	}

	/*
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
						//console.log(t);
						item.position.set( t[0], t[1], t[2] );
						item.rotation.set( t[3]*Math.PI/180, t[4]*Math.PI/180, t[5]*Math.PI/180 );
						item.scale.set( t[6], t[7], t[8] );
					}
					
					XMOD.modeler.sigChanged();
				});
			} else {
				this.update_component_trans(item, io);
			}
		}
	}*/

	this.update_component_shape = function(item, io, modifications) {
		if (item){
			var paras = item.parameters_callback(io, item);
			if (typeof item._local_io !== 'undefined') {
				console.log("my io");
				console.log(item._local_io);
				paras = item.parameters_callback(item._local_io, item);
			}
			// if (item.text_clone_function) {
			// 	item.text_clone_function(item)
			// }
			console.log("component update", item, item.rebuild, paras)

			const component_clone_transform = function(item) {
				if (item.color_cb) {
					var col = item.color_cb(io);
					if (item.mesh.material.color) {
						item.mesh.material.color.r = col.r;
						item.mesh.material.color.g = col.g;
						item.mesh.material.color.b = col.b;
						console.log("refresh COL", col);
					} else {
						console.log("MAT PROBLEM", item.mesh.material);
					}

				}

				// updated instances
				if (item.instances) {
					item.instances.forEach(c => {
						c.update_instanced_mesh();
					});
				}

				
				var t = item.transform_callback(io, true);
				if (item.clone_function) {
					if (item.cloned) {
						for(var i=0; i<item.cloned.length;i++) {
							var cb = item.cloned[i].saferemove;
							if (typeof cb != "undefined") {
								cb(item.cloned[i]);
							}
						}
					}
					item.cloned = [];
					console.log("apply FOO CLONE FUNC", item.clone_function);
					var nx = eval("(io)=>{ return " + item.clone_function.nx + ";}")(io) || 1;
					var ny = eval("(io)=>{ return " + item.clone_function.ny + ";}")(io) || 1;
					var nz = eval("(io)=>{ return " + item.clone_function.nz + ";}")(io) || 1;
					var dx = eval("(io)=>{ return " + item.clone_function.dx + ";}")(io) || 1;
					var dy = eval("(io)=>{ return " + item.clone_function.dy + ";}")(io) || 1;
					var dz = eval("(io)=>{ return " + item.clone_function.dz + ";}")(io) || 1;

					var offxx = eval("(io)=>{ return " + item.clone_function.offxx + ";}")(io) || 0;
					var offxy = eval("(io)=>{ return " + item.clone_function.offxy + ";}")(io) || 0;
					var offxz = eval("(io)=>{ return " + item.clone_function.offxz + ";}")(io) || 0;

					var offyx = eval("(io)=>{ return " + item.clone_function.offyx + ";}")(io) || 0;
					var offyy = eval("(io)=>{ return " + item.clone_function.offyy + ";}")(io) || 0;
					var offyz = eval("(io)=>{ return " + item.clone_function.offyz + ";}")(io) || 0;

					var offzx = eval("(io)=>{ return " + item.clone_function.offzx + ";}")(io) || 0;
					var offzy = eval("(io)=>{ return " + item.clone_function.offzy + ";}")(io) || 0;
					var offzz = eval("(io)=>{ return " + item.clone_function.offzz + ";}")(io) || 0;

					console.log("CL FUNC", nx,ny,nz,dx,dy,dz);
					// var ix,iy,iz;
					for (var ix=0; ix < nx; ix++) {
						for (var iy=0; iy < ny; iy++) {
							for (var iz=0; iz < nz; iz++) {
								if(ix === 0 && iy === 0 && iz === 0) {
									continue;
								}
								var obj =  XMOD.modeler.createMeshNode();
								obj.source = item;
								obj.mesh.geometry = item.mesh.geometry;
								obj.modification = item.modification;
								obj.TRS = t.slice(0);
								obj.TRS[0] += ix * dx;
								obj.TRS[1] += iy * dy;
								obj.TRS[2] += iz * dz;
								obj.__name = item.__name + "-" + ix + "-" + iy + "-" + iz;

								if (ix % 2 !== 0) {
									obj.TRS[0] += offxx;
									obj.TRS[1] += offyx;
									obj.TRS[2] += offzx;
								}
								if (iy % 2 !== 0) {
									obj.TRS[0] += offxy;
									obj.TRS[1] += offyy;
									obj.TRS[2] += offzy;
								}
								if (iz % 2 !== 0) {
									obj.TRS[0] += offxz;
									obj.TRS[1] += offyz;
									obj.TRS[2] += offzz;
								}

								//obj.transform_callback = eval("(io) => { return " + obj.TRS + "}");
								//XMOD.Customizer.update_component_trans(obj, io);

								if (obj.TRS) {
									obj.position.set( obj.TRS[0], obj.TRS[1], obj.TRS[2] );
									// item.rotation.set( t[3], t[4], t[5] );
									obj.rotation.set( obj.TRS[3]*Math.PI/180, obj.TRS[4]*Math.PI/180, obj.TRS[5]*Math.PI/180 );
									obj.scale.set( obj.TRS[6], obj.TRS[7], obj.TRS[8] );
								}
								obj.__obbox = obj.__obbox || new THREE.Box3(); //.setFromObject(chs[i]);
								obj.__obbox.setFromObject(obj);

								// c.obj.mesh.material = item.mesh.material;
								// obj.mesh.material = item.mesh.material.clone;
								//if (XMOD._effect) {
									obj.mesh.material = item.mesh.material.clone();
								//}
								// obj.mesh.material.color.r = item.mesh.material.color.r;
								// obj.mesh.material.color.g = item.mesh.material.color.g;
								// obj.mesh.material.color.b = item.mesh.material.color.b;

								obj._initial_values = {};
								obj._initial_values.position = {x:obj.position.x,y:obj.position.y,z:obj.position.z} ;
								obj._initial_values.rotation = {x:obj.rotation.x,y:obj.rotation.y,z:obj.rotation.z};
								obj._initial_values.scale    = {x:obj.scale.x,y:obj.scale.y,z:obj.scale.z};


								var was_deleted = false;
								console.log("MODS", modifications);
								if (modifications) {
									var m = modifications[obj.__name];
									if (m) {
										console.log("MOD found", m, obj.__name);
										if (m.t) {
											obj.position.x += m.t[0];
											obj.position.y += m.t[1];
											obj.position.z += m.t[2];
										}
										if (m.r) {
											obj.rotation.x += m.r[0];
											obj.rotation.y += m.r[1];
											obj.rotation.z += m.r[2];
										}
										if (m.s) {
											obj.scale.x += m.s[0];
											obj.scale.y += m.s[1];
											obj.scale.z += m.s[2];
										}
										if (m.deleted) {
											was_deleted = true;
										}
									}
								}

								/// HACK HACK
								// var text = obj.__name
								// // text, transform_callback, io, material, parameters_callback
								// text = String((ix+1)*(iy+1)*(iz+1))
								// XMOD.Customizer.append_text_node(text, ()=>{ return [obj.position.x-15,obj.position.y,1, 0,0,0, 1,1,1] }, io, null, (io)=>{return {size:10}})
								/// HACK HACK END


								if (!was_deleted) {
									//XMOD.modeler.scene.add(obj);
									XMOD.modeler.part_group.add(obj);
									//item.sub_components.push(c);
									console.log("ADD FC CLONE", obj.TRS);
								} else {
									obj._deleted = true;
								}


								item.cloned.push(obj);

							}
						}
					}

				}
				console.log("TRS update");
				item.transform_callback(io);
				if (t) {
					console.log(t);
					item.position.set( t[0], t[1], t[2] );
					item.rotation.set( t[3]*Math.PI/180, t[4]*Math.PI/180, t[5]*Math.PI/180 );
					item.scale.set( t[6], t[7], t[8] );

					// item.rotateX(t[3]);
					// item.rotateY(t[4]);
					// item.rotateZ(t[5]);

				}
				item._initial_values = {};
				item._initial_values.position = {x:item.position.x,y:item.position.y,z:item.position.z} ;
				item._initial_values.rotation = {x:item.rotation.x,y:item.rotation.y,z:item.rotation.z};
				item._initial_values.scale    = {x:item.scale.x,y:item.scale.y,z:item.scale.z};
				item._deleted = false;

				if (modifications) {
					var m = modifications[item.__name];
					if (m) {
						if (m.t) {
							item.position.x += m.t[0];
							item.position.y += m.t[1];
							item.position.z += m.t[2];
						}
						if (m.r) {
							item.rotation.x += m.r[0];
							item.rotation.y += m.r[1];
							item.rotation.z += m.r[2];
						}
						if (m.s) {
							item.scale.x += m.s[0];
							item.scale.y += m.s[1];
							item.scale.z += m.s[2];
						}
						if (m.deleted) {
							var cb = item.saferemove;
							if (cb) {
								cb(item);
							}
							item._deleted = true;
						}

					}
				}

				item.__obbox = item.__obbox || new THREE.Box3(); //.setFromObject(chs[i]);
				item.__obbox.setFromObject(item);

				XMOD.modeler.sigChanged();
			}

			if (paras) {
				// dynamic geometries
				console.log("customizer.js paras");
				console.log(paras);

				item._par = {};
				for (c of item.parameters.controls) {
					var val = paras[c.name];
					if (val) {
						c.value = val;
						item._par[c.name] = val;
					}
				}
				item.rebuild(false, function() {
					component_clone_transform(item)
				});
			} else {
				// static geometries
				component_clone_transform(item);
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

		res_callback(res);
		return res;
	}

	this.modify_selected_mesh = function() {
		// var res = [];
		// return res;
		console.log("mod mesh");
		var sel = XMOD.modeler.SELECTED;
		if (sel) {
			// console.log(sel.mesh);
			// console.log(sel.mesh.geometry);
			// console.log(sel.mesh.geometry.vertices);
			// console.log(sel.mesh.geometry.faces);


			var item = XMOD.modeler.createMeshNode();
			var v = sel.mesh.geometry.vertices;
			var f = sel.mesh.geometry.faces;
			var three_raw = XMOD.importer.convertThreeToRaw(v,f);

			//console.log("before collapse");
			//console.log(three_raw);
			// var raw = collapse_mesh(three_raw[0], three_raw[1]);
			var raw = window.weld(three_raw[0], three_raw[1]);

			//console.log("after collapse");
			//console.log(raw);
			var res = window.wireframe(raw[0], raw[1], 0.5);

			raw = window.triangulate(res[0], res[1]);
			// res = window.subdivide(raw[0], raw[1]);

			item.mesh.geometry = XMOD.importer.importRaw(raw[0], raw[1]);

			// XMOD.modeler.scene.add(item); 
			XMOD.modeler.part_group.add(item);
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

	this.autozoom = function() {
		// XMOD.mainview.autoZoomScene();
	}

	function generate_shape(shape, callback) {

		if (shape && shape.type && XMOD.modeler) {
			if (shape.type == "jscad") {
				XMOD.modeler.createBody(shape.data, callback)
			} else if (shape.type == "stl") {
				var stl = shape.use_b64 ? XMOD.importer.b64toArrayBuffer(shape.data) : shape.data;
				var item = XMOD.modeler.createMeshNode();
				item.mesh.geometry = XMOD.importer.CreateBinarySTLGeo(stl);
				callback(item);
			}
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
