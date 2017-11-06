// 3D rendering of modeling project
// author: fuchs.and@gmx.de

var XMOD = XMOD || {};

// single main view object for now
XMOD.mainview = {
	modeler: {update: function(){}, SELECTED: null},
	container: null,
	camera: null,
	scene: null,
	renderer: null,
	controls: null,
	width: window.innerWidth,
	height: window.innerHeight,
	raycaster: null,
	mouse: new THREE.Vector2(),
	backColor: 0Xe0e0e0,
	//usePopover: true,
	maximized: true,
	toolboxVisible: true,
	viewsVisible: true,
	editorVisible: false,
	parametersVisible: false,
	mouseClickPos: new THREE.Vector2(),
	allowSelection:true,

	init: function(containerId, allowZoom = true, allowSelection = true) {
		thisview = this;
		this.allowSelection = allowSelection;
		this.container = document.getElementById( containerId );
		this.width =  this.container.offsetWidth;
		this.height = this.container.offsetHeight;
		this.camera = new THREE.PerspectiveCamera( 35, this.width / this.height, 0.1, 10000 );
		
		//this.camera = new THREE.CinematicCamera( 35, this.width / this.height, 0.1, 3500 );
		//this.camera.setLens(5);
        //camera.position.set(2, 1, 500);


		this.camera.position.set( 600, 100, 200 );
		this.camera.up.x=0;
		this.camera.up.y=0;
		this.camera.up.z=1;

		console.log(this.camera);

		this.controls = new THREE.OrbitControls(this.camera, this.container);
		this.controls.enableDamping = false;
		this.controls.dampingFactor = 0.25;

		// to disable zoom
		this.controls.enableZoom = allowZoom;
		// to disable pan
		this.controls.enablePan = allowZoom;

		//this.scene = new THREE.Scene();
		this.raycaster = new THREE.Raycaster();

		var renderer = new THREE.WebGLRenderer({
			antialias: true , 
			alpha: true,
			preserveDrawingBuffer: true
		});
		//renderer.setClearColor( this.backColor );

		console.log(this.container);
		console.log(this.width + " " + this.height);

		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( this.width, this.height );
		renderer.gammaInput = true;
		renderer.gammaOutput = true;
		renderer.shadowMap.enabled = this.showShadows;
		renderer.shadowMap.Soft = this.showShadows;
		renderer.shadowMap.cullface = THREE.CullFaceBack;

		this.container.appendChild( renderer.domElement );
		this.renderer = renderer;

		if (allowSelection) {
			this.container.addEventListener( 'mousemove', this.onDocumentMouseMove, false );
		}
		
		//window.addEventListener( 'mousemove', this.onDocumentMouseMove, false );
		this.container.addEventListener( 'mouseup', this.onDocumentMouseUp, false );
		this.container.addEventListener( 'mousedown', this.onDocumentMouseDown, false );
		window.addEventListener( 'resize', this.onWindowResize, false );
		this.controls.addEventListener( 'change', this.onChange );

		//this.render();
		//this.onWindowResize();
	},

	/* ynfiny */

	attachModeler: function(modeler) {
		this.modeler = modeler;
		// todo: find nicer way to connect signals with slots
		this.modeler.sigChanged = this.onChange;
		//this.modeler.sigItemSelected = this.onShowProperies;
		this.modeler.sigItemSelected = function() {
			thisview.onShowProperies(modeler.SELECTED, modeler.Selection);
		};
		//this.modeler.sigItemTooltip = this.onShowProperies;
		//this.modeler.sigItemTooltipEmpty = this.onHideProperties; //this.onEmptySelection;

		//this.modeler.sigItemSelected = this.onShowTransformation;
		this.modeler.sigEmptySelection = this.onEmptySelection;

		this.modeler.control = new THREE.TransformControls( this.camera, this.renderer.domElement );
		this.modeler.scene.add(this.modeler.control);
		this.modeler.control.addEventListener( 'change', this.modeler.onControlChanged );
		
		this.scene = this.modeler.scene; //getScene();
		//this.onWindowResize();
	},

	autoZoomScene: function() {
		var correctForDepth = 1.1;
        // create an helper
        var helper = new THREE.BoundingBoxHelper(this.modeler.scene);
        helper.update();
        // get the bounding sphere
        var boundingSphere = helper.box.getBoundingSphere();
        // calculate the distance from the center of the sphere
        // and subtract the radius to get the real distance.
        var center = boundingSphere.center;
        var radius = boundingSphere.radius;
        var distance = center.distanceTo(this.camera.position) - radius;
        var realHeight = Math.abs(helper.box.max.y - helper.box.min.y);
        var fov = 2 * Math.atan(realHeight * correctForDepth / ( 2 * distance )) * ( 180 / Math.PI );
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
        this.onChange();
	},

	render: function() {
		this.modeler.update();
		/*
		if (this.modeler.SELECTED) {
			if (this.parametersVisible) {
				var pos2d = this.toScreenPosition(this.modeler.SELECTED, this.camera, this.width, this.height);
				$('#mod-pop').css("left", pos2d.x-250  + "px");
				$('#mod-pop').css("top", pos2d.y-75 + "px");
			}
		} else if (this.modeler.INTERSECTED) {
			if (this.parametersVisible) {
				var pos2d = this.toScreenPosition(this.modeler.INTERSECTED, this.camera, this.width, this.height);
				$('#mod-pop').css("left", pos2d.x-250  + "px");
				$('#mod-pop').css("top", pos2d.y-75 + "px");
			}
		}
		*/
		this.renderer.render( this.scene, this.camera );
	},

	hideViews: function() {
		/*
		if (thisview.viewsVisible) {
			thisview.viewsVisible = false;
			$('#edit').hide();
			$('#jseditor').hide();
			//$('#toolbox').hide();
		}
		*/
	},

	showViews: function() {
		/*
		if (!thisview.viewsVisible) {
			thisview.viewsVisible = true;
			if (thisview.parametersVisible)
				$('#edit').show();
			if (thisview.editorVisible)
				$('#jseditor').show();
			//if (thisview.toolboxVisible && !thisview.parametersVisible)
			//	$('#toolbox').show();
		}
		*/
	},

	onChange: function() {
		// use 'thisview' to reference view object in callbacks
		// thisview.render();
		//thisview.onWindowResize();
		thisview.render();
	},

	onWindowResize: function() {
		// use 'thisview' to reference view object in callbacks

		// thisview.width =  window.innerWidth;
		// thisview.height = window.innerHeight;
		thisview.width =  thisview.container.offsetWidth;
		thisview.height = thisview.container.offsetHeight;

		thisview.camera.aspect = thisview.width / thisview.height;
		thisview.camera.updateProjectionMatrix();
		thisview.renderer.setSize( thisview.width, thisview.height );
		thisview.render();
	},

	onDocumentMouseUp: function(event) {
		// use 'thisview' to reference view object in callbacks
		if (event.clientX == thisview.mouseClickPos.x
			&& event.clientY == thisview.mouseClickPos.y) {
			thisview.modeler.testSelection();
		}
		thisview.showViews();
	},

	onDocumentMouseDown: function(event) {
		// use 'thisview' to reference view object in callbacks
		thisview.mouseClickPos.x = event.clientX;
		thisview.mouseClickPos.y = event.clientY;
	},

	onDocumentMouseMove: function(event) {
		// use 'thisview' to reference view object in callbacks
		//thisview.render();
		thisview.width = window.innerWidth;
		thisview.height = window.innerHeight;
		thisview.mouse.x = ( event.layerX / thisview.width ) * 2 - 1;
		thisview.mouse.y = - ( event.layerY / thisview.height) * 2 + 1;
		thisview.raycaster.setFromCamera( thisview.mouse, thisview.camera );
		thisview.modeler.testIntersection(thisview.raycaster);
		if (event.buttons) {
			thisview.hideViews();
		} else {
			thisview.showViews();
		}
	},

	onShowTransformation: function() {
		$('#transform').show();
		$('#edit').show();
	},

	/*
	gui: google DAT gui object
	container: generic composite
	controls: parameter controls composite

	var controls = {caption:"name", children:[], value:null}
	*/
	createParameterControls: function(gui, container, control) {
		// walk composite tree
		if (control) {
            console.log(control);
			var kids = control.children;
			if (kids && kids.length>0) {
				var folder = gui.addFolder(control.caption);
				var sub = container[control.caption] = {};
				for (var i = 0; i < kids.length; i++) {
					this.createParameterControls(folder, sub, kids[i]);
				}
			} else {
				container[control.caption] = control.value;
				// var p = gui.add(container, control.caption, control.value*0.333, control.value*3.0);
				var p = gui.add(container, control.caption, control.value*0.333, (control.value+1)*3.0);

				p.ref = control;
				//console.log("p");
				//console.log(p);
				p.onFinishChange(function(value) {
					// console.log(this);
					// console.log("value changed" + value);
					this.ref.value = value;
					if (thisview.allowSelection) {
						thisview.modeler.SELECTED.rebuild(false);
					} else {
						console.log("update view");
						thisview.modeler.SELECTED.rebuild(false, function(){thisview.autoZoomScene();});
					}
				});
			}
		}
	},

	onShowProperies: function(selected, selection) {

		var container = {}; 

		if (this.allowSelection) {
			container.Name = "object 1";
			container.Duplicate = function() {};
		 	container.Delete = function() {};
		 	container.Code = function() {
		  		thisview.onShowCode();
		  	};
		} 
		container.Parameters= [];
		container['Lock Group']= false;
		container.Enum = {"moin":"bar"};

		
		var gui = new dat.GUI({ autoPlace: false });
		var selCount = Object.keys(selection).length;
		// console.log(this.Selection);
		// console.log(selCount);

		if (selCount>1) {
			var sel = gui.addFolder('Group');
			//sel.add(container, 'Lock Group');
			for (var key in selection) {
				var con = container[key] = {
					Name: "object 1",
					Duplicate: function() {},
				 	Delete: function() {},
				 	Code: function() {
				  		thisview.onShowCode();
				  	},
				  	Parameters: []
				};
				var sub = sel.addFolder(key);
				sub.add(con, 'Name');
				//var mod = sub.addFolder('Edit');
				//mod.add(con, 'Duplicate');
				//mod.add(con, 'Delete');
				//mod.add(con, 'Code');
				var paras = sub.addFolder('Parameters');
				var parCtrls = selection[key].parameters.controls;
		        for (var i = 0; i < parCtrls.length; i++) {
		            var ctrl = parCtrls[i];
		    		thisview.createParameterControls(paras, con, ctrl);
		        }
			}
			sel.open();
		} else {
			if (this.allowSelection) {
				gui.add(container, 'Name');
				//var mod = gui.addFolder('Edit');
				//mod.add(container, 'Duplicate');
				//mod.add(container, 'Delete');
				//mod.add(container, 'Code');
				gui.add(container, 'Enum');
			}

			// file open dialog
			//gui.add(container, 'fileopen');

			var paras = gui.addFolder('Parameters');
			var parCtrls = selected.parameters.controls;

	        for (var i = 0; i < parCtrls.length; i++) {
	            var ctrl = parCtrls[i];
	    		thisview.createParameterControls(paras, container, ctrl);
	        }

			paras.open();
		}

		
		$("#mydatgui").empty();
		$("#mydatgui").append( gui.domElement );
		$(".close-button").hide();

		$('#edit').show();
    	$('#transform').show();
    	$('#downloadButton').show();


		thisview.parametersVisible = true;

		/*
		if (jseditor) {
			var code = selected.code;
			if (code) {
				jseditor.setValue(code);			
			} else {
				jseditor.setValue("");
			}
		}
		*/
	},

	onHideProperties: function() {
		$('#edit').hide();
		/*
		if (jseditor) {
			jseditor.setValue("");
		}
		*/
		thisview.parametersVisible = false;
	},

	onEmptySelection: function() {
		thisview.onHideProperties();
    	$('#transform').hide();
    	$('#edit').hide();
    	$('#downloadButton').hide();
		thisview.editorVisible = false;
	},

	onTriggerMinMaxProperties: function() {
		if (this.maximized) {
			this.maximized = false;
			$('#btnminmax').html("&#9660;");
			//$('#mod-pop').css("height", "40px");
			$('#mod-pop').css("overflow", "hidden");
		} else {
			this.maximized = true;
			$('#btnminmax').html("&#9650;");
			//$('#mod-pop').css("height", "150px");
			$('#mod-pop').css("overflow", "visible");
		}
	},

	onShowCode: function() {
		$('#jseditor').show();
		thisview.editorVisible = true;
	},

	onHideCode: function() {
	    $('#jseditor').hide();
		thisview.editorVisible = false;
	},

	onUpload: function(event) {
		var input = event.target;
	    var reader = new FileReader();
	    reader.onload = function(e){
	    	console.log(e.target);
			var material = new THREE.MeshPhongMaterial( { color: 0Xf06000, specular: 0x111111, shininess: 200, emissive:0x000000 } );
	    	// fix the mesh object! -> use modeler
	    	var node = XMOD.modeler.createMeshNode()

	    	var mesh = XMOD.importer.importBinaryStl(e.target.result, material);
	    	//thisview.modeler.scene.add(mesh);
	    	node.mesh.geometry = mesh.geometry;
	    	node.update();

	    	thisview.render();
	    };
	    reader.readAsArrayBuffer(input.files[0])
	},

	onUseTranslation: function() {
		thisview.modeler.control.setMode( "translate" );
		thisview.modeler.scene.add(thisview.modeler.control);
	},

	onUseRotation: function() {
		thisview.modeler.control.setMode( "rotate" );
		thisview.modeler.scene.add(thisview.modeler.control);
	},

	onUseScale: function(){
		thisview.modeler.control.setMode( "scale" );
		thisview.modeler.scene.add(thisview.modeler.control);
	},

	toScreenPosition: function(obj, camera, width, height) {
		var vector = new THREE.Vector3();
	    var widthHalf = 0.5*width;
	    var heightHalf = 0.5*height;
	    obj.updateMatrixWorld();
	    vector.setFromMatrixPosition(obj.matrixWorld);
	    vector.z += 10;
	    vector.project(camera);
	    vector.x = ( vector.x * widthHalf ) + widthHalf;
	    vector.y = - ( vector.y * heightHalf ) + heightHalf;
	    return vector;
	},

	onAddBody: function() {
		this.toolboxVisible = !this.toolboxVisible;
		if (this.toolboxVisible) {
			if (this.parametersVisible) {
				$('#mod-pop').hide();
			}
			$('#toolbox').show();
		} else {
			if (this.parametersVisible) {
				$('#mod-pop').show();
			}
			$('#toolbox').hide();		
		}
	},

	onExport: function(filename = "awesome.stl") {
		if(window.URL) {
			if (blob = thisview.modeler.exportSelected()) {
				var url = window.URL.createObjectURL(blob);
			    var link = document.getElementById("download");
			    link.href = url;
			   	link.setAttribute("download", filename);
			   	link.click();
			}
		} else {
			console.log("your browser does not support blobs!");
		}
	},

	onDelete: function() {
		thisview.modeler.deleteSelected()
	},

	onDuplicate: function() {
		thisview.modeler.duplicateSelected()
	}

}

