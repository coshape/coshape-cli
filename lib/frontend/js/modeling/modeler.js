// author: Andreas Fuchs, coshape

var XMOD = XMOD || {};

// the controler ...
XMOD.CModeler = function() {
  // use absolute paths, fix this !!!!
  this.csg_path = "../../../";
  // members
  this.project;
  this.scene;

  this.control;
  this.INTERSECTED;
  this.SELECTED;
  this.grid;
  //this.bbox;
  this.showShadows;
  this.Selection = {};

  // signals
  this.sigChanged = function() {};
  this.sigItemSelected = function() {};
  this.sigEmptySelection = function() {};
  this.sigItemTooltip = function() {};
  this.sigItemTooltipEmpty = function() {};

  this.cubemap;

  this.init = function(showGrid = false) {
    thisobj = this;
    this.scene = new THREE.Scene();
    this.showShadows = true;

    this.font_loader = new THREE.FontLoader();
    const font_url = "";
    this.font = null;


    this.font_loader.load("/fonts/sans.json", function(font) {
      this.font = font;
      console.log("font loaded", this, this.font);
      this._ws = {}; // workspace

      //if (showGrid) {
        this.create_workspace({min:[-500,
        -500,
        -500
      ], max:[500,500,500]});
      //}

    }.bind(this));



    //this.scene.add( new THREE.HemisphereLight( 0x555555, 0x111122 ) );

    this.scene.add(new THREE.HemisphereLight(0x666655, 0x11112b));

    this.part_group = new THREE.Group();
    this.scene.add(this.part_group)
    this._bounding_box = new THREE.Box3();

    //this.addShadowedLight(this.scene, 5, 10, 10, 0xffff99, 1 );
    this.addShadowedLight(this.scene, 20, 20, 100, 0xffff99, 1);

    var groundMaterial = new THREE.MeshPhongMaterial({
      color: 0x6C6C6C
    });
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), groundMaterial);
    //plane.rotation.x = -Math.PI / 2;
    plane.position.z = -10;
    plane.receiveShadow = true;

    // this.scene.add(plane);

    //this.control = new THREE.TransformControls( camera, renderer.domElement );
    //control.addEventListener( 'change', controlChanged );
    //scene.add( control );

    if (showGrid) {
      this.grid = new THREE.GridHelper(100, 50);
      this.grid.rotation.set(Math.PI / 2, 0, 0);
      this.scene.add(this.grid);
    }

    // use CORS or load as b64
    var img_root = "/images/stormy-days/"
    var urls = [
      img_root + 'pos-x.jpg',
      img_root + 'neg-x.jpg',
      img_root + 'pos-y.jpg',
      img_root + 'neg-y.jpg',
      img_root + 'pos-z.jpg',
      img_root + 'neg-z.jpg'
    ];

    var cubemap = THREE.ImageUtils.loadTextureCube(urls); // load textures
    cubemap.format = THREE.RGBFormat;
    // var shader = THREE.ShaderLib['cube']; // init cube shader from built-in lib
    // shader.uniforms['tCube'].value = cubemap; // apply textures to shader
    this.cubemap = cubemap;

    this.matNormal = new THREE.MeshPhongMaterial({
      transparent: true,
      opacity: 0.5,
      envMap: cubemap,
      color: 0Xffffdd,
      specular: 0x111111,
      shininess: 100,
      emissive: 0x000000,
      combine: THREE.MixOperation,
      reflectivity: 0.1
    });


    this.mat_special = new THREE.MeshNormalMaterial({
      side: THREE.BackSide
    }); //new THREE.MeshPhongMaterial( { color: 0Xf06000, specular: 0x111111, shininess: 200, emissive:0x000000 } );
    var materialArray = [];
    for (var i = 0; i < 6; i++)
      materialArray.push(new THREE.MeshBasicMaterial({
        map: THREE.ImageUtils.loadTexture(urls[i]),
        side: THREE.BackSide
      }));

    var skyMaterial = new THREE.MeshFaceMaterial(materialArray);
    var sky_size = 5000;
    skyboxMesh = new THREE.Mesh(
      //new THREE.CubeGeometry( sky_size, sky_size, sky_size, 1, 1, 1, null, true )
      new THREE.SphereGeometry(5000, 8, 8), this.mat_special);
    skyboxMesh.rotateX(Math.PI / 2.0);
    // add it to the scene
    // this.scene.add( skyboxMesh );
    // this.scene.addObject ();


    //this.matNormal = new THREE.MeshPhongMaterial( { color: 0Xffffff, specular: 0x111111, shininess: 200, emissive:0x000000 } );
    this.matSelected = new THREE.MeshPhongMaterial({
      color: 0Xf06000,
      specular: 0x111111,
      shininess: 200,
      emissive: 0xff0000
    });
  }

  this.getScene = function() {
    return this.scene;
  }

  this.getCollisionMeshes = function() {
    //var kids = this.scene.children;
    //console.log(kids);

    var kids = this.part_group.children;


    var res = [];
    for (i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid.type === "Group" && kid.mesh != null) {
        res.push(kid.mesh);
      }
      /*
      else if (kid.type === "Mesh") {
      	res.push( kid );
      }*/
    }
    return res;
  }

  this.testIntersection = function(raycaster) {
    //console.log(this.scene.children);
    //console.log(raycaster);

    // var intersects = raycaster.intersectObjects( this.scene.children );
    //console.log(intersects);
    var kids = this.getCollisionMeshes();
    //console.log(kids);
    var intersects = raycaster.intersectObjects(kids);

    var found = false;
    if (intersects.length > 0) {
      //console.log(intersects);
      // for (i = 0; i < intersects.length ; i++) {
      // }
      for (i = 0; i < intersects.length && !found; i++) {
        var obj = intersects[i].object;
        if (obj && obj.type === "Mesh") {
          if (this.INTERSECTED) {
            this.INTERSECTED.mesh.material = this.INTERSECTED.mesh._org_material //this.matNormal; //.emissive.setHex( 0x000000 );
          }
          this.INTERSECTED = obj.group;
          this.INTERSECTED.mesh._org_material = this.INTERSECTED.mesh.material
          this.INTERSECTED.mesh.material = this.matSelected; //.emissive.setHex( 0xff0000 );
          found = true;
          this.sigChanged();
          this.sigItemTooltip();
        }
      }
    }
    if (!found) {
      if (this.INTERSECTED) {
        this.INTERSECTED.mesh.material = this.INTERSECTED.mesh._org_material //this.matNormal; //.emissive.setHex( 0x000000 );
        this.sigChanged();
      }
      this.INTERSECTED = null;
      this.sigItemTooltipEmpty();
    }
  }

  this.testSelection = function() {
    //if (this.INTERSECTED) {
    if (this.SELECTED) {
      if (this.control) {
        if (this.control.parent) {
          this.control.detach(this.control.parent);
        }
        this.scene.remove(this.control);
      }
      //this.scene.remove(this.bbox);
      this.SELECTED = null;
    }

    if (this.INTERSECTED) {
      this.SELECTED = this.INTERSECTED;
      if (this.control) {
        this.control.attach(this.SELECTED);
        this.scene.add(this.control);
      }
      //console.log(this.SELECTED);
      this.Selection[this.SELECTED.uuid] = this.SELECTED;
      //if (!this.bbox)
      // this.bbox = new THREE.BoxHelper( this.SELECTED );
      // this.scene.add(this.bbox);
      this.sigItemSelected();
    } else {
      console.log("clear");
      this.Selection = {};
      this.sigEmptySelection();
    }
    //}
    this.sigChanged();
  }

  this.update = function() {
    if (this.control) {
      this.control.update();
    }
    //if (this.SELECTED && self.bbox) {
    //	self.bbox.update(this.SELECTED);
    //}

    this.update_boundingbox()
  }

  this.deleteSelected = function() {
    if (this.SELECTED) {
      this.scene.remove(this.SELECTED);
      this.INTERSECTED = null;
      this.testSelection();
    }
  }

  this.duplicateSelected = function() {
    if (this.SELECTED) {
      this.createBody(this.SELECTED.code, function(mesh) {
        thisobj.INTERSECTED = mesh;
        thisobj.testSelection();
      });
    }
  }

  this.loadSTL = function(filepath) {
    var loader = new THREE.STLLoader();
    loader.load(
      filepath,
      function(geometry) {
        var material = this.matNormal; //= new THREE.MeshPhongMaterial( { color: 0Xf06000, specular: 0x111111, shininess: 200, emissive:0x000000 } );
        //mesh = new THREE.Mesh( geometry, material );
        //mesh.position.set( 0, 0, 0 );
        //mesh.rotation.set( 0, 0, 0 );
        //mesh.castShadow = thisobj.showShadows;
        //mesh.receiveShadow = thisobj.showShadows;
        var mesh = thisobj.createMeshNode();
        mesh.mesh.geometry = geometry;
        mesh.code = "// STL binary file\n"
        // thisobj.scene.add(mesh);
        thisobj.part_group.add(mesh)
        thisobj.sigChanged();
        //console.log("loaded stl");
        //console.log(mesh);
      });
  }

  this.addMeshNode = function(mesh) {
    loader.load(
      filepath,
      function(geometry) {
        var material = this.matNormal; //= new THREE.MeshPhongMaterial( { color: 0Xf06000, specular: 0x111111, shininess: 200, emissive:0x000000 } );
        //mesh = new THREE.Mesh( geometry, material );
        //mesh.position.set( 0, 0, 0 );
        //mesh.rotation.set( 0, 0, 0 );
        //mesh.castShadow = thisobj.showShadows;
        //mesh.receiveShadow = thisobj.showShadows;
        var mesh = thisobj.createMeshNode();
        mesh.mesh.geometry = geometry;
        mesh.code = "// STL binary file\n"
        //thisobj.scene.add(mesh);
        thisobj.part_group.add(mesh)
        thisobj.sigChanged();
        //console.log("loaded stl");
        //console.log(mesh);
      });
  }

  this.parseJSCAD = function(code) {
    if (this.SELECTED) {
      this.SELECTED.setCode(code);
      // this.scene.add(this.SELECTED);
      this.part_group.add(this.SELECTED)

      this.sigItemSelected();
    } else {
      var mesh = this.createMeshNode();
      mesh.setCode(code);
      //this.scene.add(mesh);
      this.part_group.add(mesh)
    }
    //this.sigChanged();
  }

  this.createBody = function(code, callback = function(mesh) {}) {
    var mesh = this.createMeshNode();
    mesh.setCode(code, function() {
      //thisobj.scene.add(mesh);
      thisobj.part_group.add(mesh)

      mesh.castShadow = thisobj.showShadows;
      mesh.receiveShadow = thisobj.showShadows;
      callback(mesh);
      thisobj.sigChanged();
    });
  }

  this.createJscadParameters = function(definitions, controls) {
    var paramValues = {};
    for (var i = 0; i < definitions.length; i++) {
      var paramdef = definitions[i];
      var type = "text";
      if ('type' in paramdef) {
        type = paramdef.type;
      }
      var control = controls[i];
      var value = null;
      if ((type == "text") || (type == "float") || (type == "int") || (type == "number") || (type == "range")) {
        value = control.value;
        if ((type == "float") || (type == "int") || (type == "number") || (type == "range")) {
          var isnumber = !isNaN(parseFloat(value)) && isFinite(value);
          if (!isnumber) {
            throw new Error("Not a number: " + value);
          }
          if (type == "int") {
            value = parseInt(value);
          } else {
            value = parseFloat(value);
          }
        }
      } else if (type == "choice") {
        value = control.options[control.selectedIndex].value;
      }
      paramValues[paramdef.name] = value;
    }
    return paramValues;
  }

  this.createControls = function(paramDefinitions) {
    var paramControls = [];

    for (var i = 0; i < paramDefinitions.length; i++) {
      var errorprefix = "Error in parameter definition #" + (i + 1) + ": ";
      var paramdef = paramDefinitions[i];
      if (!('name' in paramdef)) {
        throw new Error(errorprefix + "Should include a 'name' parameter");
      }
      var type = "text";
      if ('type' in paramdef) {
        type = paramdef.type;
      }
      if ((type !== "text") && (type !== "int") && (type !== "float") && (type !== "choice") && (type !== "number") && (type !== "range")) {
        throw new Error(errorprefix + "Unknown parameter type '" + type + "'");
      }
      var control;
      if ((type == "text") || (type == "int") || (type == "float") || (type == "number" || (type == "range"))) {
        control = {
          type: "",
          value: "",
          size: 0,
          name: paramdef.name
        };
        control.caption = paramdef.caption;
        control.unit = paramdef.unit;
        if (type == "number") {
          control.type = "number";
        } else if (type == "range") {
          control.type = "range";
          control.min = "0";
          control.max = "10";
        } else
          control.type = "text";
        if ('default' in paramdef) {
          control.value = paramdef["default"];
        } else if ('initial' in paramdef)
          control.value = paramdef.initial;
        else {
          if ((type == "int") || (type == "float") || (type == "number")) {
            control.value = "0";
          } else {
            control.value = "";
          }
        }
        if (paramdef.size !== undefined) {
          control.size = paramdef.size;
        }
        for (var property in paramdef) {
          if (paramdef.hasOwnProperty(property)) {
            if ((property != "name") && (property != "type") && (property != "default") && (property != "initial") && (property != "caption") && (property != "unit")) {
              control.setAttribute(property, paramdef[property]);
            }
          }
        }
      } else if (type == "choice") {
        if (!('values' in paramdef)) {
          throw new Error(errorprefix + "Should include a 'values' parameter");
        }
        control = {
          value: 0,
          options: [],
          name: paramdef.name
        }; //document.createElement("select");
        control.caption = paramdef.caption;
        control.unit = paramdef.unit;
        var values = paramdef.values;
        var captions;
        if ('captions' in paramdef) {
          captions = paramdef.captions;
          if (captions.length != values.length) {
            throw new Error(errorprefix + "'captions' and 'values' should have the same number of items");
          }
        } else {
          captions = values;
        }
        var selectedindex = 0;
        for (var valueindex = 0; valueindex < values.length; valueindex++) {
          var option = {}; //document.createElement("option");
          option.value = values[valueindex];
          option.text = captions[valueindex];
          control.options.push(option);
          if ('default' in paramdef) {
            if (paramdef["default"] == values[valueindex]) {
              selectedindex = valueindex;
            }
          } else if ('initial' in paramdef) {
            if (paramdef.initial == values[valueindex]) {
              selectedindex = valueindex;
            }
          }
        }
        if (values.length > 0) {
          control.selectedIndex = selectedindex;
        }
      }
      // implementing instantUpdate
      /*
      control.onchange = function() {
         if(document.getElementById("instantUpdate").checked==true) {
            that.rebuildSolid();
         }
      };
      */
      paramControls.push(control);
    }

    return paramControls;
  }

  this.applyJSCAD = function(group, code, geo, parameterControls, rebuildParameters, callback = function() {}) {
    // console.log("apply jscad csg");

    if (!geo)
      return;
    if (code == "" || code != code || code == null)
      return;

    var opt = {
      'openJsCadPath': this.csg_path,
      'libraries': []
    };
    var paraDefs = OpenJsCad.getParamDefinitions(code);
    if (rebuildParameters) {
      parameterControls.controls = this.createControls(paraDefs);
    }
    //console.log(parameterControls);
    var parameters = this.createJscadParameters(paraDefs, parameterControls.controls);

    var res = OpenJsCad.parseJsCadScriptASync(code, parameters, opt, function(err, csg) {
      if (err) {
        console.log(err);
      }
      //alert("jscad class is" + csg.class);
      //console.log("apply jscad csg2");
      //console.log(csg);
      var con_csg;
      if (CAG.prototype.isPrototypeOf(csg)) {
        var c = csg.sides.length;
        if (c > 0) {
          group.path_2d = new Array(c);
          for (var i = 0; i < c; i++) {
            group.path_2d[i] = [csg.sides[i].vertex0.pos._x, csg.sides[i].vertex0.pos._y, csg.sides[i].vertex1.pos._x, csg.sides[i].vertex1.pos._y];
          }
          //console.log(group);
        }
        con_csg = csg.extrude(); //csg.canonicalized();
      } else {
        con_csg = csg.canonicalized(); //csg.canonicalized();
      }
      // var con_csg = csg.extrude(); //csg.canonicalized();
      //var polygons = con_csg.toPolygons();
      var polygons = con_csg.toPolygons();

      var numpolygons = polygons.length;
      var vertexTag2Index = {};

      // translate csg mesh to three.js mesh
      for (var j = 0; j < numpolygons; j++) {
        var polygon = polygons[j];
        var indices = polygon.vertices.map(function(vertex) {
          var vertexindex;
          vertexindex = geo.vertices.length;
          geo.vertices.push(
            new THREE.Vector3(
              vertex.pos.x,
              vertex.pos.y,
              vertex.pos.z
            )
          );
          return vertexindex;
        });
        var normal = new THREE.Vector3(1, 0, 0);
        for (var i = 2; i < indices.length; i++) {
          geo.faces.push(new THREE.Face3(indices[0], indices[i - 1], indices[i], normal));
        }
      }
      geo.computeFaceNormals();
      //thisobj.sigChanged();
      group.update();
      if (callback) {
        callback();
      }
    });
  }

  this.queue = {};
  this.proc_idle = true;

  this.process_jscad = function() {
    if (this.proc_idle) {
      this.proc_idle = false;
      var item = Object.keys(this.queue)[0];
      if (item) {
        var special_cb = function() {
          thisobj.queue[item]();
          thisobj.proc_idle = true;
          thisobj.process_jscad()
        };
        item.mesh.geometry = new THREE.Geometry();
        this.applyJSCAD(item, item.code, item.mesh.geometry, item.parameters, rebuildParameters, special_cb);
        delete this.queue[item];
      } else {
        this.proc_idle = true;
      }
    }
  }

  this.createMeshNode = function() {
    var group = new THREE.Group();
    var geo = new THREE.Geometry();
    //var mat  = this.matNormal; //= new THREE.MeshPhongMaterial( { color: 0Xf06000, specular: 0x111111, shininess: 200, emissive:0x000000 } );
    var mat = new THREE.MeshPhongMaterial({
      envMap: this.cubemap,
      color: 0Xffffdd,
      specular: 0x111111,
      shininess: 100,
      emissive: 0x000000,
      combine: THREE.MixOperation,
      reflectivity: 0.1
    });
    var mesh = new THREE.Mesh(geo, mat);

    // line rendering ...
    // var mat2 = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 2 } );
    // var geo2 = new THREE.EdgesGeometry( geo );
    // var mesh = new THREE.LineSegments(geo2, mat2);

    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.castShadow = this.showShadows;
    mesh.receiveShadow = this.showShadows;

    // custom interface
    group.code = "";
    group.parameters = {
      controls: []
    };
    group.mesh = mesh;
    group.path_2d = [];
    mesh.group = group;
    /*
    group.bboxHelper = new THREE.BoundingBoxHelper(group.mesh, 0xffff00);
    group.bboxHelper.visible = false;
    group.add(group.bboxHelper);
    group.bbox = new THREE.BoxHelper( group.bboxHelper );
    group.add(group.bbox);
    */
    group.setCode = function(code, callback = function() {}) {
      if (code != "" && this.code != code) {
        this.code = code;
        this.rebuild(true, callback);
      } else {
        callback();
      }
    }
    group.update = function() {
      /*
      if (this.bboxHelper) {
      	this.bboxHelper.update();
      }*/

      if (this.mesh.boundingbox) {
        this.mesh.remove(this.mesh.boundingbox);
      }
      /*
      this.mesh.boundingbox = new THREE.BoxHelper( this.mesh );
      //this.mesh.boundingbox = new THREE.BoundingBoxHelper(this.mesh, 0xffff00);
      //this.mesh.boundingbox.update();
      this.mesh.boundingbox.material.color.set(0xffffff);
      this.mesh.add(this.mesh.boundingbox);
      */
      //thisobj.scene.add(this);
      thisobj.part_group.add(this)
      thisobj.sigChanged();



      // var edges = new THREE.EdgesHelper( this.mesh, 0x000000, 170 );
      // this.add(edges);

    }

    group.rebuild = function(rebuildParameters, callback = function() {}) {
      var geometry = new THREE.Geometry();
      var mesh = this.mesh;
      var cb = function() {
        mesh.geometry = geometry;
        callback();
      };
      thisobj.applyJSCAD(this, this.code, geometry, this.parameters, rebuildParameters, cb);
    }

    group.saferemove = function(what) {
      // thisobj.scene.remove(what.mesh);
      // thisobj.scene.remove(what);
      thisobj.part_group.remove(what.mesh);
      thisobj.part_group.remove(what);
    }

    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.add(mesh);

    return group;
  }

  this.addShadowedLight = function(scene, x, y, z, color, intensity) {
    var directionalLight = new THREE.DirectionalLight(color, intensity);
    directionalLight.position.set(x, y, z);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.color.setHSL(0.1, 1, 0.95);

    directionalLight.castShadow = this.showShadows;
    if (this.showShadows) {
      console.log("shadow map");
      directionalLight.shadowCameraVisible = true;
      var d = 100;
      directionalLight.shadowDarkness = 0.5;
      directionalLight.shadowCameraLeft = -d;
      directionalLight.shadowCameraRight = d;
      directionalLight.shadowCameraTop = d;
      directionalLight.shadowCameraBottom = -d;
      directionalLight.shadowCameraNear = 1;
      directionalLight.shadowCameraFar = 1000;
      directionalLight.shadowMapWidth = 2048; //2048; //1024;
      directionalLight.shadowMapHeight = 2048; //2048; //1024;
      directionalLight.shadowBias = -0.005;

    }
    scene.add(directionalLight);

  }

  this.snapV3 = function(v3, scale) {
    v3.x /= scale;
    v3.y /= scale;
    v3.z /= scale;
    v3.x = Math.floor(v3.x + 0.5);
    v3.y = Math.floor(v3.y + 0.5);
    v3.z = Math.floor(v3.z + 0.5);
    v3.x *= scale;
    v3.y *= scale;
    v3.z *= scale;
  }

  this.onControlChanged = function() {
    if (thisobj.SELECTED) {
      // do grid snapping ...
      var gridsize = 1.0; //mm
      var rotinc = Math.PI / 36.0; // rad
      thisobj.snapV3(thisobj.SELECTED.position, gridsize);
      thisobj.snapV3(thisobj.SELECTED.rotation, rotinc);
    }
    thisobj.sigChanged();
  }

  this.exportSelected = function() {
    if (this.SELECTED) {
      var blob = XMOD.exporter.exportBinaryStl(this.SELECTED.mesh.geometry);
      return blob;
    }
    console.log("selected is null");
    return null;
  }

  this.create_text_node = function(text, size) {

    //console.log("create text node", text);

    if (!this.font) return;
    var xMid, text;
    var color = 0x006699;
    color = 0x000000;
    var matDark = new THREE.LineBasicMaterial({
      color: color,
      side: THREE.DoubleSide
    });

    var matLite = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });

    var shapes = this.font.generateShapes(text, size);
    var geometry = new THREE.ShapeBufferGeometry(shapes);
    geometry.computeBoundingBox();
    xMid = -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
    geometry.translate(xMid, 0, 0);

    // make shape ( N.B. edge view not visible )
    var text_node = new THREE.Mesh(geometry, matLite);
    return text_node
  }

  this.create_workspace = function({min=[-1000,-1000,-1000], max=[1000,1000,1000], units="mm"}) {

    let dims = [
    {min: min[0], max: max[0], delta: max[0]-min[0], step: 100}, 
    {min: -min[1], max: -max[1], delta: max[1]-min[1], step: -100},
    {min: min[2], max: max[2], delta: max[2]-min[2], step: 100}]

    if (!isFinite(dims[0].delta) || !isFinite(dims[1].delta) || !isFinite(dims[2].delta)) {
      return
    }

    var GridHelperA = function(width, depth, step, color1, color2) {
      step = step || 100;
      color1 = new THREE.Color(color1 !== undefined ? color1 : 0x444444);
      color2 = new THREE.Color(color2 !== undefined ? color2 : 0x888888);
      var vertices = [],
        colors = [];

    
      var stepW = width.step
      var stepD = depth.step
      var ws = Math.abs((width.delta) / stepW);
      var ds = Math.abs((depth.delta) / stepD);
      var w_center = ws / 2;
      var d_center = ds / 2;

      var k = 0;
      var j = 0;

      /*
      // grid
      for (var i = 0, k = width.min; i <= ws; i++, k += stepW) {
        vertices.push(k, 0, depth.min, k, 0, depth.max);
        var color = i === w_center ? color1 : color2;
        color.toArray(colors, j);
        j += 3;
        color.toArray(colors, j);
        j += 3;
      }
      for (var i = 0, k = depth.min; i <= ds; i++, k += stepD) {
        vertices.push(width.min, 0, k, width.max, 0, k);
        var color = i === d_center ? color1 : color2;
        color.toArray(colors, j);
        j += 3;
        color.toArray(colors, j);
        j += 3;
      }
      */

      //vertices.push(width.max, 0, depth.min, width.max, 0, depth.max);
      // vertices.push(width.min, 0, depth.min, width.min, 0, depth.max);
      
      /*
      vertices.push(width.min, 0, depth.max, width.max, 0, depth.max);

      color2.toArray(colors, j);
      j+=3
      color2.toArray(colors, j);
      j+=3
      */

      var geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      var material = new THREE.LineBasicMaterial({
        vertexColors: THREE.VertexColors
      });
      THREE.LineSegments.call(this, geometry, material);

    }

    GridHelperA.prototype = Object.create(THREE.LineSegments.prototype);
    GridHelperA.prototype.constructor = GridHelperA;

    // clean old data
    if (this._ws.grid1) {
      this.scene.remove(this._ws.grid1);
    }
    if (this._ws.grid2) {
      this.scene.remove(this._ws.grid2);
    }
    if (this._ws.grid3) {
      this.scene.remove(this._ws.grid3);
    }

    const dim_scale = 100 // org was 50

    var label_font_size = Math.max(dims[0].delta, dims[1].delta, dims[2].delta )/500.0
    label_font_size = Math.round(label_font_size *20+5)

    // add new items
    var gridHelper = new GridHelperA(dims[0], dims[2]);
    /*
    // render tick marks
    var ticks = (dims[0].delta) / dim_scale;
    for (var ti = 0; ti <= ticks; ti++) {
      var tn = this.create_text_node(ti * dim_scale + units, 20);
      if (tn) {
        //tn.position.z = dims[2] / 2 + 40;
        //tn.position.x = -dims[0] / 2.0 + ti * 500;
        tn.position.z = dims[2].max + 40;
        tn.position.x = dims[0].min + ti * dim_scale;

        tn.rotation.x = Math.PI / 2.0;
        tn.rotation.y = Math.PI;

        gridHelper.add(tn);
      }
    }
    */

    // render dimension length value
    var tn = this.create_text_node(dims[0].delta.toFixed(1) + units, label_font_size);
    if (tn) {
      tn.position.z = dims[2].max + label_font_size*2;
      tn.position.x = dims[0].min + dims[0].delta/2;
      tn.rotation.x = Math.PI / 2.0;
      tn.rotation.y = Math.PI;
      gridHelper.add(tn);
    }


    /*
    var label = this.create_text_node("LENGTH", 50);
    if (label) {
      label.position.z = dims[2].max + 120;
      label.position.x = 0;
      label.rotation.x = Math.PI / 2.0;
      label.rotation.y = Math.PI;
      gridHelper.add(label);
    }
    */

    gridHelper.position.y = -dims[1].min

    this._ws.grid1 = gridHelper;
    this.scene.add(gridHelper);

    gridHelper = new GridHelperA(dims[0], dims[1]);
    gridHelper.rotation.x = Math.PI / 2
    // gridHelper.position.z = -dims[2] / 2
    gridHelper.position.z = dims[2].min
    gridHelper.position.y = 0 //dims[1]/2
    gridHelper.position.x = 0 //dims[1]/2


    /*
    // render tick marks
    var ticks = (dims[1].delta) / dim_scale;
    for (var ti = 0; ti <= ticks; ti++) {
      var tn = this.create_text_node(ti * dim_scale + units, 20);
      if (tn) {
        // tn.position.x = dims[0] / 2 + 40;
        // tn.position.z = dims[1] / 2.0 - ti * 500;
        tn.position.x = dims[0].max + 40;
        tn.position.z = dims[1].min - ti * dim_scale;
        tn.rotation.x = -Math.PI / 2.0;
        tn.rotation.z = Math.PI / 2;

        gridHelper.add(tn);
      }
    }
    */

    // render dimension length value
    tn = this.create_text_node(dims[1].delta.toFixed(1) + units, label_font_size);
    if (tn) {
      tn.position.x = dims[0].max + label_font_size*2;
      tn.position.z = dims[1].min - dims[1].delta/2;
      tn.rotation.x = -Math.PI / 2.0;
      tn.rotation.z = Math.PI / 2;

      gridHelper.add(tn);
    }

    /*
    label = this.create_text_node("WIDTH", 50);
    if (label) {
      label.position.x = dims[0].max + 120;
      label.position.z = 0
      label.rotation.x = -Math.PI / 2.0;
      label.rotation.z = Math.PI / 2;
      gridHelper.add(label);
    }
    */


    this._ws.grid2 = gridHelper;
    this.scene.add(gridHelper);

    gridHelper = new GridHelperA(dims[2], dims[1]);
    gridHelper.rotation.x = Math.PI / 2
    gridHelper.rotation.z = Math.PI / 2
    // gridHelper.position.x = -dims[0] / 2
    gridHelper.position.x = dims[0].min
    gridHelper.position.y = 0 //dims[1]/2

    var ticks = (dims[2].delta) / dim_scale;
    /*
    // render tick marks
    for (var ti = 0; ti <= ticks; ti++) {
      var tn = this.create_text_node(ti * dim_scale + units, 20);
      if (tn) {
        // tn.position.z = -dims[1] / 2 - 20;
        // tn.position.x = -dims[2] / 2.0 + ti * 500;
        tn.position.z = dims[1].max - 20;
        tn.position.x = dims[2].min + ti * dim_scale;
        tn.rotation.x = -Math.PI / 2.0;
        tn.rotation.y = Math.PI;

        gridHelper.add(tn);
      }
    }
    */

    // render dimension length value
    tn = this.create_text_node(dims[2].delta.toFixed(1) + units, label_font_size);
    if (tn) {
      tn.position.z = dims[1].max - label_font_size;
      tn.position.x = dims[2].min + dims[2].delta/2;
      tn.rotation.x = -Math.PI / 2.0;
      tn.rotation.y = Math.PI;
      gridHelper.add(tn);
    }

    /*
    label = this.create_text_node("HEIGHT", 50);
    if (label) {
      // label.position.z = -dims[1] / 2 - 70;
      label.position.z = dims[1].max - 70;
      label.position.x = 0;
      label.rotation.x = -Math.PI / 2.0;
      label.rotation.y = Math.PI;
      gridHelper.add(label);
    }
    */

    this._ws.grid3 = gridHelper;
    this.scene.add(gridHelper);
  }

  this.update_boundingbox = function() {
    console.log("update BB", this, this.scene, this._bounding_box)
    if (this.scene && this._bounding_box) {
      
      if (this._ws) {
        this._bounding_box.setFromObject(this.part_group)
        this.create_workspace(
          {
            max:[this._bounding_box.max.x, this._bounding_box.max.y, this._bounding_box.max.z],
            min:[this._bounding_box.min.x, this._bounding_box.min.y, this._bounding_box.min.z]
          }
        );
      }
    }
  }


}
