// == openjscad.js, originally written by Joost Nieuwenhuijse (MIT License)
//   few adjustments by Rene K. Mueller <spiritdude@gmail.com> for OpenJSCAD.org
//
// History:
// 2013/03/12: reenable webgui parameters to fit in current design
// 2013/03/11: few changes to fit design of http://openjscad.org

OpenJsCad = function() { };

OpenJsCad.log = function(txt) {
  var timeInMs = Date.now();
  var prevtime = OpenJsCad.log.prevLogTime;
  if(!prevtime) prevtime = timeInMs;
  var deltatime = timeInMs - prevtime;
  OpenJsCad.log.prevLogTime = timeInMs;
  var timefmt = (deltatime*0.001).toFixed(3);
  txt = "["+timefmt+"] "+txt;
  if( (typeof(console) == "object") && (typeof(console.log) == "function") ) {
    console.log(txt);
  } else if( (typeof(self) == "object") && (typeof(self.postMessage) == "function") ) {
    self.postMessage({cmd: 'log', txt: txt});
  }
  else throw new Error("Cannot log");
};

// A viewer is a WebGL canvas that lets the user view a mesh. The user can
// tumble it around by dragging the mouse.
OpenJsCad.Viewer = function(containerelement, initialdepth) {
  var gl = GL.create();
  this.gl = gl;
  this.angleX = -60;
  this.angleY = 0;
  this.angleZ = -45;
  this.viewpointX = 0;
  this.viewpointY = -5;
  this.viewpointZ = initialdepth;

  this.touch = {
    lastX: 0,
    lastY: 0,
    scale: 0,
    ctrl: 0,
    shiftTimer: null,
    shiftControl: null,
    cur: null //current state
  };


  // Draw axes flag:
  this.drawAxes = true;
  // Draw triangle lines:
  this.drawLines = false;
  // Set to true so lines don't use the depth buffer
  this.lineOverlay = false;

  // Set up the viewport
  this.gl.canvas.width  = $(containerelement).width();
  this.gl.canvas.height = $(containerelement).height();
  this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
  this.gl.matrixMode(this.gl.PROJECTION);
  this.gl.loadIdentity();
  this.gl.perspective(45, this.gl.canvas.width / this.gl.canvas.height, 0.5, 1000);
  this.gl.matrixMode(this.gl.MODELVIEW);

  // Set up WebGL state
  this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  this.gl.clearColor(0.93, 0.93, 0.93, 1);
  this.gl.enable(this.gl.DEPTH_TEST);
  this.gl.enable(this.gl.CULL_FACE);
  this.gl.polygonOffset(1, 1);

  // Black shader for wireframe
  this.blackShader = new GL.Shader('\
    void main() {\
      gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
    }', '\
    void main() {\
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.1);\
    }'
  );

  // Shader with diffuse and specular lighting
  this.lightingShader = new GL.Shader('\
      varying vec3 color;\
      varying float alpha;\
      varying vec3 normal;\
      varying vec3 light;\
      void main() {\
        const vec3 lightDir = vec3(1.0, 2.0, 3.0) / 3.741657386773941;\
        light = lightDir;\
        color = gl_Color.rgb;\
        alpha = gl_Color.a;\
        normal = gl_NormalMatrix * gl_Normal;\
        gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
      }',
     '\
      varying vec3 color;\
      varying float alpha;\
      varying vec3 normal;\
      varying vec3 light;\
      void main() {\
        vec3 n = normalize(normal);\
        float diffuse = max(0.0, dot(light, n));\
        float specular = pow(max(0.0, -reflect(light, n).z), 10.0) * sqrt(diffuse);\
        gl_FragColor = vec4(mix(color * (0.3 + 0.7 * diffuse), vec3(1.0), specular), alpha);\
      }'
  );

  var _this=this;

  var shiftControl = $('<div class="shift-scene"><div class="arrow arrow-left" />\
    <div class="arrow arrow-right" />\
    <div class="arrow arrow-top" />\
    <div class="arrow arrow-bottom" /></div>');
  this.touch.shiftControl = shiftControl;

  $(containerelement).append(this.gl.canvas)
    .append(shiftControl)
    .hammer({//touch screen control
      drag_lock_to_axis: true
    }).on("transform", function(e){
      if (e.gesture.touches.length >= 2) {
          _this.clearShift();
          _this.onTransform(e);
          e.preventDefault();
      }
    }).on("touch", function(e) {
      if (e.gesture.pointerType != 'touch'){
        e.preventDefault();
        return;
      }

      if (e.gesture.touches.length == 1) {
          var point = e.gesture.center;
          _this.touch.shiftTimer = setTimeout(function(){
              shiftControl.addClass('active').css({
                  left: point.pageX + 'px',
                  top: point.pageY + 'px'
              });
              _this.touch.shiftTimer = null;
              _this.touch.cur = 'shifting';
        }, 500);
      } else {
        _this.clearShift();
      }
    }).on("drag", function(e) {
      if (e.gesture.pointerType != 'touch') {
        e.preventDefault();
        return;
      }

      if (!_this.touch.cur || _this.touch.cur == 'dragging') {
          _this.clearShift();
          _this.onPanTilt(e);
      } else if (_this.touch.cur == 'shifting') {
          _this.onShift(e);
      }
    }).on("touchend", function(e) {
        _this.clearShift();
        if (_this.touch.cur) {
            shiftControl.removeClass('active shift-horizontal shift-vertical');
        }
    }).on("transformend dragstart dragend", function(e) {
      if ((e.type == 'transformend' && _this.touch.cur == 'transforming') || 
          (e.type == 'dragend' && _this.touch.cur == 'shifting') ||
          (e.type == 'dragend' && _this.touch.cur == 'dragging'))
        _this.touch.cur = null;
      _this.touch.lastX = 0;
      _this.touch.lastY = 0;
      _this.touch.scale = 0;
    });

  this.gl.onmousemove = function(e) {
    _this.onMouseMove(e);
  };

  this.gl.ondraw = function() {
    _this.onDraw();
  };

  this.gl.resizeCanvas = function() {
    var canvasWidth  = _this.gl.canvas.clientWidth;
    var canvasHeight = _this.gl.canvas.clientHeight;
    if (_this.gl.canvas.width  != canvasWidth ||
        _this.gl.canvas.height != canvasHeight) {
      _this.gl.canvas.width  = canvasWidth;
      _this.gl.canvas.height = canvasHeight;
      _this.gl.viewport(0, 0, _this.gl.canvas.width, _this.gl.canvas.height);
      _this.gl.matrixMode( _this.gl.PROJECTION );
      _this.gl.loadIdentity();
      _this.gl.perspective(45, _this.gl.canvas.width / _this.gl.canvas.height, 0.5, 1000 );
      _this.gl.matrixMode( _this.gl.MODELVIEW );
      _this.onDraw();
    }
  };
  // only window resize is available, so add an event callback for the canvas
  window.addEventListener( 'resize', this.gl.resizeCanvas );

  this.gl.onmousewheel = function(e) {
    var wheelDelta = 0;    
    if (e.wheelDelta) {
      wheelDelta = e.wheelDelta;
    } else if (e.detail) {
      // for firefox, see http://stackoverflow.com/questions/8886281/event-wheeldelta-returns-undefined
      wheelDelta = e.detail * -40;     
    }
    if(wheelDelta) {
      var factor = Math.pow(1.003, -wheelDelta);
      var coeff = _this.getZoom();
      coeff *= factor;
      _this.setZoom(coeff);
    }
  };

  this.clear();
};

OpenJsCad.Viewer.prototype = {
  setCsg: function(csg) {
    if(0&&csg.length) {                            // preparing multiple CSG's (not union-ed), not yet working
       for(var i=0; i<csg.length; i++)
          this.meshes.concat(OpenJsCad.Viewer.csgToMeshes(csg[i]));
    } else {
       this.meshes = OpenJsCad.Viewer.csgToMeshes(csg);
    }
    this.onDraw();    
  },

  clear: function() {
    // empty mesh list:
    this.meshes = []; 
    this.onDraw();    
  },

  supported: function() {
    return !!this.gl;
  },

  ZOOM_MAX: 1000,
  ZOOM_MIN: 10,
  onZoomChanged: null,
  plate: true,                   // render plate
  // state of view
  // 0 - initialized, no object
  // 1 - cleared, no object
  // 2 - showing, object
  state: 0,

  setZoom: function(coeff) { //0...1
    coeff=Math.max(coeff, 0);
    coeff=Math.min(coeff, 1);
    this.viewpointZ = this.ZOOM_MIN + coeff * (this.ZOOM_MAX - this.ZOOM_MIN);
    if(this.onZoomChanged) {
      this.onZoomChanged();
    }
    this.onDraw();
  },

  getZoom: function() {
    var coeff = (this.viewpointZ-this.ZOOM_MIN) / (this.ZOOM_MAX - this.ZOOM_MIN);
    return coeff;
  },
  
  onMouseMove: function(e) {
    if (e.dragging) {
      //console.log(e.which,e.button);
      var b = e.button;
      if(e.which) {                            // RANT: not even the mouse buttons are coherent among the brand (chrome,firefox,etc)
         b = e.which;
      }
      e.preventDefault();
      if(e.altKey||b==3) {                     // ROTATE X,Y (ALT or right mouse button)
        this.angleY += e.deltaX;
        this.angleX += e.deltaY;
        //this.angleX = Math.max(-180, Math.min(180, this.angleX));
      } else if(e.shiftKey||b==2) {            // PAN  (SHIFT or middle mouse button)
        var factor = 5e-3;
        this.viewpointX += factor * e.deltaX * this.viewpointZ;
        this.viewpointY -= factor * e.deltaY * this.viewpointZ;
      } else if(e.ctrlKey) {                   // ZOOM IN/OU
         var factor = Math.pow(1.006, e.deltaX+e.deltaY);
         var coeff = this.getZoom();
         coeff *= factor;
         this.setZoom(coeff);
      } else {                                 // ROTATE X,Z  left mouse button
        this.angleZ += e.deltaX;
        this.angleX += e.deltaY;
      }
      this.onDraw();
    }
  },
  clearShift: function() {
      if(this.touch.shiftTimer) {
          clearTimeout(this.touch.shiftTimer);
          this.touch.shiftTimer = null;
      }
      return this;
  },
  //pan & tilt with one finger
  onPanTilt: function(e) {
    this.touch.cur = 'dragging';
    var delta = 0;
    if (this.touch.lastY && (e.gesture.direction == 'up' || e.gesture.direction == 'down')) {
        //tilt
        delta = e.gesture.deltaY - this.touch.lastY;
        this.angleX += delta;
    } else if (this.touch.lastX && (e.gesture.direction == 'left' || e.gesture.direction == 'right')) {
        //pan
        delta = e.gesture.deltaX - this.touch.lastX;
        this.angleZ += delta;
    }
    if (delta)
      this.onDraw();
    this.touch.lastX = e.gesture.deltaX;
    this.touch.lastY = e.gesture.deltaY;
  },
  //shift after 0.5s touch&hold
  onShift: function(e) {
    this.touch.cur = 'shifting';
    var factor = 5e-3;
    var delta = 0;

    if (this.touch.lastY && (e.gesture.direction == 'up' || e.gesture.direction == 'down')) {
        this.touch.shiftControl
          .removeClass('shift-horizontal')
          .addClass('shift-vertical')
          .css('top', e.gesture.center.pageY + 'px');
        delta = e.gesture.deltaY - this.touch.lastY;
        this.viewpointY -= factor * delta * this.viewpointZ;
        this.angleX += delta;
    } 
    if (this.touch.lastX && (e.gesture.direction == 'left' || e.gesture.direction == 'right')) {
        this.touch.shiftControl
          .removeClass('shift-vertical')
          .addClass('shift-horizontal')
          .css('left', e.gesture.center.pageX + 'px');
        delta = e.gesture.deltaX - this.touch.lastX;
        this.viewpointX += factor * delta * this.viewpointZ;
        this.angleZ += delta;
    }
    if (delta)
      this.onDraw();
    this.touch.lastX = e.gesture.deltaX;
    this.touch.lastY = e.gesture.deltaY;
  },
  //zooming
  onTransform: function(e) {
      this.touch.cur = 'transforming';
      if (this.touch.scale) {
        var factor = 1 / (1 + e.gesture.scale - this.touch.scale);
        var coeff = this.getZoom();
        coeff *= factor;
        this.setZoom( coeff);
      }
      this.touch.scale = e.gesture.scale;
      return this;
  },
  onDraw: function(e) {
    var gl = this.gl;
    gl.makeCurrent();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.loadIdentity();
    gl.translate(this.viewpointX, this.viewpointY, -this.viewpointZ);
    gl.rotate(this.angleX, 1, 0, 0);
    gl.rotate(this.angleY, 0, 1, 0);
    gl.rotate(this.angleZ, 0, 0, 1);

    gl.enable(gl.BLEND);
    //gl.disable(gl.DEPTH_TEST);
    if (!this.lineOverlay) gl.enable(gl.POLYGON_OFFSET_FILL);
    for (var i = 0; i < this.meshes.length; i++) {
      var mesh = this.meshes[i];
      this.lightingShader.draw(mesh, gl.TRIANGLES);
    }
    if (!this.lineOverlay) gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.disable(gl.BLEND);
    //gl.enable(gl.DEPTH_TEST);

    if(this.drawLines) {
      if (this.lineOverlay) gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      for (var i = 0; i < this.meshes.length; i++) {
        var mesh = this.meshes[i];
        this.blackShader.draw(mesh, gl.LINES);
      }
      gl.disable(gl.BLEND);
      if (this.lineOverlay) gl.enable(gl.DEPTH_TEST);
    }
    //EDW: axes
    if (this.drawAxes) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.begin(gl.LINES);
      var plate = 200;
      if(this.plate) {
         gl.color(.8,.8,.8,.5); // -- minor grid
         for(var x=-plate/2; x<=plate/2; x++) {
            if(x%10) {
               gl.vertex(-plate/2, x, 0);
               gl.vertex(plate/2, x, 0);
               gl.vertex(x, -plate/2, 0);
               gl.vertex(x, plate/2, 0);
            }
         }
         gl.color(.5,.5,.5,.5); // -- major grid
         for(var x=-plate/2; x<=plate/2; x+=10) {
            gl.vertex(-plate/2, x, 0);
            gl.vertex(plate/2, x, 0);
            gl.vertex(x, -plate/2, 0);
            gl.vertex(x, plate/2, 0);
         }
      }
      if(0) {
         //X - red
         gl.color(1, 0.5, 0.5, 0.2); //negative direction is lighter
         gl.vertex(-100, 0, 0);
         gl.vertex(0, 0, 0);
   
         gl.color(1, 0, 0, 0.8); //positive direction
         gl.vertex(0, 0, 0);
         gl.vertex(100, 0, 0);
         //Y - green
         gl.color(0.5, 1, 0.5, 0.2); //negative direction is lighter
         gl.vertex(0, -100, 0);
         gl.vertex(0, 0, 0);
   
         gl.color(0, 1, 0, 0.8); //positive direction
         gl.vertex(0, 0, 0);
         gl.vertex(0, 100, 0);
         //Z - black
         gl.color(0.5, 0.5, 0.5, 0.2); //negative direction is lighter
         gl.vertex(0, 0, -100);
         gl.vertex(0, 0, 0);
   
         gl.color(0.2, 0.2, 0.2, 0.8); //positive direction
         gl.vertex(0, 0, 0);
         gl.vertex(0, 0, 100);
      }
      if(0) {
         gl.triangle();
         gl.color(0.6, 0.2, 0.6, 0.2); //positive direction
         gl.vertex(-plate,-plate,0);
         gl.vertex(plate,-plate,0);
         gl.vertex(plate,plate,0);
         gl.end();
         gl.triangle();
         gl.color(0.6, 0.2, 0.6, 0.2); //positive direction
         gl.vertex(plate,plate,0);
         gl.vertex(-plate,plate,0);
         gl.vertex(-plate,-plate,0);
         gl.end();
      }
      gl.end();
      gl.disable(gl.BLEND);
      // GL.Mesh.plane({ detailX: 20, detailY: 40 });
    }
  }
};

// Convert from CSG solid to an array of GL.Mesh objects
// limiting the number of vertices per mesh to less than 2^16
OpenJsCad.Viewer.csgToMeshes = function(initial_csg) {
  var csg = initial_csg.canonicalized();
  var mesh = new GL.Mesh({ normals: true, colors: true });
  var meshes = [ mesh ];
  var vertexTag2Index = {};
  var vertices = [];
  var colors = [];
  var triangles = [];
  // set to true if we want to use interpolated vertex normals
  // this creates nice round spheres but does not represent the shape of
  // the actual model
  var smoothlighting = false;
  var polygons = csg.toPolygons();
  var numpolygons = polygons.length;
  for(var j = 0; j < numpolygons; j++) {
    var polygon = polygons[j];
    var color = [1,.4,1,1];      // -- default color

    if(polygon.shared && polygon.shared.color) {
      color = polygon.shared.color;
    }
    if(polygon.color) {
      color = polygon.color;
    }

	if (color.length < 4)
		color.push(1.); //opaque

    var indices = polygon.vertices.map(function(vertex) {
      var vertextag = vertex.getTag();
      var vertexindex;
      if(smoothlighting && (vertextag in vertexTag2Index)) {
        vertexindex = vertexTag2Index[vertextag];
      } else {
        vertexindex = vertices.length;
        vertexTag2Index[vertextag] = vertexindex;
        vertices.push([vertex.pos.x, vertex.pos.y, vertex.pos.z]);
        colors.push(color);
      }
      return vertexindex;
    });
    for (var i = 2; i < indices.length; i++) {
      triangles.push([indices[0], indices[i - 1], indices[i]]);
    }
    // if too many vertices, start a new mesh;
    if (vertices.length > 65000) {
      // finalize the old mesh	
      mesh.triangles = triangles;
      mesh.vertices = vertices;
      mesh.colors = colors;
      mesh.computeWireframe();
      mesh.computeNormals();

      if ( mesh.vertices.length ) {
        meshes.push(mesh);
      }

      // start a new mesh
      mesh = new GL.Mesh({ normals: true, colors: true });
      triangles = [];
      colors = [];
      vertices = [];
    }
  }
  // finalize last mesh
  mesh.triangles = triangles;
  mesh.vertices = vertices;
  mesh.colors = colors;
  mesh.computeWireframe();
  mesh.computeNormals();

  if ( mesh.vertices.length ) {
    meshes.push(mesh);
  }

  return meshes;
};

// this is a bit of a hack; doesn't properly supports urls that start with '/'
// but does handle relative urls containing ../
OpenJsCad.makeAbsoluteUrl = function(url, baseurl) {
  if(!url.match(/^[a-z]+\:/i)) {
    var basecomps = baseurl.split("/");
    if(basecomps.length > 0) {
      basecomps.splice(basecomps.length - 1, 1);
    }
    var urlcomps = url.split("/");
    var comps = basecomps.concat(urlcomps);
    var comps2 = [];
    comps.map(function(c) {
      if(c == "..") {
        if(comps2.length > 0) {
          comps2.splice(comps2.length - 1, 1);
        }
      } else {
        comps2.push(c);
      }
    });  
    url = "";
    for(var i = 0; i < comps2.length; i++) {
      if(i > 0) url += "/";
      url += comps2[i];
    }
  }
  return url;
};

OpenJsCad.isChrome = function() {
  return (navigator.userAgent.search("Chrome") >= 0);
};

// This is called from within the web worker. Execute the main() function of the supplied script
// and post a message to the calling thread when finished
OpenJsCad.runMainInWorker = function(mainParameters) {
  try {
    if(typeof(main) != 'function') throw new Error('Your jscad file should contain a function main() which returns a CSG solid or a CAG area.');
    OpenJsCad.log.prevLogTime = Date.now();    
    var result = main(mainParameters);
    if( (typeof(result) != "object") || ((!(result instanceof CSG)) && (!(result instanceof CAG)))) {
      //throw new Error("Your main() function should return a CSG solid or a CAG area.");
    }
    if(result.length) {                   // main() return an array, we consider it a bunch of CSG not intersecting
       var o = result[0];
       if(o instanceof CAG) {
          o = o.extrude({offset: [0,0,0.1]});
       }
       for(var i=1; i<result.length; i++) {
          var c = result[i];
          if(c instanceof CAG) {
             c = c.extrude({offset: [0,0,0.1]});
          }
          o = o.unionForNonIntersecting(c);
       }
       result = o;
    } 
    var result_compact = result.toCompactBinary();   
    result = null; // not needed anymore
    self.postMessage({cmd: 'rendered', result: result_compact});
  }
  catch(e) {
    var errtxt = e.toString();
    if(e.stack) {
      errtxt += '\nStack trace:\n'+e.stack;
    } 
    self.postMessage({cmd: 'error', err: errtxt});
  }
};

OpenJsCad.parseJsCadScriptSync = function(script, mainParameters, debugging) {
  var workerscript = "//SYNC\n";
  workerscript += "_includePath = "+JSON.stringify(_includePath)+";\n";
  workerscript += script;
  if(debugging) {
    workerscript += "\n\n\n\n\n\n\n/* -------------------------------------------------------------------------\n";
    workerscript += "OpenJsCad debugging\n\nAssuming you are running Chrome:\nF10 steps over an instruction\nF11 steps into an instruction\n";
    workerscript += "F8  continues running\nPress the (||) button at the bottom to enable pausing whenever an error occurs\n";
    workerscript += "Click on a line number to set or clear a breakpoint\n";
    workerscript += "For more information see: http://code.google.com/chrome/devtools/docs/overview.html\n\n";
    workerscript += "------------------------------------------------------------------------- */\n"; 
    workerscript += "\n\n// Now press F11 twice to enter your main() function:\n\n";
    workerscript += "debugger;\n";
  }
  workerscript += "var me = " + JSON.stringify(me) + ";\n";
  workerscript += "return main("+JSON.stringify(mainParameters)+");";  
// trying to get include() somewhere:
// 1) XHR works for SYNC <---
// 2) importScripts() does not work in SYNC
// 3) _csg_libraries.push(fn) provides only 1 level include()

  workerscript += "function include(fn) {\
  if(0) {\
    _csg_libraries.push(fn);\
  } else if(0) {\
    var url = _includePath!=='undefined'?_includePath:'./';\
    var index = url.indexOf('index.html');\
    if(index!=-1) {\
       url = url.substring(0,index);\
    }\
  	 importScripts(url+fn);\
  } else {\
   console.log('SYNC checking gMemFs for '+fn);\
   if(gMemFs[fn]) {\
      console.log('found locally & eval:',gMemFs[fn].name);\
      eval(gMemFs[fn].source); return;\
   }\
   var xhr = new XMLHttpRequest();\
   xhr.open('GET',_includePath+fn,false);\
   console.log('include:'+_includePath+fn);\
   xhr.onload = function() {\
      var src = this.responseText;\
      eval(src);\
   };\
   xhr.onerror = function() {\
   };\
   xhr.send();\
  }\
}\
";
  //workerscript += "function includePath(p) { _includePath = p; }\n";
  
  if(0) {
    OpenJsCad.log.prevLogTime = Date.now();    
    return eval(workerscript);      // old fashion-way

  } else {
    var f = new Function(workerscript);
    OpenJsCad.log.prevLogTime = Date.now();    
    return f();                     // execute the actual code
  }
};

// callback: should be function(error, csg)
OpenJsCad.parseJsCadScriptASync = function(script, mainParameters, options, callback) {
  var baselibraries = [
    //"csg.js",
    //"openjscad.js",
    //"openscad.js"
    //"jquery/jquery-1.9.1.js",
    //"jquery/jquery-ui.js"
  ];

  var baseurl = document.location.href.replace(/\?.*$/, '');
  baseurl = baseurl.replace(/#.*$/,'');        // remove remote URL 
  var openjscadurl = baseurl;
  if (options['openJsCadPath'] != null) {
    openjscadurl = OpenJsCad.makeAbsoluteUrl( options['openJsCadPath'], baseurl );
  }
        
  var libraries = [];
  if (options['libraries'] != null) {
    libraries = options['libraries'];
  }
  for(var i in gMemFs) {            // let's test all files and check syntax before we do anything
    var src = gMemFs[i].source+"\nfunction include() { }\n";
    var f;
    try {
       f = new Function(src);
    } catch(e) {
      this.setError(i+": "+e.message);
    }
  }
  var workerscript = "//ASYNC\n";
  workerscript += "var me = " + JSON.stringify(me) + ";\n";
  workerscript += "var _csg_baseurl=" + JSON.stringify(baseurl)+";\n";        // -- we need it early for include()
  workerscript += "var _includePath=" + JSON.stringify(_includePath)+";\n";    //        ''            ''
  workerscript += "var gMemFs = [];\n";
  var ignoreInclude = false;
  var mainFile;
  for(var fn in gMemFs) {
     workerscript += "// "+gMemFs[fn].name+":\n";
     //workerscript += gMemFs[i].source+"\n";
     if(!mainFile) 
        mainFile = fn;
     if(fn=='main.jscad'||fn.match(/\/main.jscad$/)) 
        mainFile = fn;
     workerscript += "gMemFs[\""+gMemFs[fn].name+"\"] = "+JSON.stringify(gMemFs[fn].source)+";\n";
     ignoreInclude = true;
  }
  if(ignoreInclude) {
     workerscript += "eval(gMemFs['"+mainFile+"']);\n";
  } else {
     workerscript += script;
  }
  workerscript += "\n\n\n\n//// The following code is added by OpenJsCad + OpenJSCAD.org:\n";

/// HACK !!!!! csg
workerscript += '(function(module){var _CSGDEBUG=false;function fnNumberSort(a,b){return a-b}var CSG=function(){this.polygons=[];this.properties=new CSG.Properties;this.isCanonicalized=true;this.isRetesselated=true};CSG.defaultResolution2D=32;CSG.defaultResolution3D=12;CSG.fromPolygons=function(polygons){var csg=new CSG;csg.polygons=polygons;csg.isCanonicalized=false;csg.isRetesselated=false;return csg};CSG.fromSlices=function(options){return new CSG.Polygon.createFromPoints([[0,0,0],[1,0,0],[1,1,0],[0,1,0]]).solidFromSlices(options)};CSG.fromObject=function(obj){var polygons=obj.polygons.map(function(p){return CSG.Polygon.fromObject(p)});var csg=CSG.fromPolygons(polygons);csg=csg.canonicalized();return csg};CSG.fromCompactBinary=function(bin){if(bin["class"]!="CSG")throw new Error("Not a CSG");var planes=[],planeData=bin.planeData,numplanes=planeData.length/4,arrayindex=0,x,y,z,w,normal,plane;for(var planeindex=0;planeindex<numplanes;planeindex++){x=planeData[arrayindex++];y=planeData[arrayindex++];z=planeData[arrayindex++];w=planeData[arrayindex++];normal=CSG.Vector3D.Create(x,y,z);plane=new CSG.Plane(normal,w);planes.push(plane)}var vertices=[],vertexData=bin.vertexData,numvertices=vertexData.length/3,pos,vertex;arrayindex=0;for(var vertexindex=0;vertexindex<numvertices;vertexindex++){x=vertexData[arrayindex++];y=vertexData[arrayindex++];z=vertexData[arrayindex++];pos=CSG.Vector3D.Create(x,y,z);vertex=new CSG.Vertex(pos);vertices.push(vertex)}var shareds=bin.shared.map(function(shared){return CSG.Polygon.Shared.fromObject(shared)});var polygons=[],numpolygons=bin.numPolygons,numVerticesPerPolygon=bin.numVerticesPerPolygon,polygonVertices=bin.polygonVertices,polygonPlaneIndexes=bin.polygonPlaneIndexes,polygonSharedIndexes=bin.polygonSharedIndexes,numpolygonvertices,polygonvertices,shared,polygon;arrayindex=0;for(var polygonindex=0;polygonindex<numpolygons;polygonindex++){numpolygonvertices=numVerticesPerPolygon[polygonindex];polygonvertices=[];for(var i=0;i<numpolygonvertices;i++){polygonvertices.push(vertices[polygonVertices[arrayindex++]])}plane=planes[polygonPlaneIndexes[polygonindex]];shared=shareds[polygonSharedIndexes[polygonindex]];polygon=new CSG.Polygon(polygonvertices,shared,plane);polygons.push(polygon)}var csg=CSG.fromPolygons(polygons);csg.isCanonicalized=true;csg.isRetesselated=true;return csg};CSG.prototype={toPolygons:function(){return this.polygons},union:function(csg){var csgs;if(csg instanceof Array){csgs=csg.slice(0);csgs.push(this)}else{csgs=[this,csg]}for(var i=1;i<csgs.length;i+=2){csgs.push(csgs[i-1].unionSub(csgs[i]))}return csgs[i-1].reTesselated().canonicalized()},unionSub:function(csg,retesselate,canonicalize){if(!this.mayOverlap(csg)){return this.unionForNonIntersecting(csg)}else{var a=new CSG.Tree(this.polygons);var b=new CSG.Tree(csg.polygons);a.clipTo(b,false);b.clipTo(a);b.invert();b.clipTo(a);b.invert();var newpolygons=a.allPolygons().concat(b.allPolygons());var result=CSG.fromPolygons(newpolygons);result.properties=this.properties._merge(csg.properties);if(retesselate)result=result.reTesselated();if(canonicalize)result=result.canonicalized();return result}},unionForNonIntersecting:function(csg){var newpolygons=this.polygons.concat(csg.polygons);var result=CSG.fromPolygons(newpolygons);result.properties=this.properties._merge(csg.properties);result.isCanonicalized=this.isCanonicalized&&csg.isCanonicalized;result.isRetesselated=this.isRetesselated&&csg.isRetesselated;return result},subtract:function(csg){var csgs;if(csg instanceof Array){csgs=csg}else{csgs=[csg]}var result=this;for(var i=0;i<csgs.length;i++){var islast=i==csgs.length-1;result=result.subtractSub(csgs[i],islast,islast)}return result},subtractSub:function(csg,retesselate,canonicalize){var a=new CSG.Tree(this.polygons);var b=new CSG.Tree(csg.polygons);a.invert();a.clipTo(b);b.clipTo(a,true);a.addPolygons(b.allPolygons());a.invert();var result=CSG.fromPolygons(a.allPolygons());result.properties=this.properties._merge(csg.properties);if(retesselate)result=result.reTesselated();if(canonicalize)result=result.canonicalized();return result},intersect:function(csg){var csgs;if(csg instanceof Array){csgs=csg}else{csgs=[csg]}var result=this;for(var i=0;i<csgs.length;i++){var islast=i==csgs.length-1;result=result.intersectSub(csgs[i],islast,islast)}return result},intersectSub:function(csg,retesselate,canonicalize){var a=new CSG.Tree(this.polygons);var b=new CSG.Tree(csg.polygons);a.invert();b.clipTo(a);b.invert();a.clipTo(b);b.clipTo(a);a.addPolygons(b.allPolygons());a.invert();var result=CSG.fromPolygons(a.allPolygons());result.properties=this.properties._merge(csg.properties);if(retesselate)result=result.reTesselated();if(canonicalize)result=result.canonicalized();return result},invert:function(){var flippedpolygons=this.polygons.map(function(p){return p.flipped()});return CSG.fromPolygons(flippedpolygons)},transform1:function(matrix4x4){var newpolygons=this.polygons.map(function(p){return p.transform(matrix4x4)});var result=CSG.fromPolygons(newpolygons);result.properties=this.properties._transform(matrix4x4);result.isRetesselated=this.isRetesselated;return result},transform:function(matrix4x4){var ismirror=matrix4x4.isMirroring();var transformedvertices={};var transformedplanes={};var newpolygons=this.polygons.map(function(p){var newplane;var plane=p.plane;var planetag=plane.getTag();if(planetag in transformedplanes){newplane=transformedplanes[planetag]}else{newplane=plane.transform(matrix4x4);transformedplanes[planetag]=newplane}var newvertices=p.vertices.map(function(v){var newvertex;var vertextag=v.getTag();if(vertextag in transformedvertices){newvertex=transformedvertices[vertextag]}else{newvertex=v.transform(matrix4x4);transformedvertices[vertextag]=newvertex}return newvertex});if(ismirror)newvertices.reverse();return new CSG.Polygon(newvertices,p.shared,newplane)});var result=CSG.fromPolygons(newpolygons);result.properties=this.properties._transform(matrix4x4);result.isRetesselated=this.isRetesselated;result.isCanonicalized=this.isCanonicalized;return result},toString:function(){var result="CSG solid:\\n";this.polygons.map(function(p){result+=p.toString()});return result},expand:function(radius,resolution){var result=this.expandedShell(radius,resolution,true);result=result.reTesselated();result.properties=this.properties;return result},contract:function(radius,resolution){var expandedshell=this.expandedShell(radius,resolution,false);var result=this.subtract(expandedshell);result=result.reTesselated();result.properties=this.properties;return result},stretchAtPlane:function(normal,point,length){var plane=CSG.Plane.fromNormalAndPoint(normal,point);var onb=new CSG.OrthoNormalBasis(plane);var crosssect=this.sectionCut(onb);var midpiece=crosssect.extrudeInOrthonormalBasis(onb,length);var piece1=this.cutByPlane(plane);var piece2=this.cutByPlane(plane.flipped());var result=piece1.union([midpiece,piece2.translate(plane.normal.times(length))]);return result},expandedShell:function(radius,resolution,unionWithThis){var csg=this.reTesselated();var result;if(unionWithThis){result=csg}else{result=new CSG}csg.polygons.map(function(polygon){var extrudevector=polygon.plane.normal.unit().times(2*radius);var translatedpolygon=polygon.translate(extrudevector.times(-.5));var extrudedface=translatedpolygon.extrude(extrudevector);result=result.unionSub(extrudedface,false,false)});var vertexpairs={};csg.polygons.map(function(polygon){var numvertices=polygon.vertices.length;var prevvertex=polygon.vertices[numvertices-1];var prevvertextag=prevvertex.getTag();for(var i=0;i<numvertices;i++){var vertex=polygon.vertices[i];var vertextag=vertex.getTag();var vertextagpair;if(vertextag<prevvertextag){vertextagpair=vertextag+"-"+prevvertextag}else{vertextagpair=prevvertextag+"-"+vertextag}var obj;if(vertextagpair in vertexpairs){obj=vertexpairs[vertextagpair]}else{obj={v1:prevvertex,v2:vertex,planenormals:[]};vertexpairs[vertextagpair]=obj}obj.planenormals.push(polygon.plane.normal);prevvertextag=vertextag;prevvertex=vertex}});for(var vertextagpair in vertexpairs){var vertexpair=vertexpairs[vertextagpair],startpoint=vertexpair.v1.pos,endpoint=vertexpair.v2.pos,zbase=endpoint.minus(startpoint).unit(),xbase=vertexpair.planenormals[0].unit(),ybase=xbase.cross(zbase),angles=[];for(var i=0;i<resolution;i++){angles.push(i*Math.PI*2/resolution)}for(var i=0,iMax=vertexpair.planenormals.length;i<iMax;i++){var planenormal=vertexpair.planenormals[i],si=ybase.dot(planenormal),co=xbase.dot(planenormal),angle=Math.atan2(si,co);if(angle<0)angle+=Math.PI*2;angles.push(angle);angle=Math.atan2(-si,-co);if(angle<0)angle+=Math.PI*2;angles.push(angle)}angles=angles.sort(fnNumberSort);var numangles=angles.length,prevp1,prevp2,startfacevertices=[],endfacevertices=[],polygons=[];for(var i=-1;i<numangles;i++){var angle=angles[i<0?i+numangles:i],si=Math.sin(angle),co=Math.cos(angle),p=xbase.times(co*radius).plus(ybase.times(si*radius)),p1=startpoint.plus(p),p2=endpoint.plus(p),skip=false;if(i>=0){if(p1.distanceTo(prevp1)<1e-5){skip=true}}if(!skip){if(i>=0){startfacevertices.push(new CSG.Vertex(p1));endfacevertices.push(new CSG.Vertex(p2));var polygonvertices=[new CSG.Vertex(prevp2),new CSG.Vertex(p2),new CSG.Vertex(p1),new CSG.Vertex(prevp1)];var polygon=new CSG.Polygon(polygonvertices);polygons.push(polygon)}prevp1=p1;prevp2=p2}}endfacevertices.reverse();polygons.push(new CSG.Polygon(startfacevertices));polygons.push(new CSG.Polygon(endfacevertices));var cylinder=CSG.fromPolygons(polygons);result=result.unionSub(cylinder,false,false)}var vertexmap={};csg.polygons.map(function(polygon){polygon.vertices.map(function(vertex){var vertextag=vertex.getTag();var obj;if(vertextag in vertexmap){obj=vertexmap[vertextag]}else{obj={pos:vertex.pos,normals:[]};vertexmap[vertextag]=obj}obj.normals.push(polygon.plane.normal)})});for(var vertextag in vertexmap){var vertexobj=vertexmap[vertextag];var xaxis=vertexobj.normals[0].unit();var bestzaxis=null;var bestzaxisorthogonality=0;for(var i=1;i<vertexobj.normals.length;i++){var normal=vertexobj.normals[i].unit();var cross=xaxis.cross(normal);var crosslength=cross.length();if(crosslength>.05){if(crosslength>bestzaxisorthogonality){bestzaxisorthogonality=crosslength;bestzaxis=normal}}}if(!bestzaxis){bestzaxis=xaxis.randomNonParallelVector()}var yaxis=xaxis.cross(bestzaxis).unit();var zaxis=yaxis.cross(xaxis);var sphere=CSG.sphere({center:vertexobj.pos,radius:radius,resolution:resolution,axes:[xaxis,yaxis,zaxis]});result=result.unionSub(sphere,false,false)}return result},canonicalized:function(){if(this.isCanonicalized){return this}else{var factory=new CSG.fuzzyCSGFactory;var result=factory.getCSG(this);result.isCanonicalized=true;result.isRetesselated=this.isRetesselated;result.properties=this.properties;return result}},reTesselated:function(){if(this.isRetesselated){return this}else{var csg=this;var polygonsPerPlane={};var isCanonicalized=csg.isCanonicalized;var fuzzyfactory=new CSG.fuzzyCSGFactory;csg.polygons.map(function(polygon){var plane=polygon.plane;var shared=polygon.shared;if(!isCanonicalized){plane=fuzzyfactory.getPlane(plane);shared=fuzzyfactory.getPolygonShared(shared)}var tag=plane.getTag()+"/"+shared.getTag();if(!(tag in polygonsPerPlane)){polygonsPerPlane[tag]=[polygon]}else{polygonsPerPlane[tag].push(polygon)}});var destpolygons=[];for(var planetag in polygonsPerPlane){var sourcepolygons=polygonsPerPlane[planetag];if(sourcepolygons.length<2){destpolygons=destpolygons.concat(sourcepolygons)}else{var retesselayedpolygons=[];CSG.reTesselateCoplanarPolygons(sourcepolygons,retesselayedpolygons);destpolygons=destpolygons.concat(retesselayedpolygons)}}var result=CSG.fromPolygons(destpolygons);result.isRetesselated=true;result.properties=this.properties;return result}},getBounds:function(){if(!this.cachedBoundingBox){var minpoint=new CSG.Vector3D(0,0,0);var maxpoint=new CSG.Vector3D(0,0,0);var polygons=this.polygons;var numpolygons=polygons.length;for(var i=0;i<numpolygons;i++){var polygon=polygons[i];var bounds=polygon.boundingBox();if(i===0){minpoint=bounds[0];maxpoint=bounds[1]}else{minpoint=minpoint.min(bounds[0]);maxpoint=maxpoint.max(bounds[1])}}this.cachedBoundingBox=[minpoint,maxpoint]}return this.cachedBoundingBox},mayOverlap:function(csg){if(this.polygons.length===0||csg.polygons.length===0){return false}else{var mybounds=this.getBounds();var otherbounds=csg.getBounds();if(mybounds[1].x<otherbounds[0].x)return false;if(mybounds[0].x>otherbounds[1].x)return false;if(mybounds[1].y<otherbounds[0].y)return false;if(mybounds[0].y>otherbounds[1].y)return false;if(mybounds[1].z<otherbounds[0].z)return false;if(mybounds[0].z>otherbounds[1].z)return false;return true}},cutByPlane:function(plane){if(this.polygons.length===0){return new CSG}var planecenter=plane.normal.times(plane.w);var maxdistance=0;this.polygons.map(function(polygon){polygon.vertices.map(function(vertex){var distance=vertex.pos.distanceToSquared(planecenter);if(distance>maxdistance)maxdistance=distance})});maxdistance=Math.sqrt(maxdistance);maxdistance*=1.01;var vertices=[];var orthobasis=new CSG.OrthoNormalBasis(plane);vertices.push(new CSG.Vertex(orthobasis.to3D(new CSG.Vector2D(maxdistance,-maxdistance))));vertices.push(new CSG.Vertex(orthobasis.to3D(new CSG.Vector2D(-maxdistance,-maxdistance))));vertices.push(new CSG.Vertex(orthobasis.to3D(new CSG.Vector2D(-maxdistance,maxdistance))));vertices.push(new CSG.Vertex(orthobasis.to3D(new CSG.Vector2D(maxdistance,maxdistance))));var polygon=new CSG.Polygon(vertices,null,plane.flipped());var cube=polygon.extrude(plane.normal.times(-maxdistance));var result=this.intersect(cube);result.properties=this.properties;return result},connectTo:function(myConnector,otherConnector,mirror,normalrotation){var matrix=myConnector.getTransformationTo(otherConnector,mirror,normalrotation);return this.transform(matrix)},setShared:function(shared){var polygons=this.polygons.map(function(p){return new CSG.Polygon(p.vertices,shared,p.plane)});var result=CSG.fromPolygons(polygons);result.properties=this.properties;result.isRetesselated=this.isRetesselated;result.isCanonicalized=this.isCanonicalized;return result},setColor:function(args){var newshared=CSG.Polygon.Shared.fromColor.apply(this,arguments);return this.setShared(newshared)},toCompactBinary:function(){var csg=this.canonicalized(),numpolygons=csg.polygons.length,numpolygonvertices=0,numvertices=0,vertexmap={},vertices=[],numplanes=0,planemap={},polygonindex=0,planes=[],shareds=[],sharedmap={},numshared=0;csg.polygons.map(function(p){p.vertices.map(function(v){++numpolygonvertices;var vertextag=v.getTag();if(!(vertextag in vertexmap)){vertexmap[vertextag]=numvertices++;vertices.push(v)}});var planetag=p.plane.getTag();if(!(planetag in planemap)){planemap[planetag]=numplanes++;planes.push(p.plane)}var sharedtag=p.shared.getTag();if(!(sharedtag in sharedmap)){sharedmap[sharedtag]=numshared++;shareds.push(p.shared)}});var numVerticesPerPolygon=new Uint32Array(numpolygons),polygonSharedIndexes=new Uint32Array(numpolygons),polygonVertices=new Uint32Array(numpolygonvertices),polygonPlaneIndexes=new Uint32Array(numpolygons),vertexData=new Float64Array(numvertices*3),planeData=new Float64Array(numplanes*4),polygonVerticesIndex=0;for(var polygonindex=0;polygonindex<numpolygons;++polygonindex){var p=csg.polygons[polygonindex];numVerticesPerPolygon[polygonindex]=p.vertices.length;p.vertices.map(function(v){var vertextag=v.getTag();var vertexindex=vertexmap[vertextag];polygonVertices[polygonVerticesIndex++]=vertexindex});var planetag=p.plane.getTag();var planeindex=planemap[planetag];polygonPlaneIndexes[polygonindex]=planeindex;var sharedtag=p.shared.getTag();var sharedindex=sharedmap[sharedtag];polygonSharedIndexes[polygonindex]=sharedindex}var verticesArrayIndex=0;vertices.map(function(v){var pos=v.pos;vertexData[verticesArrayIndex++]=pos._x;vertexData[verticesArrayIndex++]=pos._y;vertexData[verticesArrayIndex++]=pos._z});var planesArrayIndex=0;planes.map(function(p){var normal=p.normal;planeData[planesArrayIndex++]=normal._x;planeData[planesArrayIndex++]=normal._y;planeData[planesArrayIndex++]=normal._z;planeData[planesArrayIndex++]=p.w});var result={class:"CSG",numPolygons:numpolygons,numVerticesPerPolygon:numVerticesPerPolygon,polygonPlaneIndexes:polygonPlaneIndexes,polygonSharedIndexes:polygonSharedIndexes,polygonVertices:polygonVertices,vertexData:vertexData,planeData:planeData,shared:shareds};return result},toPointCloud:function(cuberadius){var csg=this.reTesselated();var result=new CSG;var vertexmap={};csg.polygons.map(function(polygon){polygon.vertices.map(function(vertex){vertexmap[vertex.getTag()]=vertex.pos})});for(var vertextag in vertexmap){var pos=vertexmap[vertextag];var cube=CSG.cube({center:pos,radius:cuberadius});result=result.unionSub(cube,false,false)}result=result.reTesselated();return result},getTransformationAndInverseTransformationToFlatLying:function(){if(this.polygons.length===0){return new CSG.Matrix4x4}else{var csg=this.canonicalized();var planemap={};csg.polygons.map(function(polygon){planemap[polygon.plane.getTag()]=polygon.plane});var xvector=new CSG.Vector3D(1,0,0);var yvector=new CSG.Vector3D(0,1,0);var zvector=new CSG.Vector3D(0,0,1);var z0connectorx=new CSG.Connector([0,0,0],[0,0,-1],xvector);var z0connectory=new CSG.Connector([0,0,0],[0,0,-1],yvector);var isfirst=true;var minheight=0;var maxdotz=0;var besttransformation,bestinversetransformation;for(var planetag in planemap){var plane=planemap[planetag];var pointonplane=plane.normal.times(plane.w);var transformation,inversetransformation;var xorthogonality=plane.normal.cross(xvector).length();var yorthogonality=plane.normal.cross(yvector).length();if(xorthogonality>yorthogonality){var planeconnector=new CSG.Connector(pointonplane,plane.normal,xvector);transformation=planeconnector.getTransformationTo(z0connectorx,false,0);inversetransformation=z0connectorx.getTransformationTo(planeconnector,false,0)}else{var planeconnector=new CSG.Connector(pointonplane,plane.normal,yvector);transformation=planeconnector.getTransformationTo(z0connectory,false,0);inversetransformation=z0connectory.getTransformationTo(planeconnector,false,0)}var transformedcsg=csg.transform(transformation);var dotz=-plane.normal.dot(zvector);var bounds=transformedcsg.getBounds();var zheight=bounds[1].z-bounds[0].z;var isbetter=isfirst;if(!isbetter){if(zheight<minheight){isbetter=true}else if(zheight==minheight){if(dotz>maxdotz)isbetter=true}}if(isbetter){var translation=new CSG.Vector3D([-.5*(bounds[1].x+bounds[0].x),-.5*(bounds[1].y+bounds[0].y),-bounds[0].z]);transformation=transformation.multiply(CSG.Matrix4x4.translation(translation));inversetransformation=CSG.Matrix4x4.translation(translation.negated()).multiply(inversetransformation);minheight=zheight;maxdotz=dotz;besttransformation=transformation;bestinversetransformation=inversetransformation}isfirst=false}return[besttransformation,bestinversetransformation]}},getTransformationToFlatLying:function(){var result=this.getTransformationAndInverseTransformationToFlatLying();return result[0]},lieFlat:function(){var transformation=this.getTransformationToFlatLying();return this.transform(transformation)},projectToOrthoNormalBasis:function(orthobasis){var EPS=1e-5;var cags=[];this.polygons.filter(function(p){return p.plane.normal.minus(orthobasis.plane.normal).lengthSquared()<EPS*EPS}).map(function(polygon){var cag=polygon.projectToOrthoNormalBasis(orthobasis);if(cag.sides.length>0){cags.push(cag)}});var result=(new CAG).union(cags);return result},sectionCut:function(orthobasis){var EPS=1e-5;var plane1=orthobasis.plane;var plane2=orthobasis.plane.flipped();plane1=new CSG.Plane(plane1.normal,plane1.w);plane2=new CSG.Plane(plane2.normal,plane2.w+5*EPS);var cut3d=this.cutByPlane(plane1);cut3d=cut3d.cutByPlane(plane2);return cut3d.projectToOrthoNormalBasis(orthobasis)},fixTJunctions:function(){var csg=this.canonicalized();var sidemap={};for(var polygonindex=0;polygonindex<csg.polygons.length;polygonindex++){var polygon=csg.polygons[polygonindex];var numvertices=polygon.vertices.length;if(numvertices>=3){var vertex=polygon.vertices[0];var vertextag=vertex.getTag();for(var vertexindex=0;vertexindex<numvertices;vertexindex++){var nextvertexindex=vertexindex+1;if(nextvertexindex==numvertices)nextvertexindex=0;var nextvertex=polygon.vertices[nextvertexindex];var nextvertextag=nextvertex.getTag();var sidetag=vertextag+"/"+nextvertextag;var reversesidetag=nextvertextag+"/"+vertextag;if(reversesidetag in sidemap){var ar=sidemap[reversesidetag];ar.splice(-1,1);if(ar.length===0){delete sidemap[reversesidetag]}}else{var sideobj={vertex0:vertex,vertex1:nextvertex,polygonindex:polygonindex};if(!(sidetag in sidemap)){sidemap[sidetag]=[sideobj]}else{sidemap[sidetag].push(sideobj)}}vertex=nextvertex;vertextag=nextvertextag}}}var vertextag2sidestart={};var vertextag2sideend={};var sidestocheck={};var sidemapisempty=true;for(var sidetag in sidemap){sidemapisempty=false;sidestocheck[sidetag]=true;sidemap[sidetag].map(function(sideobj){var starttag=sideobj.vertex0.getTag();var endtag=sideobj.vertex1.getTag();if(starttag in vertextag2sidestart){vertextag2sidestart[starttag].push(sidetag)}else{vertextag2sidestart[starttag]=[sidetag]}if(endtag in vertextag2sideend){vertextag2sideend[endtag].push(sidetag)}else{vertextag2sideend[endtag]=[sidetag]}})}if(!sidemapisempty){var polygons=csg.polygons.slice(0);function addSide(vertex0,vertex1,polygonindex){var starttag=vertex0.getTag();var endtag=vertex1.getTag();if(starttag==endtag)throw new Error("Assertion failed");var newsidetag=starttag+"/"+endtag;var reversesidetag=endtag+"/"+starttag;if(reversesidetag in sidemap){deleteSide(vertex1,vertex0,null);return null}var newsideobj={vertex0:vertex0,vertex1:vertex1,polygonindex:polygonindex};if(!(newsidetag in sidemap)){sidemap[newsidetag]=[newsideobj]}else{sidemap[newsidetag].push(newsideobj)}if(starttag in vertextag2sidestart){vertextag2sidestart[starttag].push(newsidetag)}else{vertextag2sidestart[starttag]=[newsidetag]}if(endtag in vertextag2sideend){vertextag2sideend[endtag].push(newsidetag)}else{vertextag2sideend[endtag]=[newsidetag]}return newsidetag}function deleteSide(vertex0,vertex1,polygonindex){var starttag=vertex0.getTag();var endtag=vertex1.getTag();var sidetag=starttag+"/"+endtag;if(!(sidetag in sidemap))throw new Error("Assertion failed");var idx=-1;var sideobjs=sidemap[sidetag];for(var i=0;i<sideobjs.length;i++){var sideobj=sideobjs[i];if(sideobj.vertex0!=vertex0)continue;if(sideobj.vertex1!=vertex1)continue;if(polygonindex!==null){if(sideobj.polygonindex!=polygonindex)continue}idx=i;break}if(idx<0)throw new Error("Assertion failed");sideobjs.splice(idx,1);if(sideobjs.length===0){delete sidemap[sidetag]}idx=vertextag2sidestart[starttag].indexOf(sidetag);if(idx<0)throw new Error("Assertion failed");vertextag2sidestart[starttag].splice(idx,1);if(vertextag2sidestart[starttag].length===0){delete vertextag2sidestart[starttag]}idx=vertextag2sideend[endtag].indexOf(sidetag);if(idx<0)throw new Error("Assertion failed");vertextag2sideend[endtag].splice(idx,1);if(vertextag2sideend[endtag].length===0){delete vertextag2sideend[endtag]}}while(true){var sidemapisempty=true;for(var sidetag in sidemap){sidemapisempty=false;sidestocheck[sidetag]=true}if(sidemapisempty)break;var donesomething=false;while(true){var sidetagtocheck=null;for(var sidetag in sidestocheck){sidetagtocheck=sidetag;break}if(sidetagtocheck===null)break;var donewithside=true;if(sidetagtocheck in sidemap){var sideobjs=sidemap[sidetagtocheck];if(sideobjs.length===0)throw new Error("Assertion failed");var sideobj=sideobjs[0];for(var directionindex=0;directionindex<2;directionindex++){var startvertex=directionindex===0?sideobj.vertex0:sideobj.vertex1;var endvertex=directionindex===0?sideobj.vertex1:sideobj.vertex0;var startvertextag=startvertex.getTag();var endvertextag=endvertex.getTag();var matchingsides=[];if(directionindex===0){if(startvertextag in vertextag2sideend){matchingsides=vertextag2sideend[startvertextag]}}else{if(startvertextag in vertextag2sidestart){matchingsides=vertextag2sidestart[startvertextag]}}for(var matchingsideindex=0;matchingsideindex<matchingsides.length;matchingsideindex++){var matchingsidetag=matchingsides[matchingsideindex];var matchingside=sidemap[matchingsidetag][0];var matchingsidestartvertex=directionindex===0?matchingside.vertex0:matchingside.vertex1;var matchingsideendvertex=directionindex===0?matchingside.vertex1:matchingside.vertex0;var matchingsidestartvertextag=matchingsidestartvertex.getTag();var matchingsideendvertextag=matchingsideendvertex.getTag();if(matchingsideendvertextag!=startvertextag)throw new Error("Assertion failed");if(matchingsidestartvertextag==endvertextag){deleteSide(startvertex,endvertex,null);deleteSide(endvertex,startvertex,null);donewithside=false;directionindex=2;donesomething=true;break}else{var startpos=startvertex.pos;var endpos=endvertex.pos;var checkpos=matchingsidestartvertex.pos;var direction=checkpos.minus(startpos);var t=endpos.minus(startpos).dot(direction)/direction.dot(direction);if(t>0&&t<1){var closestpoint=startpos.plus(direction.times(t));var distancesquared=closestpoint.distanceToSquared(endpos);if(distancesquared<1e-10){var polygonindex=matchingside.polygonindex;var polygon=polygons[polygonindex];var insertionvertextag=matchingside.vertex1.getTag();var insertionvertextagindex=-1;for(var i=0;i<polygon.vertices.length;i++){if(polygon.vertices[i].getTag()==insertionvertextag){insertionvertextagindex=i;break}}if(insertionvertextagindex<0)throw new Error("Assertion failed");var newvertices=polygon.vertices.slice(0);newvertices.splice(insertionvertextagindex,0,endvertex);var newpolygon=new CSG.Polygon(newvertices,polygon.shared);polygons[polygonindex]=newpolygon;deleteSide(matchingside.vertex0,matchingside.vertex1,polygonindex);var newsidetag1=addSide(matchingside.vertex0,endvertex,polygonindex);var newsidetag2=addSide(endvertex,matchingside.vertex1,polygonindex);if(newsidetag1!==null)sidestocheck[newsidetag1]=true;if(newsidetag2!==null)sidestocheck[newsidetag2]=true;donewithside=false;directionindex=2;donesomething=true;break}}}}}}if(donewithside){delete sidestocheck[sidetag]}}if(!donesomething)break}var newcsg=CSG.fromPolygons(polygons);newcsg.properties=csg.properties;newcsg.isCanonicalized=true;newcsg.isRetesselated=true;csg=newcsg}var sidemapisempty=true;for(var sidetag in sidemap){sidemapisempty=false;break}if(!sidemapisempty){OpenJsCad.log("!sidemapisempty")}return csg},toTriangles:function(){var polygons=[];this.polygons.forEach(function(poly){var firstVertex=poly.vertices[0];for(var i=poly.vertices.length-3;i>=0;i--){polygons.push(new CSG.Polygon([firstVertex,poly.vertices[i+1],poly.vertices[i+2]],poly.shared,poly.plane))}});return polygons},getFeatures:function(features){if(!(features instanceof Array)){features=[features]}var result=this.toTriangles().map(function(triPoly){return triPoly.getTetraFeatures(features)}).reduce(function(pv,v){return v.map(function(feat,i){return feat+(pv===0?0:pv[i])})},0);return result.length==1?result[0]:result}};CSG.parseOption=function(options,optionname,defaultvalue){var result=defaultvalue;if(options){if(optionname in options){result=options[optionname]}}return result};CSG.parseOptionAs3DVector=function(options,optionname,defaultvalue){var result=CSG.parseOption(options,optionname,defaultvalue);result=new CSG.Vector3D(result);return result};CSG.parseOptionAs3DVectorList=function(options,optionname,defaultvalue){var result=CSG.parseOption(options,optionname,defaultvalue);return result.map(function(res){return new CSG.Vector3D(res)})};CSG.parseOptionAs2DVector=function(options,optionname,defaultvalue){var result=CSG.parseOption(options,optionname,defaultvalue);result=new CSG.Vector2D(result);return result};CSG.parseOptionAsFloat=function(options,optionname,defaultvalue){var result=CSG.parseOption(options,optionname,defaultvalue);if(typeof result=="string"){result=Number(result)}if(isNaN(result)||typeof result!="number"){throw new Error("Parameter "+optionname+" should be a number")}return result};CSG.parseOptionAsInt=function(options,optionname,defaultvalue){var result=CSG.parseOption(options,optionname,defaultvalue);result=Number(Math.floor(result));if(isNaN(result)){throw new Error("Parameter "+optionname+" should be a number")}return result};CSG.parseOptionAsBool=function(options,optionname,defaultvalue){var result=CSG.parseOption(options,optionname,defaultvalue);if(typeof result=="string"){if(result=="true")result=true;else if(result=="false")result=false;else if(result==0)result=false}result=!!result;return result};CSG.cube=function(options){var c,r;options=options||{};if("corner1"in options||"corner2"in options){if("center"in options||"radius"in options){throw new Error("cube: should either give a radius and center parameter, or a corner1 and corner2 parameter")}corner1=CSG.parseOptionAs3DVector(options,"corner1",[0,0,0]);corner2=CSG.parseOptionAs3DVector(options,"corner2",[1,1,1]);c=corner1.plus(corner2).times(.5);r=corner2.minus(corner1).times(.5)}else{c=CSG.parseOptionAs3DVector(options,"center",[0,0,0]);r=CSG.parseOptionAs3DVector(options,"radius",[1,1,1])}r=r.abs();var result=CSG.fromPolygons([[[0,4,6,2],[-1,0,0]],[[1,3,7,5],[+1,0,0]],[[0,1,5,4],[0,-1,0]],[[2,6,7,3],[0,+1,0]],[[0,2,3,1],[0,0,-1]],[[4,5,7,6],[0,0,+1]]].map(function(info){var vertices=info[0].map(function(i){var pos=new CSG.Vector3D(c.x+r.x*(2*!!(i&1)-1),c.y+r.y*(2*!!(i&2)-1),c.z+r.z*(2*!!(i&4)-1));return new CSG.Vertex(pos)});return new CSG.Polygon(vertices,null)}));result.properties.cube=new CSG.Properties;result.properties.cube.center=new CSG.Vector3D(c);result.properties.cube.facecenters=[new CSG.Connector(new CSG.Vector3D([r.x,0,0]).plus(c),[1,0,0],[0,0,1]),new CSG.Connector(new CSG.Vector3D([-r.x,0,0]).plus(c),[-1,0,0],[0,0,1]),new CSG.Connector(new CSG.Vector3D([0,r.y,0]).plus(c),[0,1,0],[0,0,1]),new CSG.Connector(new CSG.Vector3D([0,-r.y,0]).plus(c),[0,-1,0],[0,0,1]),new CSG.Connector(new CSG.Vector3D([0,0,r.z]).plus(c),[0,0,1],[1,0,0]),new CSG.Connector(new CSG.Vector3D([0,0,-r.z]).plus(c),[0,0,-1],[1,0,0])];return result};CSG.sphere=function(options){options=options||{};var center=CSG.parseOptionAs3DVector(options,"center",[0,0,0]);var radius=CSG.parseOptionAsFloat(options,"radius",1);var resolution=CSG.parseOptionAsInt(options,"resolution",CSG.defaultResolution3D);var xvector,yvector,zvector;if("axes"in options){xvector=options.axes[0].unit().times(radius);yvector=options.axes[1].unit().times(radius);zvector=options.axes[2].unit().times(radius)}else{xvector=new CSG.Vector3D([1,0,0]).times(radius);yvector=new CSG.Vector3D([0,-1,0]).times(radius);zvector=new CSG.Vector3D([0,0,1]).times(radius)}if(resolution<4)resolution=4;var qresolution=Math.round(resolution/4);var prevcylinderpoint;var polygons=[];for(var slice1=0;slice1<=resolution;slice1++){var angle=Math.PI*2*slice1/resolution;var cylinderpoint=xvector.times(Math.cos(angle)).plus(yvector.times(Math.sin(angle)));if(slice1>0){var vertices=[];var prevcospitch,prevsinpitch;for(var slice2=0;slice2<=qresolution;slice2++){var pitch=.5*Math.PI*slice2/qresolution;var cospitch=Math.cos(pitch);var sinpitch=Math.sin(pitch);if(slice2>0){vertices=[];vertices.push(new CSG.Vertex(center.plus(prevcylinderpoint.times(prevcospitch).minus(zvector.times(prevsinpitch)))));vertices.push(new CSG.Vertex(center.plus(cylinderpoint.times(prevcospitch).minus(zvector.times(prevsinpitch)))));if(slice2<qresolution){vertices.push(new CSG.Vertex(center.plus(cylinderpoint.times(cospitch).minus(zvector.times(sinpitch)))))}vertices.push(new CSG.Vertex(center.plus(prevcylinderpoint.times(cospitch).minus(zvector.times(sinpitch)))));polygons.push(new CSG.Polygon(vertices));vertices=[];vertices.push(new CSG.Vertex(center.plus(prevcylinderpoint.times(prevcospitch).plus(zvector.times(prevsinpitch)))));vertices.push(new CSG.Vertex(center.plus(cylinderpoint.times(prevcospitch).plus(zvector.times(prevsinpitch)))));if(slice2<qresolution){'
workerscript += 'vertices.push(new CSG.Vertex(center.plus(cylinderpoint.times(cospitch).plus(zvector.times(sinpitch)))))}vertices.push(new CSG.Vertex(center.plus(prevcylinderpoint.times(cospitch).plus(zvector.times(sinpitch)))));vertices.reverse();polygons.push(new CSG.Polygon(vertices))}prevcospitch=cospitch;prevsinpitch=sinpitch}}prevcylinderpoint=cylinderpoint}var result=CSG.fromPolygons(polygons);result.properties.sphere=new CSG.Properties;result.properties.sphere.center=new CSG.Vector3D(center);result.properties.sphere.facepoint=center.plus(xvector);return result};CSG.cylinder=function(options){var s=CSG.parseOptionAs3DVector(options,"start",[0,-1,0]);var e=CSG.parseOptionAs3DVector(options,"end",[0,1,0]);var r=CSG.parseOptionAsFloat(options,"radius",1);var rEnd=CSG.parseOptionAsFloat(options,"radiusEnd",r);var rStart=CSG.parseOptionAsFloat(options,"radiusStart",r);var alpha=CSG.parseOptionAsFloat(options,"sectorAngle",360);alpha=alpha>360?alpha%360:alpha;if(rEnd<0||rStart<0){throw new Error("Radius should be non-negative")}if(rEnd===0&&rStart===0){throw new Error("Either radiusStart or radiusEnd should be positive")}var slices=CSG.parseOptionAsInt(options,"resolution",CSG.defaultResolution2D);var ray=e.minus(s);var axisZ=ray.unit();var axisX=axisZ.randomNonParallelVector().unit();var axisY=axisX.cross(axisZ).unit();var start=new CSG.Vertex(s);var end=new CSG.Vertex(e);var polygons=[];function point(stack,slice,radius){var angle=slice*Math.PI*alpha/180;var out=axisX.times(Math.cos(angle)).plus(axisY.times(Math.sin(angle)));var pos=s.plus(ray.times(stack)).plus(out.times(radius));return new CSG.Vertex(pos)}if(alpha>0){for(var i=0;i<slices;i++){var t0=i/slices,t1=(i+1)/slices;if(rEnd==rStart){polygons.push(new CSG.Polygon([start,point(0,t0,rEnd),point(0,t1,rEnd)]));polygons.push(new CSG.Polygon([point(0,t1,rEnd),point(0,t0,rEnd),point(1,t0,rEnd),point(1,t1,rEnd)]));polygons.push(new CSG.Polygon([end,point(1,t1,rEnd),point(1,t0,rEnd)]))}else{if(rStart>0){polygons.push(new CSG.Polygon([start,point(0,t0,rStart),point(0,t1,rStart)]));polygons.push(new CSG.Polygon([point(0,t0,rStart),point(1,t0,rEnd),point(0,t1,rStart)]))}if(rEnd>0){polygons.push(new CSG.Polygon([end,point(1,t1,rEnd),point(1,t0,rEnd)]));polygons.push(new CSG.Polygon([point(1,t0,rEnd),point(1,t1,rEnd),point(0,t1,rStart)]))}}}if(alpha<360){polygons.push(new CSG.Polygon([start,end,point(0,0,rStart)]));polygons.push(new CSG.Polygon([point(0,0,rStart),end,point(1,0,rEnd)]));polygons.push(new CSG.Polygon([start,point(0,1,rStart),end]));polygons.push(new CSG.Polygon([point(0,1,rStart),point(1,1,rEnd),end]))}}var result=CSG.fromPolygons(polygons);result.properties.cylinder=new CSG.Properties;result.properties.cylinder.start=new CSG.Connector(s,axisZ.negated(),axisX);result.properties.cylinder.end=new CSG.Connector(e,axisZ,axisX);var cylCenter=s.plus(ray.times(.5));var fptVec=axisX.rotate(s,axisZ,-alpha/2).times((rStart+rEnd)/2);var fptVec90=fptVec.cross(axisZ);result.properties.cylinder.facepointH=new CSG.Connector(cylCenter.plus(fptVec),fptVec,axisZ);result.properties.cylinder.facepointH90=new CSG.Connector(cylCenter.plus(fptVec90),fptVec90,axisZ);return result};CSG.roundedCylinder=function(options){var p1=CSG.parseOptionAs3DVector(options,"start",[0,-1,0]);var p2=CSG.parseOptionAs3DVector(options,"end",[0,1,0]);var radius=CSG.parseOptionAsFloat(options,"radius",1);var direction=p2.minus(p1);var defaultnormal;if(Math.abs(direction.x)>Math.abs(direction.y)){defaultnormal=new CSG.Vector3D(0,1,0)}else{defaultnormal=new CSG.Vector3D(1,0,0)}var normal=CSG.parseOptionAs3DVector(options,"normal",defaultnormal);var resolution=CSG.parseOptionAsInt(options,"resolution",CSG.defaultResolution3D);if(resolution<4)resolution=4;var polygons=[];var qresolution=Math.floor(.25*resolution);var length=direction.length();if(length<1e-10){return CSG.sphere({center:p1,radius:radius,resolution:resolution})}var zvector=direction.unit().times(radius);var xvector=zvector.cross(normal).unit().times(radius);var yvector=xvector.cross(zvector).unit().times(radius);var prevcylinderpoint;for(var slice1=0;slice1<=resolution;slice1++){var angle=Math.PI*2*slice1/resolution;var cylinderpoint=xvector.times(Math.cos(angle)).plus(yvector.times(Math.sin(angle)));if(slice1>0){var vertices=[];vertices.push(new CSG.Vertex(p1.plus(cylinderpoint)));vertices.push(new CSG.Vertex(p1.plus(prevcylinderpoint)));vertices.push(new CSG.Vertex(p2.plus(prevcylinderpoint)));vertices.push(new CSG.Vertex(p2.plus(cylinderpoint)));polygons.push(new CSG.Polygon(vertices));var prevcospitch,prevsinpitch;for(var slice2=0;slice2<=qresolution;slice2++){var pitch=.5*Math.PI*slice2/qresolution;var cospitch=Math.cos(pitch);var sinpitch=Math.sin(pitch);if(slice2>0){vertices=[];vertices.push(new CSG.Vertex(p1.plus(prevcylinderpoint.times(prevcospitch).minus(zvector.times(prevsinpitch)))));vertices.push(new CSG.Vertex(p1.plus(cylinderpoint.times(prevcospitch).minus(zvector.times(prevsinpitch)))));if(slice2<qresolution){vertices.push(new CSG.Vertex(p1.plus(cylinderpoint.times(cospitch).minus(zvector.times(sinpitch)))))}vertices.push(new CSG.Vertex(p1.plus(prevcylinderpoint.times(cospitch).minus(zvector.times(sinpitch)))));polygons.push(new CSG.Polygon(vertices));vertices=[];vertices.push(new CSG.Vertex(p2.plus(prevcylinderpoint.times(prevcospitch).plus(zvector.times(prevsinpitch)))));vertices.push(new CSG.Vertex(p2.plus(cylinderpoint.times(prevcospitch).plus(zvector.times(prevsinpitch)))));if(slice2<qresolution){vertices.push(new CSG.Vertex(p2.plus(cylinderpoint.times(cospitch).plus(zvector.times(sinpitch)))))}vertices.push(new CSG.Vertex(p2.plus(prevcylinderpoint.times(cospitch).plus(zvector.times(sinpitch)))));vertices.reverse();polygons.push(new CSG.Polygon(vertices))}prevcospitch=cospitch;prevsinpitch=sinpitch}}prevcylinderpoint=cylinderpoint}var result=CSG.fromPolygons(polygons);var ray=zvector.unit();var axisX=xvector.unit();result.properties.roundedCylinder=new CSG.Properties;result.properties.roundedCylinder.start=new CSG.Connector(p1,ray.negated(),axisX);result.properties.roundedCylinder.end=new CSG.Connector(p2,ray,axisX);result.properties.roundedCylinder.facepoint=p1.plus(xvector);return result};CSG.roundedCube=function(options){var EPS=1e-5;var minRR=.01;var center,cuberadius;options=options||{};if("corner1"in options||"corner2"in options){if("center"in options||"radius"in options){throw new Error("roundedCube: should either give a radius and center parameter, or a corner1 and corner2 parameter")}corner1=CSG.parseOptionAs3DVector(options,"corner1",[0,0,0]);corner2=CSG.parseOptionAs3DVector(options,"corner2",[1,1,1]);center=corner1.plus(corner2).times(.5);cuberadius=corner2.minus(corner1).times(.5)}else{center=CSG.parseOptionAs3DVector(options,"center",[0,0,0]);cuberadius=CSG.parseOptionAs3DVector(options,"radius",[1,1,1])}cuberadius=cuberadius.abs();var resolution=CSG.parseOptionAsInt(options,"resolution",CSG.defaultResolution3D);if(resolution<4)resolution=4;if(resolution%2==1&&resolution<8)resolution=8;var roundradius=CSG.parseOptionAs3DVector(options,"roundradius",[.2,.2,.2]);roundradius=CSG.Vector3D.Create(Math.max(roundradius.x,minRR),Math.max(roundradius.y,minRR),Math.max(roundradius.z,minRR));var innerradius=cuberadius.minus(roundradius);if(innerradius.x<0||innerradius.y<0||innerradius.z<0){throw"roundradius <= radius!"}var res=CSG.sphere({radius:1,resolution:resolution});res=res.scale(roundradius);innerradius.x>EPS&&(res=res.stretchAtPlane([1,0,0],[0,0,0],2*innerradius.x));innerradius.y>EPS&&(res=res.stretchAtPlane([0,1,0],[0,0,0],2*innerradius.y));innerradius.z>EPS&&(res=res.stretchAtPlane([0,0,1],[0,0,0],2*innerradius.z));res=res.translate([-innerradius.x+center.x,-innerradius.y+center.y,-innerradius.z+center.z]);res=res.reTesselated();res.properties.roundedCube=new CSG.Properties;res.properties.roundedCube.center=new CSG.Vertex(center);res.properties.roundedCube.facecenters=[new CSG.Connector(new CSG.Vector3D([cuberadius.x,0,0]).plus(center),[1,0,0],[0,0,1]),new CSG.Connector(new CSG.Vector3D([-cuberadius.x,0,0]).plus(center),[-1,0,0],[0,0,1]),new CSG.Connector(new CSG.Vector3D([0,cuberadius.y,0]).plus(center),[0,1,0],[0,0,1]),new CSG.Connector(new CSG.Vector3D([0,-cuberadius.y,0]).plus(center),[0,-1,0],[0,0,1]),new CSG.Connector(new CSG.Vector3D([0,0,cuberadius.z]).plus(center),[0,0,1],[1,0,0]),new CSG.Connector(new CSG.Vector3D([0,0,-cuberadius.z]).plus(center),[0,0,-1],[1,0,0])];return res};CSG.polyhedron=function(options){options=options||{};if("points"in options!=="faces"in options){throw new Error("polyhedron needs \'points\' and \'faces\' arrays")}var vertices=CSG.parseOptionAs3DVectorList(options,"points",[[1,1,0],[1,-1,0],[-1,-1,0],[-1,1,0],[0,0,1]]).map(function(pt){return new CSG.Vertex(pt)});var faces=CSG.parseOption(options,"faces",[[0,1,4],[1,2,4],[2,3,4],[3,0,4],[1,0,3],[2,1,3]]);faces.forEach(function(face){face.reverse()});var polygons=faces.map(function(face){return new CSG.Polygon(face.map(function(idx){return vertices[idx]}))});return CSG.fromPolygons(polygons).reTesselated()};CSG.IsFloat=function(n){return!isNaN(n)||n===Infinity||n===-Infinity};CSG.solve2Linear=function(a,b,c,d,u,v){var det=a*d-b*c;var invdet=1/det;var x=u*d-b*v;var y=-u*c+a*v;x*=invdet;y*=invdet;return[x,y]};CSG.Vector3D=function(x,y,z){if(arguments.length==3){this._x=parseFloat(x);this._y=parseFloat(y);this._z=parseFloat(z)}else if(arguments.length==2){this._x=parseFloat(x);this._y=parseFloat(y);this._z=0}else{var ok=true;if(arguments.length==1){if(typeof x=="object"){if(x instanceof CSG.Vector3D){this._x=x._x;this._y=x._y;this._z=x._z}else if(x instanceof CSG.Vector2D){this._x=x._x;this._y=x._y;this._z=0}else if(x instanceof Array){if(x.length<2||x.length>3){ok=false}else{this._x=parseFloat(x[0]);this._y=parseFloat(x[1]);if(x.length==3){this._z=parseFloat(x[2])}else{this._z=0}}}else if("x"in x&&"y"in x){this._x=parseFloat(x.x);this._y=parseFloat(x.y);if("z"in x){this._z=parseFloat(x.z)}else{this._z=0}}else ok=false}else{var v=parseFloat(x);this._x=v;this._y=v;this._z=v}}else ok=false;if(ok){if(!CSG.IsFloat(this._x)||!CSG.IsFloat(this._y)||!CSG.IsFloat(this._z))ok=false}if(!ok){throw new Error("wrong arguments")}}};CSG.Vector3D.Create=function(x,y,z){var result=Object.create(CSG.Vector3D.prototype);result._x=x;result._y=y;result._z=z;return result};CSG.Vector3D.prototype={get x(){return this._x},get y(){return this._y},get z(){return this._z},set x(v){throw new Error("Vector3D is immutable")},set y(v){throw new Error("Vector3D is immutable")},set z(v){throw new Error("Vector3D is immutable")},clone:function(){return CSG.Vector3D.Create(this._x,this._y,this._z)},negated:function(){return CSG.Vector3D.Create(-this._x,-this._y,-this._z)},abs:function(){return CSG.Vector3D.Create(Math.abs(this._x),Math.abs(this._y),Math.abs(this._z))},plus:function(a){return CSG.Vector3D.Create(this._x+a._x,this._y+a._y,this._z+a._z)},minus:function(a){return CSG.Vector3D.Create(this._x-a._x,this._y-a._y,this._z-a._z)},times:function(a){return CSG.Vector3D.Create(this._x*a,this._y*a,this._z*a)},dividedBy:function(a){return CSG.Vector3D.Create(this._x/a,this._y/a,this._z/a)},dot:function(a){return this._x*a._x+this._y*a._y+this._z*a._z},lerp:function(a,t){return this.plus(a.minus(this).times(t))},lengthSquared:function(){return this.dot(this)},length:function(){return Math.sqrt(this.lengthSquared())},unit:function(){return this.dividedBy(this.length())},cross:function(a){return CSG.Vector3D.Create(this._y*a._z-this._z*a._y,this._z*a._x-this._x*a._z,this._x*a._y-this._y*a._x)},distanceTo:function(a){return this.minus(a).length()},distanceToSquared:function(a){return this.minus(a).lengthSquared()},equals:function(a){return this._x==a._x&&this._y==a._y&&this._z==a._z},multiply4x4:function(matrix4x4){return matrix4x4.leftMultiply1x3Vector(this)},transform:function(matrix4x4){return matrix4x4.leftMultiply1x3Vector(this)},toString:function(){return"("+this._x.toFixed(2)+", "+this._y.toFixed(2)+", "+this._z.toFixed(2)+")"},randomNonParallelVector:function(){var abs=this.abs();if(abs._x<=abs._y&&abs._x<=abs._z){return CSG.Vector3D.Create(1,0,0)}else if(abs._y<=abs._x&&abs._y<=abs._z){return CSG.Vector3D.Create(0,1,0)}else{return CSG.Vector3D.Create(0,0,1)}},min:function(p){return CSG.Vector3D.Create(Math.min(this._x,p._x),Math.min(this._y,p._y),Math.min(this._z,p._z))},max:function(p){return CSG.Vector3D.Create(Math.max(this._x,p._x),Math.max(this._y,p._y),Math.max(this._z,p._z))}};CSG.Vertex=function(pos){this.pos=pos};CSG.Vertex.fromObject=function(obj){var pos=new CSG.Vector3D(obj.pos);return new CSG.Vertex(pos)};CSG.Vertex.prototype={flipped:function(){return this},getTag:function(){var result=this.tag;if(!result){result=CSG.getTag();this.tag=result}return result},interpolate:function(other,t){var newpos=this.pos.lerp(other.pos,t);return new CSG.Vertex(newpos)},transform:function(matrix4x4){var newpos=this.pos.multiply4x4(matrix4x4);return new CSG.Vertex(newpos)},toString:function(){return this.pos.toString()}};CSG.Plane=function(normal,w){this.normal=normal;this.w=w};CSG.Plane.fromObject=function(obj){var normal=new CSG.Vector3D(obj.normal);var w=parseFloat(obj.w);return new CSG.Plane(normal,w)};CSG.Plane.EPSILON=1e-5;CSG.Plane.fromVector3Ds=function(a,b,c){var n=b.minus(a).cross(c.minus(a)).unit();return new CSG.Plane(n,n.dot(a))};CSG.Plane.anyPlaneFromVector3Ds=function(a,b,c){var v1=b.minus(a);var v2=c.minus(a);if(v1.length()<1e-5){v1=v2.randomNonParallelVector()}if(v2.length()<1e-5){v2=v1.randomNonParallelVector()}var normal=v1.cross(v2);if(normal.length()<1e-5){v2=v1.randomNonParallelVector();normal=v1.cross(v2)}normal=normal.unit();return new CSG.Plane(normal,normal.dot(a))};CSG.Plane.fromPoints=function(a,b,c){a=new CSG.Vector3D(a);b=new CSG.Vector3D(b);c=new CSG.Vector3D(c);return CSG.Plane.fromVector3Ds(a,b,c)};CSG.Plane.fromNormalAndPoint=function(normal,point){normal=new CSG.Vector3D(normal);point=new CSG.Vector3D(point);normal=normal.unit();var w=point.dot(normal);return new CSG.Plane(normal,w)};CSG.Plane.prototype={flipped:function(){return new CSG.Plane(this.normal.negated(),-this.w)},getTag:function(){var result=this.tag;if(!result){result=CSG.getTag();this.tag=result}return result},equals:function(n){return this.normal.equals(n.normal)&&this.w==n.w},transform:function(matrix4x4){var ismirror=matrix4x4.isMirroring();var r=this.normal.randomNonParallelVector();var u=this.normal.cross(r);var v=this.normal.cross(u);var point1=this.normal.times(this.w);var point2=point1.plus(u);var point3=point1.plus(v);point1=point1.multiply4x4(matrix4x4);point2=point2.multiply4x4(matrix4x4);point3=point3.multiply4x4(matrix4x4);var newplane=CSG.Plane.fromVector3Ds(point1,point2,point3);if(ismirror){newplane=newplane.flipped()}return newplane},splitPolygon:function(polygon){var result={type:null,front:null,back:null};var planenormal=this.normal;var vertices=polygon.vertices;var numvertices=vertices.length;if(polygon.plane.equals(this)){result.type=0}else{var EPS=CSG.Plane.EPSILON;var thisw=this.w;var hasfront=false;var hasback=false;var vertexIsBack=[];var MINEPS=-EPS;for(var i=0;i<numvertices;i++){var t=planenormal.dot(vertices[i].pos)-thisw;var isback=t<0;vertexIsBack.push(isback);if(t>EPS)hasfront=true;if(t<MINEPS)hasback=true}if(!hasfront&&!hasback){var t=planenormal.dot(polygon.plane.normal);result.type=t>=0?0:1}else if(!hasback){result.type=2}else if(!hasfront){result.type=3}else{result.type=4;var frontvertices=[],backvertices=[];var isback=vertexIsBack[0];for(var vertexindex=0;vertexindex<numvertices;vertexindex++){var vertex=vertices[vertexindex];var nextvertexindex=vertexindex+1;if(nextvertexindex>=numvertices)nextvertexindex=0;var nextisback=vertexIsBack[nextvertexindex];if(isback==nextisback){if(isback){backvertices.push(vertex)}else{frontvertices.push(vertex)}}else{var point=vertex.pos;var nextpoint=vertices[nextvertexindex].pos;var intersectionpoint=this.splitLineBetweenPoints(point,nextpoint);var intersectionvertex=new CSG.Vertex(intersectionpoint);if(isback){backvertices.push(vertex);backvertices.push(intersectionvertex);frontvertices.push(intersectionvertex)}else{frontvertices.push(vertex);frontvertices.push(intersectionvertex);backvertices.push(intersectionvertex)}}isback=nextisback}var EPS_SQUARED=CSG.Plane.EPSILON*CSG.Plane.EPSILON;if(backvertices.length>=3){var prevvertex=backvertices[backvertices.length-1];for(var vertexindex=0;vertexindex<backvertices.length;vertexindex++){var vertex=backvertices[vertexindex];if(vertex.pos.distanceToSquared(prevvertex.pos)<EPS_SQUARED){backvertices.splice(vertexindex,1);vertexindex--}prevvertex=vertex}}if(frontvertices.length>=3){var prevvertex=frontvertices[frontvertices.length-1];for(var vertexindex=0;vertexindex<frontvertices.length;vertexindex++){var vertex=frontvertices[vertexindex];if(vertex.pos.distanceToSquared(prevvertex.pos)<EPS_SQUARED){frontvertices.splice(vertexindex,1);vertexindex--}prevvertex=vertex}}if(frontvertices.length>=3){result.front=new CSG.Polygon(frontvertices,polygon.shared,polygon.plane)}if(backvertices.length>=3){result.back=new CSG.Polygon(backvertices,polygon.shared,polygon.plane)}}}return result},splitLineBetweenPoints:function(p1,p2){var direction=p2.minus(p1);var labda=(this.w-this.normal.dot(p1))/this.normal.dot(direction);if(isNaN(labda))labda=0;if(labda>1)labda=1;if(labda<0)labda=0;var result=p1.plus(direction.times(labda));return result},intersectWithLine:function(line3d){return line3d.intersectWithPlane(this)},intersectWithPlane:function(plane){return CSG.Line3D.fromPlanes(this,plane)},signedDistanceToPoint:function(point){var t=this.normal.dot(point)-this.w;return t},toString:function(){return"[normal: "+this.normal.toString()+", w: "+this.w+"]"},mirrorPoint:function(point3d){var distance=this.signedDistanceToPoint(point3d);var mirrored=point3d.minus(this.normal.times(distance*2));return mirrored}};CSG.Polygon=function(vertices,shared,plane){this.vertices=vertices;if(!shared)shared=CSG.Polygon.defaultShared;this.shared=shared;if(arguments.length>=3){this.plane=plane}else{this.plane=CSG.Plane.fromVector3Ds(vertices[0].pos,vertices[1].pos,vertices[2].pos)}if(_CSGDEBUG){this.checkIfConvex()}};CSG.Polygon.fromObject=function(obj){var vertices=obj.vertices.map(function(v){return CSG.Vertex.fromObject(v)});var shared=CSG.Polygon.Shared.fromObject(obj.shared);var plane=CSG.Plane.fromObject(obj.plane);return new CSG.Polygon(vertices,shared,plane)};CSG.Polygon.prototype={checkIfConvex:function(){if(!CSG.Polygon.verticesConvex(this.vertices,this.plane.normal)){CSG.Polygon.verticesConvex(this.vertices,this.plane.normal);throw new Error("Not convex!")}},setColor:function(args){var newshared=CSG.Polygon.Shared.fromColor.apply(this,arguments);this.shared=newshared;return this},getSignedVolume:function(){var signedVolume=0;for(var i=0;i<this.vertices.length-2;i++){signedVolume+=this.vertices[0].pos.dot(this.vertices[i+1].pos.cross(this.vertices[i+2].pos))}signedVolume/=6;return signedVolume},getArea:function(){var polygonArea=0;for(var i=0;i<this.vertices.length-2;i++){polygonArea+=this.vertices[i+1].pos.minus(this.vertices[0].pos).cross(this.vertices[i+2].pos.minus(this.vertices[i+1].pos)).length()}polygonArea/=2;return polygonArea},getTetraFeatures:function(features){var result=[];features.forEach(function(feature){if(feature=="volume"){result.push(this.getSignedVolume())}else if(feature=="area"){result.push(this.getArea())}},this);return result},extrude:function(offsetvector){var newpolygons=[];var polygon1=this;var direction=polygon1.plane.normal.dot(offsetvector);if(direction>0){polygon1=polygon1.flipped()}newpolygons.push(polygon1);var polygon2=polygon1.translate(offsetvector);var numvertices=this.vertices.length;for(var i=0;i<numvertices;i++){var sidefacepoints=[];var nexti=i<numvertices-1?i+1:0;sidefacepoints.push(polygon1.vertices[i].pos);sidefacepoints.push(polygon2.vertices[i].pos);sidefacepoints.push(polygon2.vertices[nexti].pos);sidefacepoints.push(polygon1.vertices[nexti].pos);var sidefacepolygon=CSG.Polygon.createFromPoints(sidefacepoints,this.shared);newpolygons.push(sidefacepolygon)}polygon2=polygon2.flipped();newpolygons.push(polygon2);return CSG.fromPolygons(newpolygons)},translate:function(offset){return this.transform(CSG.Matrix4x4.translation(offset))},boundingSphere:function(){if(!this.cachedBoundingSphere){var box=this.boundingBox();var middle=box[0].plus(box[1]).times(.5);var radius3=box[1].minus(middle);var radius=radius3.length();this.cachedBoundingSphere=[middle,radius]}return this.cachedBoundingSphere},boundingBox:function(){if(!this.cachedBoundingBox){var minpoint,maxpoint;var vertices=this.vertices;var numvertices=vertices.length;if(numvertices===0){minpoint=new CSG.Vector3D(0,0,0)}else{minpoint=vertices[0].pos}maxpoint=minpoint;for(var i=1;i<numvertices;i++){var point=vertices[i].pos;minpoint=minpoint.min(point);maxpoint=maxpoint.max(point)}this.cachedBoundingBox=[minpoint,maxpoint]}return this.cachedBoundingBox},flipped:function(){var newvertices=this.vertices.map(function(v){return v.flipped()});newvertices.reverse();var newplane=this.plane.flipped();return new CSG.Polygon(newvertices,this.shared,newplane)},transform:function(matrix4x4){var newvertices=this.vertices.map(function(v){return v.transform(matrix4x4)});var newplane=this.plane.transform(matrix4x4);if(matrix4x4.isMirroring()){newvertices.reverse()}return new CSG.Polygon(newvertices,this.shared,newplane)},toString:function(){var result="Polygon plane: "+this.plane.toString()+"\\n";this.vertices.map(function(vertex){result+="  "+vertex.toString()+"\\n"});return result},projectToOrthoNormalBasis:function(orthobasis){var points2d=this.vertices.map(function(vertex){return orthobasis.to2D(vertex.pos)});var result=CAG.fromPointsNoCheck(points2d);var area=result.area();if(Math.abs(area)<1e-5){result=new CAG}else if(area<0){result=result.flipped()}return result},solidFromSlices:function(options){var polygons=[],csg=null,prev=null,bottom=null,top=null,numSlices=2,bLoop=false,fnCallback,flipped=null;if(options){bLoop=Boolean(options["loop"]);if(options.numslices)numSlices=options.numslices;if(options.callback)fnCallback=options.callback}if(!fnCallback){var square=new CSG.Polygon.createFromPoints([[0,0,0],[1,0,0],[1,1,0],[0,1,0]]);fnCallback=function(t,slice){return t==0||t==1?square.translate([0,0,t]):null}}for(var i=0,iMax=numSlices-1;i<=iMax;i++){csg=fnCallback.call(this,i/iMax,i);if(csg){if(!(csg instanceof CSG.Polygon)){throw new Error("CSG.Polygon.solidFromSlices callback error: CSG.Polygon expected")}csg.checkIfConvex();if(prev){if(flipped===null){flipped=prev.plane.signedDistanceToPoint(csg.vertices[0].pos)<0}this._addWalls(polygons,prev,csg,flipped)}else{bottom=csg}prev=csg}}top=csg;if(bLoop){var bSameTopBottom=bottom.vertices.length==top.vertices.length&&bottom.vertices.every(function(v,index){return v.pos.equals(top.vertices[index].pos)});if(!bSameTopBottom){this._addWalls(polygons,top,bottom,flipped)}}else{polygons.unshift(flipped?bottom:bottom.flipped());polygons.push(flipped?top.flipped():top)}return CSG.fromPolygons(polygons)},_addWalls:function(walls,bottom,top,bFlipped){var bottomPoints=bottom.vertices.slice(0),topPoints=top.vertices.slice(0),color=top.shared||null;if(!bottomPoints[0].pos.equals(bottomPoints[bottomPoints.length-1].pos)){bottomPoints.push(bottomPoints[0])}if(!topPoints[0].pos.equals(topPoints[topPoints.length-1].pos)){topPoints.push(topPoints[0])}if(bFlipped){bottomPoints=bottomPoints.reverse();topPoints=topPoints.reverse()}var iTopLen=topPoints.length-1,iBotLen=bottomPoints.length-1,iExtra=iTopLen-iBotLen,bMoreTops=iExtra>0,bMoreBottoms=iExtra<0;var aMin=[];for(var i=Math.abs(iExtra);i>0;i--){aMin.push({len:Infinity,index:-1})}var len;if(bMoreBottoms){for(var i=0;i<iBotLen;i++){len=bottomPoints[i].pos.distanceToSquared(bottomPoints[i+1].pos);for(var j=aMin.length-1;j>=0;j--){if(aMin[j].len>len){aMin[j].len=len;aMin.index=j;break}}}}else if(bMoreTops){for(var i=0;i<iTopLen;i++){len=topPoints[i].pos.distanceToSquared(topPoints[i+1].pos);for(var j=aMin.length-1;j>=0;j--){if(aMin[j].len>len){aMin[j].len=len;aMin.index=j;break}}}}aMin.sort(fnSortByIndex);var getTriangle=function addWallsPutTriangle(pointA,pointB,pointC,color){return new CSG.Polygon([pointA,pointB,pointC],color)};var bpoint=bottomPoints[0],tpoint=topPoints[0],secondPoint,nBotFacet,nTopFacet;for(var iB=0,iT=0,iMax=iTopLen+iBotLen;iB+iT<iMax;){if(aMin.length){if(bMoreTops&&iT==aMin[0].index){secondPoint=topPoints[++iT];walls.push(getTriangle(secondPoint,tpoint,bpoint,color));tpoint=secondPoint;aMin.shift();continue}else if(bMoreBottoms&&iB==aMin[0].index){secondPoint=bottomPoints[++iB];walls.push(getTriangle(tpoint,bpoint,secondPoint,color));bpoint=secondPoint;aMin.shift();continue}}if(iB<iBotLen){nBotFacet=tpoint.pos.distanceToSquared(bottomPoints[iB+1].pos)}else{nBotFacet=Infinity}if(iT<iTopLen){nTopFacet=bpoint.pos.distanceToSquared(topPoints[iT+1].pos)}else{nTopFacet=Infinity}if(nBotFacet<=nTopFacet){secondPoint=bottomPoints[++iB];walls.push(getTriangle(tpoint,bpoint,secondPoint,color));bpoint=secondPoint}else if(iT<iTopLen){secondPoint=topPoints[++iT];walls.push(getTriangle(secondPoint,tpoint,bpoint,color));tpoint=secondPoint}}return walls}};CSG.Polygon.verticesConvex=function(vertices,planenormal){var numvertices=vertices.length;if(numvertices>2){var prevprevpos=vertices[numvertices-2].pos;var prevpos=vertices[numvertices-1].pos;for(var i=0;i<numvertices;i++){var pos=vertices[i].pos;if(!CSG.Polygon.isConvexPoint(prevprevpos,prevpos,pos,planenormal)){return false}prevprevpos=prevpos;prevpos=pos}}return true};CSG.Polygon.createFromPoints=function(points,shared,plane){var normal;if(arguments.length<3){normal=new CSG.Vector3D(0,0,0)}else{normal=plane.normal}var vertices=[];points.map(function(p){var vec=new CSG.Vector3D(p);var vertex=new CSG.Vertex(vec);vertices.push(vertex)});var polygon;if(arguments.length<3){polygon=new CSG.Polygon(vertices,shared)}else{polygon=new CSG.Polygon(vertices,shared,plane)}return polygon};CSG.Polygon.isConvexPoint=function(prevpoint,point,nextpoint,normal){var crossproduct=point.minus(prevpoint).cross(nextpoint.minus(point));var crossdotnormal=crossproduct.dot(normal);return crossdotnormal>=0};CSG.Polygon.isStrictlyConvexPoint=function(prevpoint,point,nextpoint,normal){var crossproduct=point.minus(prevpoint).cross(nextpoint.minus(point));var crossdotnormal=crossproduct.dot(normal);return crossdotnormal>=1e-5};CSG.Polygon.Shared=function(color){if(color!==null){if(color.length!=4){throw new Error("Expecting 4 element array")}}this.color=color};CSG.Polygon.Shared.fromObject=function(obj){return new CSG.Polygon.Shared(obj.color)};CSG.Polygon.Shared.fromColor=function(args){var color;if(arguments.length==1){color=arguments[0].slice()}else{color=[];for(var i=0;i<arguments.length;i++){color.push(arguments[i])}}if(color.length==3){color.push(1)}else if(color.length!=4){throw new Error("setColor expects either an array with 3 or 4 elements, or 3 or 4 parameters.")}return new CSG.Polygon.Shared(color)};CSG.Polygon.Shared.prototype={getTag:function(){var result=this.tag;if(!result){result=CSG.getTag();this.tag=result}return result},getHash:function(){if(!this.color)return"null";return this.color.join("/")}};CSG.Polygon.defaultShared=new CSG.Polygon.Shared(null);CSG.PolygonTreeNode=function(){this.parent=null;this.children=[];this.polygon=null;this.removed=false};CSG.PolygonTreeNode.prototype={addPolygons:function(polygons){if(!this.isRootNode())throw new Error("Assertion failed");var _this=this;polygons.map(function(polygon){_this.addChild(polygon)})},remove:function(){if(!this.removed){this.removed=true;if(_CSGDEBUG){if(this.isRootNode())throw new Error("Assertion failed");if(this.children.length)throw new Error("Assertion failed")}var parentschildren=this.parent.children;var i=parentschildren.indexOf(this);if(i<0)throw new Error("Assertion failed");parentschildren.splice(i,1);this.parent.recursivelyInvalidatePolygon()}},isRemoved:function(){return this.removed},isRootNode:function(){return!this.parent},invert:function(){if(!this.isRootNode())throw new Error("Assertion failed");this.invertSub()},getPolygon:function(){if(!this.polygon)throw new Error("Assertion failed");return this.polygon},getPolygons:function(result){var children=[this];var queue=[children];var i,j,l,node;for(i=0;i<queue.length;++i){children=queue[i];for(j=0,l=children.length;j<l;j++){node=children[j];if(node.polygon){result.push(node.polygon)}else{queue.push(node.children)}}}},splitByPlane:function(plane,coplanarfrontnodes,coplanarbacknodes,frontnodes,backnodes){if(this.children.length){var queue=[this.children],i,j,l,node,nodes;for(i=0;i<queue.length;i++){nodes=queue[i];for(j=0,l=nodes.length;j<l;j++){node=nodes[j];if(node.children.length){queue.push(node.children)}else{node._splitByPlane(plane,coplanarfrontnodes,coplanarbacknodes,frontnodes,backnodes)}}}}else{this._splitByPlane(plane,coplanarfrontnodes,coplanarbacknodes,frontnodes,backnodes)}},_splitByPlane:function(plane,coplanarfrontnodes,coplanarbacknodes,frontnodes,backnodes){var polygon=this.polygon;if(polygon){var bound=polygon.boundingSphere();var sphereradius=bound[1]+1e-4;var planenormal=plane.normal;var spherecenter=bound[0];var d=planenormal.dot(spherecenter)-plane.w;if(d>sphereradius){frontnodes.push(this)}else if(d<-sphereradius){backnodes.push(this)}else{var splitresult=plane.splitPolygon(polygon);switch(splitresult.type){case 0:coplanarfrontnodes.push(this);break;case 1:coplanarbacknodes.push(this);break;case 2:frontnodes.push(this);break;case 3:backnodes.push(this);break;case 4:if(splitresult.front){var frontnode=this.addChild(splitresult.front);frontnodes.push(frontnode)}if(splitresult.back){var backnode=this.addChild(splitresult.back);backnodes.push(backnode)}break}}}},addChild:function(polygon){var newchild=new CSG.PolygonTreeNode;newchild.parent=this;newchild.polygon=polygon;this.children.push(newchild);return newchild},invertSub:function(){var children=[this];var queue=[children];var i,j,l,node;for(i=0;i<queue.length;i++){children=queue[i];for(j=0,l=children.length;j<l;j++){node=children[j];if(node.polygon){node.polygon=node.polygon.flipped()}queue.push(node.children)}}},recursivelyInvalidatePolygon:function(){var node=this;while(node.polygon){node.polygon=null;if(node.parent){node=node.parent}}}};CSG.Tree=function(polygons){this.polygonTree=new CSG.PolygonTreeNode;this.rootnode=new CSG.Node(null);if(polygons)this.addPolygons(polygons)};CSG.Tree.prototype={invert:function(){this.polygonTree.invert();this.rootnode.invert()},clipTo:function(tree,alsoRemovecoplanarFront){alsoRemovecoplanarFront=alsoRemovecoplanarFront?true:false;this.rootnode.clipTo(tree,alsoRemovecoplanarFront)},allPolygons:function(){var result=[];this.polygonTree.getPolygons(result);return result},addPolygons:function(polygons){var _this=this;var polygontreenodes=polygons.map(function(p){return _this.polygonTree.addChild(p)});this.rootnode.addPolygonTreeNodes(polygontreenodes)}};CSG.Node=function(parent){this.plane=null;this.front=null;this.back=null;this.polygontreenodes=[];this.parent=parent};CSG.Node.prototype={invert:function(){var queue=[this];var i,node;for(var i=0;i<queue.length;i++){node=queue[i];if(node.plane)node.plane=node.plane.flipped();if(node.front)queue.push(node.front);if(node.back)queue.push(node.back);var temp=node.front;node.front=node.back;node.back=temp}},clipPolygons:function(polygontreenodes,alsoRemovecoplanarFront){var args={node:this,polygontreenodes:polygontreenodes};var node;var stack=[];do{node=args.node;polygontreenodes=args.polygontreenodes;if(node.plane){var backnodes=[];var frontnodes=[];var coplanarfrontnodes=alsoRemovecoplanarFront?backnodes:frontnodes;var plane=node.plane;var numpolygontreenodes=polygontreenodes.length;for(i=0;i<numpolygontreenodes;i++){var node1=polygontreenodes[i];if(!node1.isRemoved()){node1.splitByPlane(plane,coplanarfrontnodes,backnodes,frontnodes,backnodes)}}if(node.front&&frontnodes.length>0){'
workerscript += 'stack.push({node:node.front,polygontreenodes:frontnodes})}var numbacknodes=backnodes.length;if(node.back&&numbacknodes>0){stack.push({node:node.back,polygontreenodes:backnodes})}else{for(var i=0;i<numbacknodes;i++){backnodes[i].remove()}}}args=stack.pop()}while(typeof args!=="undefined")},clipTo:function(tree,alsoRemovecoplanarFront){var node=this,stack=[];do{if(node.polygontreenodes.length>0){tree.rootnode.clipPolygons(node.polygontreenodes,alsoRemovecoplanarFront)}if(node.front)stack.push(node.front);if(node.back)stack.push(node.back);node=stack.pop()}while(typeof node!=="undefined")},addPolygonTreeNodes:function(polygontreenodes){var args={node:this,polygontreenodes:polygontreenodes};var node;var stack=[];do{node=args.node;polygontreenodes=args.polygontreenodes;if(polygontreenodes.length===0){args=stack.pop();continue}var _this=node;if(!node.plane){var bestplane=polygontreenodes[0].getPolygon().plane;node.plane=bestplane}var frontnodes=[];var backnodes=[];for(var i=0,n=polygontreenodes.length;i<n;++i){polygontreenodes[i].splitByPlane(_this.plane,_this.polygontreenodes,backnodes,frontnodes,backnodes)}if(frontnodes.length>0){if(!node.front)node.front=new CSG.Node(node);stack.push({node:node.front,polygontreenodes:frontnodes})}if(backnodes.length>0){if(!node.back)node.back=new CSG.Node(node);stack.push({node:node.back,polygontreenodes:backnodes})}args=stack.pop()}while(typeof args!=="undefined")},getParentPlaneNormals:function(normals,maxdepth){if(maxdepth>0){if(this.parent){normals.push(this.parent.plane.normal);this.parent.getParentPlaneNormals(normals,maxdepth-1)}}}};CSG.Matrix4x4=function(elements){if(arguments.length>=1){this.elements=elements}else{this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};CSG.Matrix4x4.prototype={plus:function(m){var r=[];for(var i=0;i<16;i++){r[i]=this.elements[i]+m.elements[i]}return new CSG.Matrix4x4(r)},minus:function(m){var r=[];for(var i=0;i<16;i++){r[i]=this.elements[i]-m.elements[i]}return new CSG.Matrix4x4(r)},multiply:function(m){var this0=this.elements[0];var this1=this.elements[1];var this2=this.elements[2];var this3=this.elements[3];var this4=this.elements[4];var this5=this.elements[5];var this6=this.elements[6];var this7=this.elements[7];var this8=this.elements[8];var this9=this.elements[9];var this10=this.elements[10];var this11=this.elements[11];var this12=this.elements[12];var this13=this.elements[13];var this14=this.elements[14];var this15=this.elements[15];var m0=m.elements[0];var m1=m.elements[1];var m2=m.elements[2];var m3=m.elements[3];var m4=m.elements[4];var m5=m.elements[5];var m6=m.elements[6];var m7=m.elements[7];var m8=m.elements[8];var m9=m.elements[9];var m10=m.elements[10];var m11=m.elements[11];var m12=m.elements[12];var m13=m.elements[13];var m14=m.elements[14];var m15=m.elements[15];var result=[];result[0]=this0*m0+this1*m4+this2*m8+this3*m12;result[1]=this0*m1+this1*m5+this2*m9+this3*m13;result[2]=this0*m2+this1*m6+this2*m10+this3*m14;result[3]=this0*m3+this1*m7+this2*m11+this3*m15;result[4]=this4*m0+this5*m4+this6*m8+this7*m12;result[5]=this4*m1+this5*m5+this6*m9+this7*m13;result[6]=this4*m2+this5*m6+this6*m10+this7*m14;result[7]=this4*m3+this5*m7+this6*m11+this7*m15;result[8]=this8*m0+this9*m4+this10*m8+this11*m12;result[9]=this8*m1+this9*m5+this10*m9+this11*m13;result[10]=this8*m2+this9*m6+this10*m10+this11*m14;result[11]=this8*m3+this9*m7+this10*m11+this11*m15;result[12]=this12*m0+this13*m4+this14*m8+this15*m12;result[13]=this12*m1+this13*m5+this14*m9+this15*m13;result[14]=this12*m2+this13*m6+this14*m10+this15*m14;result[15]=this12*m3+this13*m7+this14*m11+this15*m15;return new CSG.Matrix4x4(result)},clone:function(){var elements=this.elements.map(function(p){return p});return new CSG.Matrix4x4(elements)},rightMultiply1x3Vector:function(v){var v0=v._x;var v1=v._y;var v2=v._z;var v3=1;var x=v0*this.elements[0]+v1*this.elements[1]+v2*this.elements[2]+v3*this.elements[3];var y=v0*this.elements[4]+v1*this.elements[5]+v2*this.elements[6]+v3*this.elements[7];var z=v0*this.elements[8]+v1*this.elements[9]+v2*this.elements[10]+v3*this.elements[11];var w=v0*this.elements[12]+v1*this.elements[13]+v2*this.elements[14]+v3*this.elements[15];if(w!=1){var invw=1/w;x*=invw;y*=invw;z*=invw}return new CSG.Vector3D(x,y,z)},leftMultiply1x3Vector:function(v){var v0=v._x;var v1=v._y;var v2=v._z;var v3=1;var x=v0*this.elements[0]+v1*this.elements[4]+v2*this.elements[8]+v3*this.elements[12];var y=v0*this.elements[1]+v1*this.elements[5]+v2*this.elements[9]+v3*this.elements[13];var z=v0*this.elements[2]+v1*this.elements[6]+v2*this.elements[10]+v3*this.elements[14];var w=v0*this.elements[3]+v1*this.elements[7]+v2*this.elements[11]+v3*this.elements[15];if(w!=1){var invw=1/w;x*=invw;y*=invw;z*=invw}return new CSG.Vector3D(x,y,z)},rightMultiply1x2Vector:function(v){var v0=v.x;var v1=v.y;var v2=0;var v3=1;var x=v0*this.elements[0]+v1*this.elements[1]+v2*this.elements[2]+v3*this.elements[3];var y=v0*this.elements[4]+v1*this.elements[5]+v2*this.elements[6]+v3*this.elements[7];var z=v0*this.elements[8]+v1*this.elements[9]+v2*this.elements[10]+v3*this.elements[11];var w=v0*this.elements[12]+v1*this.elements[13]+v2*this.elements[14]+v3*this.elements[15];if(w!=1){var invw=1/w;x*=invw;y*=invw;z*=invw}return new CSG.Vector2D(x,y)},leftMultiply1x2Vector:function(v){var v0=v.x;var v1=v.y;var v2=0;var v3=1;var x=v0*this.elements[0]+v1*this.elements[4]+v2*this.elements[8]+v3*this.elements[12];var y=v0*this.elements[1]+v1*this.elements[5]+v2*this.elements[9]+v3*this.elements[13];var z=v0*this.elements[2]+v1*this.elements[6]+v2*this.elements[10]+v3*this.elements[14];var w=v0*this.elements[3]+v1*this.elements[7]+v2*this.elements[11]+v3*this.elements[15];if(w!=1){var invw=1/w;x*=invw;y*=invw;z*=invw}return new CSG.Vector2D(x,y)},isMirroring:function(){var u=new CSG.Vector3D(this.elements[0],this.elements[4],this.elements[8]);var v=new CSG.Vector3D(this.elements[1],this.elements[5],this.elements[9]);var w=new CSG.Vector3D(this.elements[2],this.elements[6],this.elements[10]);var mirrorvalue=u.cross(v).dot(w);var ismirror=mirrorvalue<0;return ismirror}};CSG.Matrix4x4.unity=function(){return new CSG.Matrix4x4};CSG.Matrix4x4.rotationX=function(degrees){var radians=degrees*Math.PI*(1/180);var cos=Math.cos(radians);var sin=Math.sin(radians);var els=[1,0,0,0,0,cos,sin,0,0,-sin,cos,0,0,0,0,1];return new CSG.Matrix4x4(els)};CSG.Matrix4x4.rotationY=function(degrees){var radians=degrees*Math.PI*(1/180);var cos=Math.cos(radians);var sin=Math.sin(radians);var els=[cos,0,-sin,0,0,1,0,0,sin,0,cos,0,0,0,0,1];return new CSG.Matrix4x4(els)};CSG.Matrix4x4.rotationZ=function(degrees){var radians=degrees*Math.PI*(1/180);var cos=Math.cos(radians);var sin=Math.sin(radians);var els=[cos,sin,0,0,-sin,cos,0,0,0,0,1,0,0,0,0,1];return new CSG.Matrix4x4(els)};CSG.Matrix4x4.rotation=function(rotationCenter,rotationAxis,degrees){rotationCenter=new CSG.Vector3D(rotationCenter);rotationAxis=new CSG.Vector3D(rotationAxis);var rotationPlane=CSG.Plane.fromNormalAndPoint(rotationAxis,rotationCenter);var orthobasis=new CSG.OrthoNormalBasis(rotationPlane);var transformation=CSG.Matrix4x4.translation(rotationCenter.negated());transformation=transformation.multiply(orthobasis.getProjectionMatrix());transformation=transformation.multiply(CSG.Matrix4x4.rotationZ(degrees));transformation=transformation.multiply(orthobasis.getInverseProjectionMatrix());transformation=transformation.multiply(CSG.Matrix4x4.translation(rotationCenter));return transformation};CSG.Matrix4x4.translation=function(v){var vec=new CSG.Vector3D(v);var els=[1,0,0,0,0,1,0,0,0,0,1,0,vec.x,vec.y,vec.z,1];return new CSG.Matrix4x4(els)};CSG.Matrix4x4.mirroring=function(plane){var nx=plane.normal.x;var ny=plane.normal.y;var nz=plane.normal.z;var w=plane.w;var els=[1-2*nx*nx,-2*ny*nx,-2*nz*nx,0,-2*nx*ny,1-2*ny*ny,-2*nz*ny,0,-2*nx*nz,-2*ny*nz,1-2*nz*nz,0,-2*nx*w,-2*ny*w,-2*nz*w,1];return new CSG.Matrix4x4(els)};CSG.Matrix4x4.scaling=function(v){var vec=new CSG.Vector3D(v);var els=[vec.x,0,0,0,0,vec.y,0,0,0,0,vec.z,0,0,0,0,1];return new CSG.Matrix4x4(els)};CSG.Vector2D=function(x,y){if(arguments.length==2){this._x=parseFloat(x);this._y=parseFloat(y)}else{var ok=true;if(arguments.length==1){if(typeof x=="object"){if(x instanceof CSG.Vector2D){this._x=x._x;this._y=x._y}else if(x instanceof Array){this._x=parseFloat(x[0]);this._y=parseFloat(x[1])}else if("x"in x&&"y"in x){this._x=parseFloat(x.x);this._y=parseFloat(x.y)}else ok=false}else{var v=parseFloat(x);this._x=v;this._y=v}}else ok=false;if(ok){if(!CSG.IsFloat(this._x)||!CSG.IsFloat(this._y))ok=false}if(!ok){throw new Error("wrong arguments")}}};CSG.Vector2D.fromAngle=function(radians){return CSG.Vector2D.fromAngleRadians(radians)};CSG.Vector2D.fromAngleDegrees=function(degrees){var radians=Math.PI*degrees/180;return CSG.Vector2D.fromAngleRadians(radians)};CSG.Vector2D.fromAngleRadians=function(radians){return CSG.Vector2D.Create(Math.cos(radians),Math.sin(radians))};CSG.Vector2D.Create=function(x,y){var result=Object.create(CSG.Vector2D.prototype);result._x=x;result._y=y;return result};CSG.Vector2D.prototype={get x(){return this._x},get y(){return this._y},set x(v){throw new Error("Vector2D is immutable")},set y(v){throw new Error("Vector2D is immutable")},toVector3D:function(z){return new CSG.Vector3D(this._x,this._y,z)},equals:function(a){return this._x==a._x&&this._y==a._y},clone:function(){return CSG.Vector2D.Create(this._x,this._y)},negated:function(){return CSG.Vector2D.Create(-this._x,-this._y)},plus:function(a){return CSG.Vector2D.Create(this._x+a._x,this._y+a._y)},minus:function(a){return CSG.Vector2D.Create(this._x-a._x,this._y-a._y)},times:function(a){return CSG.Vector2D.Create(this._x*a,this._y*a)},dividedBy:function(a){return CSG.Vector2D.Create(this._x/a,this._y/a)},dot:function(a){return this._x*a._x+this._y*a._y},lerp:function(a,t){return this.plus(a.minus(this).times(t))},length:function(){return Math.sqrt(this.dot(this))},distanceTo:function(a){return this.minus(a).length()},distanceToSquared:function(a){return this.minus(a).lengthSquared()},lengthSquared:function(){return this.dot(this)},unit:function(){return this.dividedBy(this.length())},cross:function(a){return this._x*a._y-this._y*a._x},normal:function(){return CSG.Vector2D.Create(this._y,-this._x)},multiply4x4:function(matrix4x4){return matrix4x4.leftMultiply1x2Vector(this)},transform:function(matrix4x4){return matrix4x4.leftMultiply1x2Vector(this)},angle:function(){return this.angleRadians()},angleDegrees:function(){var radians=this.angleRadians();return 180*radians/Math.PI},angleRadians:function(){return Math.atan2(this._y,this._x)},min:function(p){return CSG.Vector2D.Create(Math.min(this._x,p._x),Math.min(this._y,p._y))},max:function(p){return CSG.Vector2D.Create(Math.max(this._x,p._x),Math.max(this._y,p._y))},toString:function(){return"("+this._x.toFixed(2)+", "+this._y.toFixed(2)+")"},abs:function(){return CSG.Vector2D.Create(Math.abs(this._x),Math.abs(this._y))}};CSG.Line2D=function(normal,w){normal=new CSG.Vector2D(normal);w=parseFloat(w);var l=normal.length();w*=l;normal=normal.times(1/l);this.normal=normal;this.w=w};CSG.Line2D.fromPoints=function(p1,p2){p1=new CSG.Vector2D(p1);p2=new CSG.Vector2D(p2);var direction=p2.minus(p1);var normal=direction.normal().negated().unit();var w=p1.dot(normal);return new CSG.Line2D(normal,w)};CSG.Line2D.prototype={reverse:function(){return new CSG.Line2D(this.normal.negated(),-this.w)},equals:function(l){return l.normal.equals(this.normal)&&l.w==this.w},origin:function(){return this.normal.times(this.w)},direction:function(){return this.normal.normal()},xAtY:function(y){var x=(this.w-this.normal._y*y)/this.normal.x;return x},absDistanceToPoint:function(point){point=new CSG.Vector2D(point);var point_projected=point.dot(this.normal);var distance=Math.abs(point_projected-this.w);return distance},intersectWithLine:function(line2d){var point=CSG.solve2Linear(this.normal.x,this.normal.y,line2d.normal.x,line2d.normal.y,this.w,line2d.w);point=new CSG.Vector2D(point);return point},transform:function(matrix4x4){var origin=new CSG.Vector2D(0,0);var pointOnPlane=this.normal.times(this.w);var neworigin=origin.multiply4x4(matrix4x4);var neworiginPlusNormal=this.normal.multiply4x4(matrix4x4);var newnormal=neworiginPlusNormal.minus(neworigin);var newpointOnPlane=pointOnPlane.multiply4x4(matrix4x4);var neww=newnormal.dot(newpointOnPlane);return new CSG.Line2D(newnormal,neww)}};CSG.Line3D=function(point,direction){point=new CSG.Vector3D(point);direction=new CSG.Vector3D(direction);this.point=point;this.direction=direction.unit()};CSG.Line3D.fromPoints=function(p1,p2){p1=new CSG.Vector3D(p1);p2=new CSG.Vector3D(p2);var direction=p2.minus(p1);return new CSG.Line3D(p1,direction)};CSG.Line3D.fromPlanes=function(p1,p2){var direction=p1.normal.cross(p2.normal);var l=direction.length();if(l<1e-10){throw new Error("Parallel planes")}direction=direction.times(1/l);var mabsx=Math.abs(direction.x);var mabsy=Math.abs(direction.y);var mabsz=Math.abs(direction.z);var origin;if(mabsx>=mabsy&&mabsx>=mabsz){var r=CSG.solve2Linear(p1.normal.y,p1.normal.z,p2.normal.y,p2.normal.z,p1.w,p2.w);origin=new CSG.Vector3D(0,r[0],r[1])}else if(mabsy>=mabsx&&mabsy>=mabsz){var r=CSG.solve2Linear(p1.normal.x,p1.normal.z,p2.normal.x,p2.normal.z,p1.w,p2.w);origin=new CSG.Vector3D(r[0],0,r[1])}else{var r=CSG.solve2Linear(p1.normal.x,p1.normal.y,p2.normal.x,p2.normal.y,p1.w,p2.w);origin=new CSG.Vector3D(r[0],r[1],0)}return new CSG.Line3D(origin,direction)};CSG.Line3D.prototype={intersectWithPlane:function(plane){var labda=(plane.w-plane.normal.dot(this.point))/plane.normal.dot(this.direction);var point=this.point.plus(this.direction.times(labda));return point},clone:function(line){return new CSG.Line3D(this.point.clone(),this.direction.clone())},reverse:function(){return new CSG.Line3D(this.point.clone(),this.direction.negated())},transform:function(matrix4x4){var newpoint=this.point.multiply4x4(matrix4x4);var pointPlusDirection=this.point.plus(this.direction);var newPointPlusDirection=pointPlusDirection.multiply4x4(matrix4x4);var newdirection=newPointPlusDirection.minus(newpoint);return new CSG.Line3D(newpoint,newdirection)},closestPointOnLine:function(point){point=new CSG.Vector3D(point);var t=point.minus(this.point).dot(this.direction)/this.direction.dot(this.direction);var closestpoint=this.point.plus(this.direction.times(t));return closestpoint},distanceToPoint:function(point){point=new CSG.Vector3D(point);var closestpoint=this.closestPointOnLine(point);var distancevector=point.minus(closestpoint);var distance=distancevector.length();return distance},equals:function(line3d){if(!this.direction.equals(line3d.direction))return false;var distance=this.distanceToPoint(line3d.point);if(distance>1e-8)return false;return true}};CSG.OrthoNormalBasis=function(plane,rightvector){if(arguments.length<2){rightvector=plane.normal.randomNonParallelVector()}else{rightvector=new CSG.Vector3D(rightvector)}this.v=plane.normal.cross(rightvector).unit();this.u=this.v.cross(plane.normal);this.plane=plane;this.planeorigin=plane.normal.times(plane.w)};CSG.OrthoNormalBasis.GetCartesian=function(xaxisid,yaxisid){var axisid=xaxisid+"/"+yaxisid;var planenormal,rightvector;if(axisid=="X/Y"){planenormal=[0,0,1];rightvector=[1,0,0]}else if(axisid=="Y/-X"){planenormal=[0,0,1];rightvector=[0,1,0]}else if(axisid=="-X/-Y"){planenormal=[0,0,1];rightvector=[-1,0,0]}else if(axisid=="-Y/X"){planenormal=[0,0,1];rightvector=[0,-1,0]}else if(axisid=="-X/Y"){planenormal=[0,0,-1];rightvector=[-1,0,0]}else if(axisid=="-Y/-X"){planenormal=[0,0,-1];rightvector=[0,-1,0]}else if(axisid=="X/-Y"){planenormal=[0,0,-1];rightvector=[1,0,0]}else if(axisid=="Y/X"){planenormal=[0,0,-1];rightvector=[0,1,0]}else if(axisid=="X/Z"){planenormal=[0,-1,0];rightvector=[1,0,0]}else if(axisid=="Z/-X"){planenormal=[0,-1,0];rightvector=[0,0,1]}else if(axisid=="-X/-Z"){planenormal=[0,-1,0];rightvector=[-1,0,0]}else if(axisid=="-Z/X"){planenormal=[0,-1,0];rightvector=[0,0,-1]}else if(axisid=="-X/Z"){planenormal=[0,1,0];rightvector=[-1,0,0]}else if(axisid=="-Z/-X"){planenormal=[0,1,0];rightvector=[0,0,-1]}else if(axisid=="X/-Z"){planenormal=[0,1,0];rightvector=[1,0,0]}else if(axisid=="Z/X"){planenormal=[0,1,0];rightvector=[0,0,1]}else if(axisid=="Y/Z"){planenormal=[1,0,0];rightvector=[0,1,0]}else if(axisid=="Z/-Y"){planenormal=[1,0,0];rightvector=[0,0,1]}else if(axisid=="-Y/-Z"){planenormal=[1,0,0];rightvector=[0,-1,0]}else if(axisid=="-Z/Y"){planenormal=[1,0,0];rightvector=[0,0,-1]}else if(axisid=="-Y/Z"){planenormal=[-1,0,0];rightvector=[0,-1,0]}else if(axisid=="-Z/-Y"){planenormal=[-1,0,0];rightvector=[0,0,-1]}else if(axisid=="Y/-Z"){planenormal=[-1,0,0];rightvector=[0,1,0]}else if(axisid=="Z/Y"){planenormal=[-1,0,0];rightvector=[0,0,1]}else{throw new Error("CSG.OrthoNormalBasis.GetCartesian: invalid combination of axis identifiers. Should pass two string arguments from [X,Y,Z,-X,-Y,-Z], being two different axes.")}return new CSG.OrthoNormalBasis(new CSG.Plane(new CSG.Vector3D(planenormal),0),new CSG.Vector3D(rightvector))};CSG.OrthoNormalBasis.Z0Plane=function(){var plane=new CSG.Plane(new CSG.Vector3D([0,0,1]),0);return new CSG.OrthoNormalBasis(plane,new CSG.Vector3D([1,0,0]))};CSG.OrthoNormalBasis.prototype={getProjectionMatrix:function(){return new CSG.Matrix4x4([this.u.x,this.v.x,this.plane.normal.x,0,this.u.y,this.v.y,this.plane.normal.y,0,this.u.z,this.v.z,this.plane.normal.z,0,0,0,-this.plane.w,1])},getInverseProjectionMatrix:function(){var p=this.plane.normal.times(this.plane.w);return new CSG.Matrix4x4([this.u.x,this.u.y,this.u.z,0,this.v.x,this.v.y,this.v.z,0,this.plane.normal.x,this.plane.normal.y,this.plane.normal.z,0,p.x,p.y,p.z,1])},to2D:function(vec3){return new CSG.Vector2D(vec3.dot(this.u),vec3.dot(this.v))},to3D:function(vec2){return this.planeorigin.plus(this.u.times(vec2.x)).plus(this.v.times(vec2.y))},line3Dto2D:function(line3d){var a=line3d.point;var b=line3d.direction.plus(a);var a2d=this.to2D(a);var b2d=this.to2D(b);return CSG.Line2D.fromPoints(a2d,b2d)},line2Dto3D:function(line2d){var a=line2d.origin();var b=line2d.direction().plus(a);var a3d=this.to3D(a);var b3d=this.to3D(b);return CSG.Line3D.fromPoints(a3d,b3d)},transform:function(matrix4x4){var newplane=this.plane.transform(matrix4x4);var rightpoint_transformed=this.u.transform(matrix4x4);var origin_transformed=new CSG.Vector3D(0,0,0).transform(matrix4x4);var newrighthandvector=rightpoint_transformed.minus(origin_transformed);var newbasis=new CSG.OrthoNormalBasis(newplane,newrighthandvector);return newbasis}};function insertSorted(array,element,comparefunc){var leftbound=0;var rightbound=array.length;while(rightbound>leftbound){var testindex=Math.floor((leftbound+rightbound)/2);var testelement=array[testindex];var compareresult=comparefunc(element,testelement);if(compareresult>0){leftbound=testindex+1}else{rightbound=testindex}}array.splice(leftbound,0,element)}CSG.interpolateBetween2DPointsForY=function(point1,point2,y){var f1=y-point1.y;var f2=point2.y-point1.y;if(f2<0){f1=-f1;f2=-f2}var t;if(f1<=0){t=0}else if(f1>=f2){t=1}else if(f2<1e-10){t=.5}else{t=f1/f2}var result=point1.x+t*(point2.x-point1.x);return result};CSG.reTesselateCoplanarPolygons=function(sourcepolygons,destpolygons){var EPS=1e-5;var numpolygons=sourcepolygons.length;if(numpolygons>0){var plane=sourcepolygons[0].plane;var shared=sourcepolygons[0].shared;var orthobasis=new CSG.OrthoNormalBasis(plane);var polygonvertices2d=[];var polygontopvertexindexes=[];var topy2polygonindexes={};var ycoordinatetopolygonindexes={};var xcoordinatebins={};var ycoordinatebins={};var ycoordinateBinningFactor=1/EPS*10;for(var polygonindex=0;polygonindex<numpolygons;polygonindex++){var poly3d=sourcepolygons[polygonindex];var vertices2d=[];var numvertices=poly3d.vertices.length;var minindex=-1;if(numvertices>0){var miny,maxy,maxindex;for(var i=0;i<numvertices;i++){var pos2d=orthobasis.to2D(poly3d.vertices[i].pos);var ycoordinatebin=Math.floor(pos2d.y*ycoordinateBinningFactor);var newy;if(ycoordinatebin in ycoordinatebins){newy=ycoordinatebins[ycoordinatebin]}else if(ycoordinatebin+1 in ycoordinatebins){newy=ycoordinatebins[ycoordinatebin+1]}else if(ycoordinatebin-1 in ycoordinatebins){newy=ycoordinatebins[ycoordinatebin-1]}else{newy=pos2d.y;ycoordinatebins[ycoordinatebin]=pos2d.y}pos2d=CSG.Vector2D.Create(pos2d.x,newy);vertices2d.push(pos2d);var y=pos2d.y;if(i===0||y<miny){miny=y;minindex=i}if(i===0||y>maxy){maxy=y;maxindex=i}if(!(y in ycoordinatetopolygonindexes)){ycoordinatetopolygonindexes[y]={}}ycoordinatetopolygonindexes[y][polygonindex]=true}if(miny>=maxy){vertices2d=[];numvertices=0;minindex=-1}else{if(!(miny in topy2polygonindexes)){topy2polygonindexes[miny]=[]}topy2polygonindexes[miny].push(polygonindex)}}vertices2d.reverse();minindex=numvertices-minindex-1;polygonvertices2d.push(vertices2d);polygontopvertexindexes.push(minindex)}var ycoordinates=[];for(var ycoordinate in ycoordinatetopolygonindexes)ycoordinates.push(ycoordinate);ycoordinates.sort(fnNumberSort);var activepolygons=[];var prevoutpolygonrow=[];for(var yindex=0;yindex<ycoordinates.length;yindex++){var newoutpolygonrow=[];var ycoordinate_as_string=ycoordinates[yindex];var ycoordinate=Number(ycoordinate_as_string);var polygonindexeswithcorner=ycoordinatetopolygonindexes[ycoordinate_as_string];for(var activepolygonindex=0;activepolygonindex<activepolygons.length;++activepolygonindex){var activepolygon=activepolygons[activepolygonindex];var polygonindex=activepolygon.polygonindex;if(polygonindexeswithcorner[polygonindex]){var vertices2d=polygonvertices2d[polygonindex];var numvertices=vertices2d.length;var newleftvertexindex=activepolygon.leftvertexindex;var newrightvertexindex=activepolygon.rightvertexindex;while(true){var nextleftvertexindex=newleftvertexindex+1;if(nextleftvertexindex>=numvertices)nextleftvertexindex=0;if(vertices2d[nextleftvertexindex].y!=ycoordinate)break;newleftvertexindex=nextleftvertexindex}var nextrightvertexindex=newrightvertexindex-1;if(nextrightvertexindex<0)nextrightvertexindex=numvertices-1;if(vertices2d[nextrightvertexindex].y==ycoordinate){newrightvertexindex=nextrightvertexindex}if(newleftvertexindex!=activepolygon.leftvertexindex&&newleftvertexindex==newrightvertexindex){activepolygons.splice(activepolygonindex,1);--activepolygonindex}else{activepolygon.leftvertexindex=newleftvertexindex;activepolygon.rightvertexindex=newrightvertexindex;activepolygon.topleft=vertices2d[newleftvertexindex];activepolygon.topright=vertices2d[newrightvertexindex];var nextleftvertexindex=newleftvertexindex+1;if(nextleftvertexindex>=numvertices)nextleftvertexindex=0;activepolygon.bottomleft=vertices2d[nextleftvertexindex];var nextrightvertexindex=newrightvertexindex-1;if(nextrightvertexindex<0)nextrightvertexindex=numvertices-1;activepolygon.bottomright=vertices2d[nextrightvertexindex]}}}var nextycoordinate;if(yindex>=ycoordinates.length-1){activepolygons=[];nextycoordinate=null}else{nextycoordinate=Number(ycoordinates[yindex+1]);var middleycoordinate=.5*(ycoordinate+nextycoordinate);var startingpolygonindexes=topy2polygonindexes[ycoordinate_as_string];for(var polygonindex_key in startingpolygonindexes){var polygonindex=startingpolygonindexes[polygonindex_key];var vertices2d=polygonvertices2d[polygonindex];var numvertices=vertices2d.length;var topvertexindex=polygontopvertexindexes[polygonindex];var topleftvertexindex=topvertexindex;while(true){var i=topleftvertexindex+1;if(i>=numvertices)i=0;if(vertices2d[i].y!=ycoordinate)break;if(i==topvertexindex)break;topleftvertexindex=i}var toprightvertexindex=topvertexindex;while(true){var i=toprightvertexindex-1;if(i<0)i=numvertices-1;if(vertices2d[i].y!=ycoordinate)break;if(i==topleftvertexindex)break;toprightvertexindex=i}var nextleftvertexindex=topleftvertexindex+1;if(nextleftvertexindex>=numvertices)nextleftvertexindex=0;var nextrightvertexindex=toprightvertexindex-1;if(nextrightvertexindex<0)nextrightvertexindex=numvertices-1;var newactivepolygon={polygonindex:polygonindex,leftvertexindex:topleftvertexindex,rightvertexindex:toprightvertexindex,topleft:vertices2d[topleftvertexindex],topright:vertices2d[toprightvertexindex],bottomleft:vertices2d[nextleftvertexindex],bottomright:vertices2d[nextrightvertexindex]};insertSorted(activepolygons,newactivepolygon,function(el1,el2){var x1=CSG.interpolateBetween2DPointsForY(el1.topleft,el1.bottomleft,middleycoordinate);var x2=CSG.interpolateBetween2DPointsForY(el2.topleft,el2.bottomleft,middleycoordinate);if(x1>x2)return 1;if(x1<x2)return-1;return 0})}}if(true){for(var activepolygon_key in activepolygons){var activepolygon=activepolygons[activepolygon_key];var polygonindex=activepolygon.polygonindex;var vertices2d=polygonvertices2d[polygonindex];var numvertices=vertices2d.length;var x=CSG.interpolateBetween2DPointsForY(activepolygon.topleft,activepolygon.bottomleft,ycoordinate);var topleft=CSG.Vector2D.Create(x,ycoordinate);x=CSG.interpolateBetween2DPointsForY(activepolygon.topright,activepolygon.bottomright,ycoordinate);var topright=CSG.Vector2D.Create(x,ycoordinate);x=CSG.interpolateBetween2DPointsForY(activepolygon.topleft,activepolygon.bottomleft,nextycoordinate);var bottomleft=CSG.Vector2D.Create(x,nextycoordinate);x=CSG.interpolateBetween2DPointsForY(activepolygon.topright,activepolygon.bottomright,nextycoordinate);var bottomright=CSG.Vector2D.Create(x,nextycoordinate);var outpolygon={topleft:topleft,topright:topright,bottomleft:bottomleft,bottomright:bottomright,leftline:CSG.Line2D.fromPoints(topleft,bottomleft),rightline:CSG.Line2D.fromPoints(bottomright,topright)};if(newoutpolygonrow.length>0){var prevoutpolygon=newoutpolygonrow[newoutpolygonrow.length-1];var d1=outpolygon.topleft.distanceTo(prevoutpolygon.topright);var d2=outpolygon.bottomleft.distanceTo(prevoutpolygon.bottomright);if(d1<EPS&&d2<EPS){outpolygon.topleft=prevoutpolygon.topleft;outpolygon.leftline=prevoutpolygon.leftline;outpolygon.bottomleft=prevoutpolygon.bottomleft;newoutpolygonrow.splice(newoutpolygonrow.length-1,1)}}newoutpolygonrow.push(outpolygon)}if(yindex>0){var prevcontinuedindexes={};var matchedindexes={};for(var i=0;i<newoutpolygonrow.length;i++){var thispolygon=newoutpolygonrow[i];for(var ii=0;ii<prevoutpolygonrow.length;ii++){if(!matchedindexes[ii]){var prevpolygon=prevoutpolygonrow[ii];if(prevpolygon.bottomleft.distanceTo(thispolygon.topleft)<EPS){if(prevpolygon.bottomright.distanceTo(thispolygon.topright)<EPS){matchedindexes[ii]=true;var d1=thispolygon.leftline.direction().x-prevpolygon.leftline.direction().x;var d2=thispolygon.rightline.direction().x-prevpolygon.rightline.direction().x;var leftlinecontinues=Math.abs(d1)<EPS;var rightlinecontinues=Math.abs(d2)<EPS;var leftlineisconvex=leftlinecontinues||d1>=0;var rightlineisconvex=rightlinecontinues||d2>=0;if(leftlineisconvex&&rightlineisconvex){thispolygon.outpolygon=prevpolygon.outpolygon;thispolygon.leftlinecontinues=leftlinecontinues;thispolygon.rightlinecontinues=rightlinecontinues;prevcontinuedindexes[ii]=true}break}}}}}for(var ii=0;ii<prevoutpolygonrow.length;ii++){if(!prevcontinuedindexes[ii]){var prevpolygon=prevoutpolygonrow[ii];prevpolygon.outpolygon.rightpoints.push(prevpolygon.bottomright);if(prevpolygon.bottomright.distanceTo(prevpolygon.bottomleft)>EPS){prevpolygon.outpolygon.leftpoints.push(prevpolygon.bottomleft)}prevpolygon.outpolygon.leftpoints.reverse();var points2d=prevpolygon.outpolygon.rightpoints.concat(prevpolygon.outpolygon.leftpoints);var vertices3d=[];points2d.map(function(point2d){var point3d=orthobasis.to3D(point2d);var vertex3d=new CSG.Vertex(point3d);vertices3d.push(vertex3d)});var polygon=new CSG.Polygon(vertices3d,shared,plane);destpolygons.push(polygon)}}}for(var i=0;i<newoutpolygonrow.length;i++){var thispolygon=newoutpolygonrow[i];if(!thispolygon.outpolygon){thispolygon.outpolygon={leftpoints:[],rightpoints:[]};thispolygon.outpolygon.leftpoints.push(thispolygon.topleft);if(thispolygon.topleft.distanceTo(thispolygon.topright)>EPS){thispolygon.outpolygon.rightpoints.push(thispolygon.topright)}}else{if(!thispolygon.leftlinecontinues){thispolygon.outpolygon.leftpoints.push(thispolygon.topleft)}if(!thispolygon.rightlinecontinues){thispolygon.outpolygon.rightpoints.push(thispolygon.topright)}}}prevoutpolygonrow=newoutpolygonrow}}}};CSG.fuzzyFactory=function(numdimensions,tolerance){this.lookuptable={};this.multiplier=1/tolerance};CSG.fuzzyFactory.prototype={lookupOrCreate:function(els,creatorCallback){var hash="";var multiplier=this.multiplier;els.forEach(function(el){var valueQuantized=Math.round(el*multiplier);hash+=valueQuantized+"/"});if(hash in this.lookuptable){return this.lookuptable[hash]}else{var object=creatorCallback(els);var hashparts=els.map(function(el){var q0=Math.floor(el*multiplier);var q1=q0+1;return[""+q0+"/",""+q1+"/"]});var numelements=els.length;var numhashes=1<<numelements;for(var hashmask=0;hashmask<numhashes;++hashmask){var hashmask_shifted=hashmask;hash="";hashparts.forEach(function(hashpart){hash+=hashpart[hashmask_shifted&1];hashmask_shifted>>=1});this.lookuptable[hash]=object}return object}}};CSG.fuzzyCSGFactory=function(){this.vertexfactory=new CSG.fuzzyFactory(3,1e-5);this.planefactory=new CSG.fuzzyFactory(4,1e-5);this.polygonsharedfactory={}};CSG.fuzzyCSGFactory.prototype={getPolygonShared:function(sourceshared){var hash=sourceshared.getHash();if(hash in this.polygonsharedfactory){return this.polygonsharedfactory[hash]}else{this.polygonsharedfactory[hash]=sourceshared;return sourceshared}},getVertex:function(sourcevertex){var elements=[sourcevertex.pos._x,sourcevertex.pos._y,sourcevertex.pos._z];var result=this.vertexfactory.lookupOrCreate(elements,function(els){return sourcevertex});return result},getPlane:function(sourceplane){var elements=[sourceplane.normal._x,sourceplane.normal._y,sourceplane.normal._z,sourceplane.w];var result=this.planefactory.lookupOrCreate(elements,function(els){return sourceplane});return result},getPolygon:function(sourcepolygon){var newplane=this.getPlane(sourcepolygon.plane);var newshared=this.getPolygonShared(sourcepolygon.shared);var _this=this;var newvertices=sourcepolygon.vertices.map(function(vertex){return _this.getVertex(vertex)});var newvertices_dedup=[];if(newvertices.length>0){var prevvertextag=newvertices[newvertices.length-1].getTag();newvertices.forEach(function(vertex){var vertextag=vertex.getTag();if(vertextag!=prevvertextag){newvertices_dedup.push(vertex)}prevvertextag=vertextag})}if(newvertices_dedup.length<3){newvertices_dedup=[]}return new CSG.Polygon(newvertices_dedup,newshared,newplane)},getCSG:function(sourcecsg){var _this=this;var newpolygons=[];sourcecsg.polygons.forEach(function(polygon){var newpolygon=_this.getPolygon(polygon);if(newpolygon.vertices.length>=3){newpolygons.push(newpolygon)}});return CSG.fromPolygons(newpolygons)}};CSG.staticTag=1;CSG.getTag=function(){return CSG.staticTag++};CSG.Properties=function(){};CSG.Properties.prototype={_transform:function(matrix4x4){var result=new CSG.Properties;CSG.Properties.transformObj(this,result,matrix4x4);return result},_merge:function(otherproperties){var result=new CSG.Properties;CSG.Properties.cloneObj(this,result);CSG.Properties.addFrom(result,otherproperties);return result}};CSG.Properties.transformObj=function(source,result,matrix4x4){for(var propertyname in source){if(propertyname=="_transform")continue;if(propertyname=="_merge")continue;var propertyvalue=source[propertyname];var transformed=propertyvalue;if(typeof propertyvalue=="object"){if("transform"in propertyvalue&&typeof propertyvalue.transform=="function"){transformed=propertyvalue.transform(matrix4x4)}else if(propertyvalue instanceof Array){transformed=[];CSG.Properties.transformObj(propertyvalue,transformed,matrix4x4)}else if(propertyvalue instanceof CSG.Properties){transformed=new CSG.Properties;CSG.Properties.transformObj(propertyvalue,transformed,matrix4x4)}}result[propertyname]=transformed}};CSG.Properties.cloneObj=function(source,result){for(var propertyname in source){if(propertyname=="_transform")continue'
workerscript += ';if(propertyname=="_merge")continue;var propertyvalue=source[propertyname];var cloned=propertyvalue;if(typeof propertyvalue=="object"){if(propertyvalue instanceof Array){cloned=[];for(var i=0;i<propertyvalue.length;i++){cloned.push(propertyvalue[i])}}else if(propertyvalue instanceof CSG.Properties){cloned=new CSG.Properties;CSG.Properties.cloneObj(propertyvalue,cloned)}}result[propertyname]=cloned}};CSG.Properties.addFrom=function(result,otherproperties){for(var propertyname in otherproperties){if(propertyname=="_transform")continue;if(propertyname=="_merge")continue;if(propertyname in result&&typeof result[propertyname]=="object"&&result[propertyname]instanceof CSG.Properties&&typeof otherproperties[propertyname]=="object"&&otherproperties[propertyname]instanceof CSG.Properties){CSG.Properties.addFrom(result[propertyname],otherproperties[propertyname])}else if(!(propertyname in result)){result[propertyname]=otherproperties[propertyname]}}};CSG.Connector=function(point,axisvector,normalvector){this.point=new CSG.Vector3D(point);this.axisvector=new CSG.Vector3D(axisvector).unit();this.normalvector=new CSG.Vector3D(normalvector).unit()};CSG.Connector.prototype={normalized:function(){var axisvector=this.axisvector.unit();var n=this.normalvector.cross(axisvector).unit();var normalvector=axisvector.cross(n);return new CSG.Connector(this.point,axisvector,normalvector)},transform:function(matrix4x4){var point=this.point.multiply4x4(matrix4x4);var axisvector=this.point.plus(this.axisvector).multiply4x4(matrix4x4).minus(point);var normalvector=this.point.plus(this.normalvector).multiply4x4(matrix4x4).minus(point);return new CSG.Connector(point,axisvector,normalvector)},getTransformationTo:function(other,mirror,normalrotation){mirror=mirror?true:false;normalrotation=normalrotation?Number(normalrotation):0;var us=this.normalized();other=other.normalized();var transformation=CSG.Matrix4x4.translation(this.point.negated());var axesplane=CSG.Plane.anyPlaneFromVector3Ds(new CSG.Vector3D(0,0,0),us.axisvector,other.axisvector);var axesbasis=new CSG.OrthoNormalBasis(axesplane);var angle1=axesbasis.to2D(us.axisvector).angle();var angle2=axesbasis.to2D(other.axisvector).angle();var rotation=180*(angle2-angle1)/Math.PI;if(mirror)rotation+=180;transformation=transformation.multiply(axesbasis.getProjectionMatrix());transformation=transformation.multiply(CSG.Matrix4x4.rotationZ(rotation));transformation=transformation.multiply(axesbasis.getInverseProjectionMatrix());var usAxesAligned=us.transform(transformation);var normalsplane=CSG.Plane.fromNormalAndPoint(other.axisvector,new CSG.Vector3D(0,0,0));var normalsbasis=new CSG.OrthoNormalBasis(normalsplane);angle1=normalsbasis.to2D(usAxesAligned.normalvector).angle();angle2=normalsbasis.to2D(other.normalvector).angle();rotation=180*(angle2-angle1)/Math.PI;rotation+=normalrotation;transformation=transformation.multiply(normalsbasis.getProjectionMatrix());transformation=transformation.multiply(CSG.Matrix4x4.rotationZ(rotation));transformation=transformation.multiply(normalsbasis.getInverseProjectionMatrix());transformation=transformation.multiply(CSG.Matrix4x4.translation(other.point));return transformation},axisLine:function(){return new CSG.Line3D(this.point,this.axisvector)},extend:function(distance){var newpoint=this.point.plus(this.axisvector.unit().times(distance));return new CSG.Connector(newpoint,this.axisvector,this.normalvector)}};CSG.ConnectorList=function(connectors){this.connectors_=connectors?connectors.slice():[]};CSG.ConnectorList.defaultNormal=[0,0,1];CSG.ConnectorList.fromPath2D=function(path2D,arg1,arg2){if(arguments.length===3){return CSG.ConnectorList._fromPath2DTangents(path2D,arg1,arg2)}else if(arguments.length==2){return CSG.ConnectorList._fromPath2DExplicit(path2D,arg1)}else{throw"call with path2D and either 2 direction vectors, or a function returning direction vectors"}};CSG.ConnectorList._fromPath2DTangents=function(path2D,start,end){var axis;var pathLen=path2D.points.length;var result=new CSG.ConnectorList([new CSG.Connector(path2D.points[0],start,CSG.ConnectorList.defaultNormal)]);path2D.points.slice(1,pathLen-1).forEach(function(p2,i){axis=path2D.points[i+2].minus(path2D.points[i]).toVector3D(0);result.appendConnector(new CSG.Connector(p2.toVector3D(0),axis,CSG.ConnectorList.defaultNormal))},this);result.appendConnector(new CSG.Connector(path2D.points[pathLen-1],end,CSG.ConnectorList.defaultNormal));result.closed=path2D.closed;return result};CSG.ConnectorList._fromPath2DExplicit=function(path2D,angleIsh){function getAngle(angleIsh,pt,i){if(typeof angleIsh=="function"){angleIsh=angleIsh(pt,i)}return angleIsh}var result=new CSG.ConnectorList(path2D.points.map(function(p2,i){return new CSG.Connector(p2.toVector3D(0),CSG.Vector3D.Create(1,0,0).rotateZ(getAngle(angleIsh,p2,i)),CSG.ConnectorList.defaultNormal)},this));result.closed=path2D.closed;return result};CSG.ConnectorList.prototype={setClosed:function(bool){this.closed=!!closed},appendConnector:function(conn){this.connectors_.push(conn)},followWith:function(cagish){this.verify();function getCag(cagish,connector){if(typeof cagish=="function"){cagish=cagish(connector.point,connector.axisvector,connector.normalvector)}return cagish}var polygons=[],currCag;var prevConnector=this.connectors_[this.connectors_.length-1];var prevCag=getCag(cagish,prevConnector);this.connectors_.forEach(function(connector,notFirst){currCag=getCag(cagish,connector);if(notFirst||this.closed){polygons.push.apply(polygons,prevCag._toWallPolygons({toConnector1:prevConnector,toConnector2:connector,cag:currCag}))}else{polygons.push.apply(polygons,currCag._toPlanePolygons({toConnector:connector,flipped:true}))}if(notFirst==this.connectors_.length-1&&!this.closed){polygons.push.apply(polygons,currCag._toPlanePolygons({toConnector:connector}))}prevCag=currCag;prevConnector=connector},this);return CSG.fromPolygons(polygons).reTesselated().canonicalized()},verify:function(){var connI,connI1,dPosToAxis,axisToNextAxis;for(var i=0;i<this.connectors_.length-1;i++){connI=this.connectors_[i],connI1=this.connectors_[i+1];if(connI1.point.minus(connI.point).dot(connI.axisvector)<=0){throw"Invalid ConnectorList. Each connectors position needs to be within a <90deg range of previous connectors axisvector"}if(connI.axisvector.dot(connI1.axisvector)<=0){throw"invalid ConnectorList. No neighboring connectors axisvectors may span a >=90deg angle"}}}};CSG.Path2D=function(points,closed){closed=!!closed;points=points||[];var prevpoint=null;if(closed&&points.length>0){prevpoint=new CSG.Vector2D(points[points.length-1])}var newpoints=[];points.map(function(point){point=new CSG.Vector2D(point);var skip=false;if(prevpoint!==null){var distance=point.distanceTo(prevpoint);skip=distance<1e-5}if(!skip)newpoints.push(point);prevpoint=point});this.points=newpoints;this.closed=closed};CSG.Path2D.arc=function(options){var center=CSG.parseOptionAs2DVector(options,"center",0);var radius=CSG.parseOptionAsFloat(options,"radius",1);var startangle=CSG.parseOptionAsFloat(options,"startangle",0);var endangle=CSG.parseOptionAsFloat(options,"endangle",360);var resolution=CSG.parseOptionAsInt(options,"resolution",CSG.defaultResolution2D);var maketangent=CSG.parseOptionAsBool(options,"maketangent",false);while(endangle-startangle>=720){endangle-=360}while(endangle-startangle<=-720){endangle+=360}var points=[],point;var absangledif=Math.abs(endangle-startangle);if(absangledif<1e-5){point=CSG.Vector2D.fromAngle(startangle/180*Math.PI).times(radius);points.push(point.plus(center))}else{var numsteps=Math.floor(resolution*absangledif/360)+1;var edgestepsize=numsteps*.5/absangledif;if(edgestepsize>.25)edgestepsize=.25;var numsteps_mod=maketangent?numsteps+2:numsteps;for(var i=0;i<=numsteps_mod;i++){var step=i;if(maketangent){step=(i-1)*(numsteps-2*edgestepsize)/numsteps+edgestepsize;if(step<0)step=0;if(step>numsteps)step=numsteps}var angle=startangle+step*(endangle-startangle)/numsteps;point=CSG.Vector2D.fromAngle(angle/180*Math.PI).times(radius);points.push(point.plus(center))}}return new CSG.Path2D(points,false)};CSG.Path2D.prototype={concat:function(otherpath){if(this.closed||otherpath.closed){throw new Error("Paths must not be closed")}var newpoints=this.points.concat(otherpath.points);return new CSG.Path2D(newpoints)},appendPoint:function(point){if(this.closed){throw new Error("Path must not be closed")}point=new CSG.Vector2D(point);var newpoints=this.points.concat([point]);return new CSG.Path2D(newpoints)},appendPoints:function(points){if(this.closed){throw new Error("Path must not be closed")}var newpoints=this.points;points.forEach(function(point){newpoints.push(new CSG.Vector2D(point))});return new CSG.Path2D(newpoints)},close:function(){return new CSG.Path2D(this.points,true)},rectangularExtrude:function(width,height,resolution){var cag=this.expandToCAG(width/2,resolution);var result=cag.extrude({offset:[0,0,height]});return result},expandToCAG:function(pathradius,resolution){var sides=[];var numpoints=this.points.length;var startindex=0;if(this.closed&&numpoints>2)startindex=-1;var prevvertex;for(var i=startindex;i<numpoints;i++){var pointindex=i;if(pointindex<0)pointindex=numpoints-1;var point=this.points[pointindex];var vertex=new CAG.Vertex(point);if(i>startindex){var side=new CAG.Side(prevvertex,vertex);sides.push(side)}prevvertex=vertex}var shellcag=CAG.fromSides(sides);var expanded=shellcag.expandedShell(pathradius,resolution);return expanded},innerToCAG:function(){if(!this.closed)throw new Error("The path should be closed!");return CAG.fromPoints(this.points)},transform:function(matrix4x4){var newpoints=this.points.map(function(point){return point.multiply4x4(matrix4x4)});return new CSG.Path2D(newpoints,this.closed)},appendBezier:function(controlpoints,options){if(arguments.length<2){options={}}if(this.closed){throw new Error("Path must not be closed")}if(!(controlpoints instanceof Array)){throw new Error("appendBezier: should pass an array of control points")}if(controlpoints.length<1){throw new Error("appendBezier: need at least 1 control point")}if(this.points.length<1){throw new Error("appendBezier: path must already contain a point (the endpoint of the path is used as the starting point for the bezier curve)")}var resolution=CSG.parseOptionAsInt(options,"resolution",CSG.defaultResolution2D);if(resolution<4)resolution=4;var factorials=[];var controlpoints_parsed=[];controlpoints_parsed.push(this.points[this.points.length-1]);for(var i=0;i<controlpoints.length;++i){var p=controlpoints[i];if(p===null){if(i!=0){throw new Error("appendBezier: null can only be passed as the first control point")}if(controlpoints.length<2){throw new Error("appendBezier: null can only be passed if there is at least one more control point")}var lastBezierControlPoint;if("lastBezierControlPoint"in this){lastBezierControlPoint=this.lastBezierControlPoint}else{if(this.points.length<2){throw new Error("appendBezier: null is passed as a control point but this requires a previous bezier curve or at least two points in the existing path")}lastBezierControlPoint=this.points[this.points.length-2]}p=this.points[this.points.length-1].times(2).minus(lastBezierControlPoint)}else{p=new CSG.Vector2D(p)}controlpoints_parsed.push(p)}var bezier_order=controlpoints_parsed.length-1;var fact=1;for(var i=0;i<=bezier_order;++i){if(i>0)fact*=i;factorials.push(fact)}var binomials=[];for(var i=0;i<=bezier_order;++i){var binomial=factorials[bezier_order]/(factorials[i]*factorials[bezier_order-i]);binomials.push(binomial)}var getPointForT=function(t){var t_k=1;var one_minus_t_n_minus_k=Math.pow(1-t,bezier_order);var inv_1_minus_t=t!=1?1/(1-t):1;var point=new CSG.Vector2D(0,0);for(var k=0;k<=bezier_order;++k){if(k==bezier_order)one_minus_t_n_minus_k=1;var bernstein_coefficient=binomials[k]*t_k*one_minus_t_n_minus_k;point=point.plus(controlpoints_parsed[k].times(bernstein_coefficient));t_k*=t;one_minus_t_n_minus_k*=inv_1_minus_t}return point};var newpoints=[];var newpoints_t=[];var numsteps=bezier_order+1;for(var i=0;i<numsteps;++i){var t=i/(numsteps-1);var point=getPointForT(t);newpoints.push(point);newpoints_t.push(t)}var subdivide_base=1;var maxangle=Math.PI*2/resolution;var maxsinangle=Math.sin(maxangle);while(subdivide_base<newpoints.length-1){var dir1=newpoints[subdivide_base].minus(newpoints[subdivide_base-1]).unit();var dir2=newpoints[subdivide_base+1].minus(newpoints[subdivide_base]).unit();var sinangle=dir1.cross(dir2);if(Math.abs(sinangle)>maxsinangle){var t0=newpoints_t[subdivide_base-1];var t1=newpoints_t[subdivide_base+1];var t0_new=t0+(t1-t0)*1/3;var t1_new=t0+(t1-t0)*2/3;var point0_new=getPointForT(t0_new);var point1_new=getPointForT(t1_new);newpoints.splice(subdivide_base,1,point0_new,point1_new);newpoints_t.splice(subdivide_base,1,t0_new,t1_new);subdivide_base--;if(subdivide_base<1)subdivide_base=1}else{++subdivide_base}}newpoints=this.points.concat(newpoints.slice(1));var result=new CSG.Path2D(newpoints);result.lastBezierControlPoint=controlpoints_parsed[controlpoints_parsed.length-2];return result},appendArc:function(endpoint,options){if(arguments.length<2){options={}}if(this.closed){throw new Error("Path must not be closed")}if(this.points.length<1){throw new Error("appendArc: path must already contain a point (the endpoint of the path is used as the starting point for the arc)")}var resolution=CSG.parseOptionAsInt(options,"resolution",CSG.defaultResolution2D);if(resolution<4)resolution=4;var xradius,yradius;if("xradius"in options||"yradius"in options){if("radius"in options){throw new Error("Should either give an xradius and yradius parameter, or a radius parameter")}xradius=CSG.parseOptionAsFloat(options,"xradius",0);yradius=CSG.parseOptionAsFloat(options,"yradius",0)}else{xradius=CSG.parseOptionAsFloat(options,"radius",0);yradius=xradius}var xaxisrotation=CSG.parseOptionAsFloat(options,"xaxisrotation",0);var clockwise=CSG.parseOptionAsBool(options,"clockwise",false);var largearc=CSG.parseOptionAsBool(options,"large",false);var startpoint=this.points[this.points.length-1];endpoint=new CSG.Vector2D(endpoint);var sweep_flag=!clockwise;var newpoints=[];if(xradius==0||yradius==0){newpoints.push(endpoint)}else{xradius=Math.abs(xradius);yradius=Math.abs(yradius);var phi=xaxisrotation*Math.PI/180;var cosphi=Math.cos(phi);var sinphi=Math.sin(phi);var minushalfdistance=startpoint.minus(endpoint).times(.5);var start_translated=new CSG.Vector2D(cosphi*minushalfdistance.x+sinphi*minushalfdistance.y,-sinphi*minushalfdistance.x+cosphi*minushalfdistance.y);var biglambda=start_translated.x*start_translated.x/(xradius*xradius)+start_translated.y*start_translated.y/(yradius*yradius);if(biglambda>1){var sqrtbiglambda=Math.sqrt(biglambda);xradius*=sqrtbiglambda;yradius*=sqrtbiglambda}var multiplier1=Math.sqrt((xradius*xradius*yradius*yradius-xradius*xradius*start_translated.y*start_translated.y-yradius*yradius*start_translated.x*start_translated.x)/(xradius*xradius*start_translated.y*start_translated.y+yradius*yradius*start_translated.x*start_translated.x));if(sweep_flag==largearc)multiplier1=-multiplier1;var center_translated=new CSG.Vector2D(xradius*start_translated.y/yradius,-yradius*start_translated.x/xradius).times(multiplier1);var center=new CSG.Vector2D(cosphi*center_translated.x-sinphi*center_translated.y,sinphi*center_translated.x+cosphi*center_translated.y).plus(startpoint.plus(endpoint).times(.5));var vec1=new CSG.Vector2D((start_translated.x-center_translated.x)/xradius,(start_translated.y-center_translated.y)/yradius);var vec2=new CSG.Vector2D((-start_translated.x-center_translated.x)/xradius,(-start_translated.y-center_translated.y)/yradius);var theta1=vec1.angleRadians();var theta2=vec2.angleRadians();var deltatheta=theta2-theta1;deltatheta=deltatheta%(2*Math.PI);if(!sweep_flag&&deltatheta>0){deltatheta-=2*Math.PI}else if(sweep_flag&&deltatheta<0){deltatheta+=2*Math.PI}var numsteps=Math.ceil(Math.abs(deltatheta)/(2*Math.PI)*resolution)+1;if(numsteps<1)numsteps=1;for(var step=1;step<=numsteps;step++){var theta=theta1+step/numsteps*deltatheta;var costheta=Math.cos(theta);var sintheta=Math.sin(theta);var point=new CSG.Vector2D(cosphi*xradius*costheta-sinphi*yradius*sintheta,sinphi*xradius*costheta+cosphi*yradius*sintheta).plus(center);newpoints.push(point)}}newpoints=this.points.concat(newpoints);var result=new CSG.Path2D(newpoints);return result}};CSG.addTransformationMethodsToPrototype=function(prot){prot.mirrored=function(plane){return this.transform(CSG.Matrix4x4.mirroring(plane))};prot.mirroredX=function(){var plane=new CSG.Plane(CSG.Vector3D.Create(1,0,0),0);return this.mirrored(plane)};prot.mirroredY=function(){var plane=new CSG.Plane(CSG.Vector3D.Create(0,1,0),0);return this.mirrored(plane)};prot.mirroredZ=function(){var plane=new CSG.Plane(CSG.Vector3D.Create(0,0,1),0);return this.mirrored(plane)};prot.translate=function(v){return this.transform(CSG.Matrix4x4.translation(v))};prot.scale=function(f){return this.transform(CSG.Matrix4x4.scaling(f))};prot.rotateX=function(deg){return this.transform(CSG.Matrix4x4.rotationX(deg))};prot.rotateY=function(deg){return this.transform(CSG.Matrix4x4.rotationY(deg))};prot.rotateZ=function(deg){return this.transform(CSG.Matrix4x4.rotationZ(deg))};prot.rotate=function(rotationCenter,rotationAxis,degrees){return this.transform(CSG.Matrix4x4.rotation(rotationCenter,rotationAxis,degrees))}};CSG.addCenteringToPrototype=function(prot,axes){prot.center=function(cAxes){cAxes=Array.prototype.map.call(arguments,function(a){return a});if(!cAxes.length){cAxes=axes.slice()}var b=this.getBounds();return this.translate(axes.map(function(a){return cAxes.indexOf(a)>-1?-(b[0][a]+b[1][a])/2:0}))}};var CAG=function(){this.sides=[]};CAG.fromSides=function(sides){var cag=new CAG;cag.sides=sides;return cag};CAG.fromPoints=function(points){var numpoints=points.length;if(numpoints<3)throw new Error("CAG shape needs at least 3 points");var sides=[];var prevpoint=new CSG.Vector2D(points[numpoints-1]);var prevvertex=new CAG.Vertex(prevpoint);points.map(function(p){var point=new CSG.Vector2D(p);var vertex=new CAG.Vertex(point);var side=new CAG.Side(prevvertex,vertex);sides.push(side);prevvertex=vertex});var result=CAG.fromSides(sides);if(result.isSelfIntersecting()){throw new Error("Polygon is self intersecting!")}var area=result.area();if(Math.abs(area)<1e-5){throw new Error("Degenerate polygon!")}if(area<0){result=result.flipped()}result=result.canonicalized();return result};CAG.fromPointsNoCheck=function(points){var sides=[];var prevpoint=new CSG.Vector2D(points[points.length-1]);var prevvertex=new CAG.Vertex(prevpoint);points.map(function(p){var point=new CSG.Vector2D(p);var vertex=new CAG.Vertex(point);var side=new CAG.Side(prevvertex,vertex);sides.push(side);prevvertex=vertex});return CAG.fromSides(sides)};CAG.fromFakeCSG=function(csg){var sides=csg.polygons.map(function(p){return CAG.Side._fromFakePolygon(p)}).filter(function(s){return s!==null});return CAG.fromSides(sides)};CAG.linesIntersect=function(p0start,p0end,p1start,p1end){if(p0end.equals(p1start)||p1end.equals(p0start)){var d=p1end.minus(p1start).unit().plus(p0end.minus(p0start).unit()).length();if(d<1e-5){return true}}else{var d0=p0end.minus(p0start);var d1=p1end.minus(p1start);if(Math.abs(d0.cross(d1))<1e-9)return false;var alphas=CSG.solve2Linear(-d0.x,d1.x,-d0.y,d1.y,p0start.x-p1start.x,p0start.y-p1start.y);if(alphas[0]>1e-6&&alphas[0]<.999999&&alphas[1]>1e-5&&alphas[1]<.999999)return true}return false};CAG.circle=function(options){options=options||{};var center=CSG.parseOptionAs2DVector(options,"center",[0,0]);var radius=CSG.parseOptionAsFloat(options,"radius",1);var resolution=CSG.parseOptionAsInt(options,"resolution",CSG.defaultResolution2D);var sides=[];var prevvertex;for(var i=0;i<=resolution;i++){var radians=2*Math.PI*i/resolution;var point=CSG.Vector2D.fromAngleRadians(radians).times(radius).plus(center);var vertex=new CAG.Vertex(point);if(i>0){sides.push(new CAG.Side(prevvertex,vertex))}prevvertex=vertex}return CAG.fromSides(sides)};CAG.rectangle=function(options){options=options||{};var c,r;if("corner1"in options||"corner2"in options){if("center"in options||"radius"in options){throw new Error("rectangle: should either give a radius and center parameter, or a corner1 and corner2 parameter")}corner1=CSG.parseOptionAs2DVector(options,"corner1",[0,0]);corner2=CSG.parseOptionAs2DVector(options,"corner2",[1,1]);c=corner1.plus(corner2).times(.5);r=corner2.minus(corner1).times(.5)}else{c=CSG.parseOptionAs2DVector(options,"center",[0,0]);r=CSG.parseOptionAs2DVector(options,"radius",[1,1])}r=r.abs();var rswap=new CSG.Vector2D(r.x,-r.y);var points=[c.plus(r),c.plus(rswap),c.minus(r),c.minus(rswap)];return CAG.fromPoints(points)};CAG.roundedRectangle=function(options){options=options||{};var center,radius;if("corner1"in options||"corner2"in options){if("center"in options||"radius"in options){throw new Error("roundedRectangle: should either give a radius and center parameter, or a corner1 and corner2 parameter")}corner1=CSG.parseOptionAs2DVector(options,"corner1",[0,0]);corner2=CSG.parseOptionAs2DVector(options,"corner2",[1,1]);center=corner1.plus(corner2).times(.5);radius=corner2.minus(corner1).times(.5)}else{center=CSG.parseOptionAs2DVector(options,"center",[0,0]);radius=CSG.parseOptionAs2DVector(options,"radius",[1,1])}radius=radius.abs();var roundradius=CSG.parseOptionAsFloat(options,"roundradius",.2);var resolution=CSG.parseOptionAsInt(options,"resolution",CSG.defaultResolution2D);var maxroundradius=Math.min(radius.x,radius.y);maxroundradius-=.1;roundradius=Math.min(roundradius,maxroundradius);roundradius=Math.max(0,roundradius);radius=new CSG.Vector2D(radius.x-roundradius,radius.y-roundradius);var rect=CAG.rectangle({center:center,radius:radius});if(roundradius>0){rect=rect.expand(roundradius,resolution)}return rect};CAG.fromCompactBinary=function(bin){if(bin["class"]!="CAG")throw new Error("Not a CAG");var vertices=[];var vertexData=bin.vertexData;var numvertices=vertexData.length/2;var arrayindex=0;for(var vertexindex=0;vertexindex<numvertices;vertexindex++){var x=vertexData[arrayindex++];var y=vertexData[arrayindex++];var pos=new CSG.Vector2D(x,y);var vertex=new CAG.Vertex(pos);vertices.push(vertex)}var sides=[];var numsides=bin.sideVertexIndices.length/2;arrayindex=0;for(var sideindex=0;sideindex<numsides;sideindex++){var vertexindex0=bin.sideVertexIndices[arrayindex++];var vertexindex1=bin.sideVertexIndices[arrayindex++];var side=new CAG.Side(vertices[vertexindex0],vertices[vertexindex1]);sides.push(side)}var cag=CAG.fromSides(sides);cag.isCanonicalized=true;return cag};function fnSortByIndex(a,b){return a.index-b.index}CAG.prototype={toString:function(){var result="CAG ("+this.sides.length+" sides):\\n";this.sides.map(function(side){result+="  "+side.toString()+"\\n"});return result},_toCSGWall:function(z0,z1){var polygons=this.sides.map(function(side){return side.toPolygon3D(z0,z1)});return CSG.fromPolygons(polygons)},_toVector3DPairs:function(m){var pairs=this.sides.map(function(side){var p0=side.vertex0.pos,p1=side.vertex1.pos;return[CSG.Vector3D.Create(p0.x,p0.y,0),CSG.Vector3D.Create(p1.x,p1.y,0)]});if(typeof m!="undefined"){pairs=pairs.map(function(pair){return pair.map(function(v){return v.transform(m)})})}return pairs},_toPlanePolygons:function(options){var flipped=options.flipped||false;var origin=[0,0,0],defaultAxis=[0,0,1],defaultNormal=[0,1,0];var thisConnector=new CSG.Connector(origin,defaultAxis,defaultNormal);var translation=options.translation||origin;var axisVector=options.axisVector||defaultAxis;var normalVector=options.normalVector||defaultNormal;var toConnector=options.toConnector||new CSG.Connector(translation,axisVector,normalVector);var m=thisConnector.getTransformationTo(toConnector,false,0);var bounds=this.getBounds();bounds[0]=bounds[0].minus(new CSG.Vector2D(1,1));bounds[1]=bounds[1].plus(new CSG.Vector2D(1,1));var csgshell=this._toCSGWall(-1,1);var csgplane=CSG.fromPolygons([new CSG.Polygon([new CSG.Vertex(new CSG.Vector3D(bounds[0].x,bounds[0].y,0)),new CSG.Vertex(new CSG.Vector3D(bounds[1].x,bounds[0].y,0)),new CSG.Vertex(new CSG.Vector3D(bounds[1].x,bounds[1].y,0)),new CSG.Vertex(new CSG.Vector3D(bounds[0].x,bounds[1].y,0))])]);if(flipped){csgplane=csgplane.invert()}csgplane=csgplane.intersectSub(csgshell);var polys=csgplane.polygons.filter(function(polygon){return Math.abs(polygon.plane.normal.z)>.99});return polys.map(function(poly){return poly.transform(m)})},_toWallPolygons:function(options){var origin=[0,0,0],defaultAxis=[0,0,1],defaultNormal=[0,1,0];var thisConnector=new CSG.Connector(origin,defaultAxis,defaultNormal);var toConnector1=options.toConnector1;var toConnector2=options.toConnector2;if(!(toConnector1 instanceof CSG.Connector&&toConnector2 instanceof CSG.Connector)){throw"could not parse CSG.Connector arguments toConnector1 or toConnector2"}if(options.cag){if(options.cag.sides.length!=this.sides.length){throw"target cag needs same sides count as start cag"}}var toCag=options.cag||this;var m1=thisConnector.getTransformationTo(toConnector1,false,0);var m2=thisConnector.getTransformationTo(toConnector2,false,0);var vps1=this._toVector3DPairs(m1);var vps2=toCag._toVector3DPairs(m2);var polygons=[];vps1.forEach(function(vp1,i){polygons.push(new CSG.Polygon([new CSG.Vertex(vps2[i][1]),new CSG.Vertex(vps2[i][0]),new CSG.Vertex(vp1[0])]));polygons.push(new CSG.Polygon([new CSG.Vertex(vps2[i][1]),new CSG.Vertex(vp1[0]),new CSG.Vertex(vp1[1])]))});return polygons},union:function(cag){var cags;if(cag instanceof Array){cags=cag}else{cags=[cag]}var r=this._toCSGWall(-1,1);var r=r.union(cags.map(function(cag){return cag._toCSGWall(-1,1).reTesselated()}),false,false);return CAG.fromFakeCSG(r).canonicalized()},subtract:function(cag){var cags;if(cag instanceof Array){cags=cag}else{cags=[cag]}var r=this._toCSGWall(-1,1);cags.map(function(cag){r=r.subtractSub(cag._toCSGWall(-1,1),false,false)});r=r.reTesselated();r=r.canonicalized();r=CAG.fromFakeCSG(r);r=r.canonicalized();return r},intersect:function(cag){var cags;if(cag instanceof Array){cags=cag}else{cags=[cag]}var r=this._toCSGWall(-1,1);cags.map(function(cag){r=r.intersectSub(cag._toCSGWall(-1,1),false,false)});r=r.reTesselated();r=r.canonicalized();r=CAG.fromFakeCSG(r);r=r.canonicalized();return r},transform:function(matrix4x4){var ismirror=matrix4x4.isMirroring();var newsides=this.sides.map(function(side){return side.transform(matrix4x4)});var result=CAG.fromSides(newsides);if(ismirror){result=result.flipped()}return result},area:function(){var polygonArea=0;this.sides.map(function(side){polygonArea+=side.vertex0.pos.cross(side.vertex1.pos)});polygonArea*=.5;return polygonArea},flipped:function(){var newsides=this.sides.map(function(side){return side.flipped()});newsides.reverse();return CAG.fromSides(newsides)},getBounds:function(){var minpoint;if(this.sides.length===0){minpoint=new CSG.Vector2D(0,0)}else{minpoint=this.sides[0].vertex0.pos}var maxpoint=minpoint;this.sides.map(function(side){minpoint=minpoint.min(side.vertex0.pos);minpoint=minpoint.min(side.vertex1.pos);maxpoint=maxpoint.max(side.vertex0.pos);maxpoint=maxpoint.max(side.vertex1.pos)});return[minpoint,maxpoint]},isSelfIntersecting:function(debug){var numsides=this.sides.length;for(var i=0;i<numsides;i++){var side0=this.sides[i];for(var ii=i+1;ii<numsides;ii++){var side1=this.sides[ii];if(CAG.linesIntersect(side0.vertex0.pos,side0.vertex1.pos,side1.vertex0.pos,side1.vertex1.pos)){if(debug){OpenJsCad.log(side0);OpenJsCad.log(side1)}return true}}}return false},expandedShell:function(radius,resolution){resolution=resolution||8;if(resolution<4)resolution=4;var cags=[];var pointmap={};var cag=this.canonicalized();cag.sides.map(function(side){var d=side.vertex1.pos.minus(side.vertex0.pos);var dl=d.length();if(dl>1e-5){d=d.times(1/dl);var normal=d.normal().times(radius);var shellpoints=[side.vertex1.pos.plus(normal),side.vertex1.pos.minus(normal),side.vertex0.pos.minus(normal),side.vertex0.pos.plus(normal)];var newcag=CAG.fromPoints(shellpoints);cags.push(newcag);for(var step=0;step<2;step++){var p1=step===0?side.vertex0.pos:side.vertex1.pos;var p2=step===0?side.vertex1.pos:side.vertex0.pos;var tag=p1.x+" "+p1.y;if(!(tag in pointmap)){pointmap[tag]=[]}pointmap[tag].push({p1:p1,p2:p2})}}});for(var tag in pointmap){var m=pointmap[tag];var angle1,angle2;var pcenter=m[0].p1;if(m.length==2){var end1=m[0].p2;var end2=m[1].p2;angle1=end1.minus(pcenter).angleDegrees();angle2=end2.minus(pcenter).angleDegrees();if(angle2<angle1)angle2+=360;if(angle2>=angle1+360)angle2-=360;if(angle2<angle1+180){var t=angle2;angle2=angle1+360;angle1=t}angle1+=90;angle2-=90}else{angle1=0;angle2=360}var fullcircle=angle2>angle1+359.999;if(fullcircle){angle1=0;angle2=360}if(angle2>angle1+1e-5){var points=[];if(!fullcircle){points.push(pcenter)}var numsteps=Math.round(resolution*(angle2-angle1)/360);if(numsteps<1)numsteps=1;for(var step=0;step<=numsteps;step++){var angle=angle1+step/numsteps*(angle2-angle1);if(step==numsteps)angle=angle2;var point=pcenter.plus(CSG.Vector2D.fromAngleDegrees(angle).times(radius));if(!fullcircle||step>0){points.push(point)}}var newcag=CAG.fromPointsNoCheck(points);cags.push(newcag)}}var result=new CAG;result=result.union(cags);return result},expand:function(radius,resolution){var result=this.union(this.expandedShell(radius,resolution));return result},contract:function(radius,resolution){var result=this.subtract(this.expandedShell(radius,resolution));return result},extrudeInOrthonormalBasis:function(orthonormalbasis,depth){if(!(orthonormalbasis instanceof CSG.OrthoNormalBasis)){throw new Error("extrudeInPlane: the first parameter should be a CSG.OrthoNormalBasis")}var extruded=this.extrude({offset:[0,0,depth]});var matrix=orthonormalbasis.getInverseProjectionMatrix();extruded=extruded.transform(matrix);return extruded},extrudeInPlane:function(axis1,axis2,depth){return this.extrudeInOrthonormalBasis(CSG.OrthoNormalBasis.GetCartesian(axis1,axis2),depth)},extrude:function(options){if(this.sides.length==0){return new CSG}var offsetVector=CSG.parseOptionAs3DVector(options,"offset",[0,0,1]);var twistangle=CSG.parseOptionAsFloat(options,"twistangle",0);var twiststeps=CSG.parseOptionAsInt(options,"twiststeps",CSG.defaultResolution3D);if(offsetVector.z==0){throw"offset cannot be orthogonal to Z axis"}if(twistangle==0||twiststeps<1){twiststeps=1}var normalVector=CSG.Vector3D.Create(0,1,0);var polygons=[];polygons=polygons.concat(this._toPlanePolygons({translation:[0,0,0],normalVector:normalVector,flipped:!(offsetVector.z<0)}));polygons=polygons.concat(this._toPlanePolygons({translation:offsetVector,normalVector:normalVector.rotateZ(twistangle),flipped:offsetVector.z<0}));for(var i=0;i<twiststeps;i++){var c1=new CSG.Connector(offsetVector.times(i/twiststeps),[0,0,offsetVector.z],normalVector.rotateZ(i*twistangle/twiststeps));var c2=new CSG.Connector(offsetVector.times((i+1)/twiststeps),[0,0,offsetVector.z],normalVector.rotateZ((i+1)*twistangle/twiststeps));polygons=polygons.concat(this._toWallPolygons({toConnector1:c1,toConnector2:c2}))}return CSG.fromPolygons(polygons)},rotateExtrude:function(options){var alpha=CSG.parseOptionAsFloat(options,"angle",360);var resolution=CSG.parseOptionAsInt(options,"resolution",CSG.defaultResolution3D);var EPS=1e-5;alpha=alpha>360?alpha%360:alpha;var origin=[0,0,0];var axisV=CSG.Vector3D.Create(0,1,0);var normalV=[0,0,1];var polygons=[];var connS=new CSG.Connector(origin,axisV,normalV);if(alpha>0&&alpha<360){var connE=new CSG.Connector(origin,axisV.rotateZ(-alpha),normalV);polygons=polygons.concat(this._toPlanePolygons({toConnector:connS,flipped:true}));polygons=polygons.concat(this._toPlanePolygons({toConnector:connE}))}var connT1=connS,connT2;var step=alpha/resolution;for(var a=step;a<=alpha+EPS;a+=step){connT2=new CSG.Connector(origin,axisV.rotateZ(-a),normalV);polygons=polygons.concat(this._toWallPolygons({toConnector1:connT1,toConnector2:connT2}));connT1=connT2}return CSG.fromPolygons(polygons).reTesselated()},'
workerscript += 'check:function(){var EPS=1e-5;var errors=[];if(this.isSelfIntersecting(true)){errors.push("Self intersects")}var pointcount={};this.sides.map(function(side){function mappoint(p){var tag=p.x+" "+p.y;if(!(tag in pointcount))pointcount[tag]=0;pointcount[tag]++}mappoint(side.vertex0.pos);mappoint(side.vertex1.pos)});for(var tag in pointcount){var count=pointcount[tag];if(count&1){errors.push("Uneven number of sides ("+count+") for point "+tag)}}var area=this.area();if(area<EPS*EPS){errors.push("Area is "+area)}if(errors.length>0){var ertxt="";errors.map(function(err){ertxt+=err+"\\n"});throw new Error(ertxt)}},canonicalized:function(){if(this.isCanonicalized){return this}else{var factory=new CAG.fuzzyCAGFactory;var result=factory.getCAG(this);result.isCanonicalized=true;return result}},toCompactBinary:function(){var cag=this.canonicalized();var numsides=cag.sides.length;var vertexmap={};var vertices=[];var numvertices=0;var sideVertexIndices=new Uint32Array(2*numsides);var sidevertexindicesindex=0;cag.sides.map(function(side){[side.vertex0,side.vertex1].map(function(v){var vertextag=v.getTag();var vertexindex;if(!(vertextag in vertexmap)){vertexindex=numvertices++;vertexmap[vertextag]=vertexindex;vertices.push(v)}else{vertexindex=vertexmap[vertextag]}sideVertexIndices[sidevertexindicesindex++]=vertexindex})});var vertexData=new Float64Array(numvertices*2);var verticesArrayIndex=0;vertices.map(function(v){var pos=v.pos;vertexData[verticesArrayIndex++]=pos._x;vertexData[verticesArrayIndex++]=pos._y});var result={class:"CAG",sideVertexIndices:sideVertexIndices,vertexData:vertexData};return result},getOutlinePaths:function(){var cag=this.canonicalized();var sideTagToSideMap={};var startVertexTagToSideTagMap={};cag.sides.map(function(side){var sidetag=side.getTag();sideTagToSideMap[sidetag]=side;var startvertextag=side.vertex0.getTag();if(!(startvertextag in startVertexTagToSideTagMap)){startVertexTagToSideTagMap[startvertextag]=[]}startVertexTagToSideTagMap[startvertextag].push(sidetag)});var paths=[];while(true){var startsidetag=null;for(var aVertexTag in startVertexTagToSideTagMap){var sidesForThisVertex=startVertexTagToSideTagMap[aVertexTag];startsidetag=sidesForThisVertex[0];sidesForThisVertex.splice(0,1);if(sidesForThisVertex.length===0){delete startVertexTagToSideTagMap[aVertexTag]}break}if(startsidetag===null)break;var connectedVertexPoints=[];var sidetag=startsidetag;var thisside=sideTagToSideMap[sidetag];var startvertextag=thisside.vertex0.getTag();while(true){connectedVertexPoints.push(thisside.vertex0.pos);var nextvertextag=thisside.vertex1.getTag();if(nextvertextag==startvertextag)break;if(!(nextvertextag in startVertexTagToSideTagMap)){throw new Error("Area is not closed!")}var nextpossiblesidetags=startVertexTagToSideTagMap[nextvertextag];var nextsideindex=-1;if(nextpossiblesidetags.length==1){nextsideindex=0}else{var bestangle=null;var thisangle=thisside.direction().angleDegrees();for(var sideindex=0;sideindex<nextpossiblesidetags.length;sideindex++){var nextpossiblesidetag=nextpossiblesidetags[sideindex];var possibleside=sideTagToSideMap[nextpossiblesidetag];var angle=possibleside.direction().angleDegrees();var angledif=angle-thisangle;if(angledif<-180)angledif+=360;if(angledif>=180)angledif-=360;if(nextsideindex<0||angledif>bestangle){nextsideindex=sideindex;bestangle=angledif}}}var nextsidetag=nextpossiblesidetags[nextsideindex];nextpossiblesidetags.splice(nextsideindex,1);if(nextpossiblesidetags.length===0){delete startVertexTagToSideTagMap[nextvertextag]}thisside=sideTagToSideMap[nextsidetag]}var path=new CSG.Path2D(connectedVertexPoints,true);paths.push(path)}return paths},overCutInsideCorners:function(cutterradius){var cag=this.canonicalized();var pointmap={};cag.sides.map(function(side){if(!(side.vertex0.getTag()in pointmap)){pointmap[side.vertex0.getTag()]={pos:side.vertex0.pos,from:[],to:[]}}pointmap[side.vertex0.getTag()].to.push(side.vertex1.pos);if(!(side.vertex1.getTag()in pointmap)){pointmap[side.vertex1.getTag()]={pos:side.vertex1.pos,from:[],to:[]}}pointmap[side.vertex1.getTag()].from.push(side.vertex0.pos)});var cutouts=[];for(var pointtag in pointmap){var pointobj=pointmap[pointtag];if(pointobj.from.length==1&&pointobj.to.length==1){var fromcoord=pointobj.from[0];var pointcoord=pointobj.pos;var tocoord=pointobj.to[0];var v1=pointcoord.minus(fromcoord).unit();var v2=tocoord.minus(pointcoord).unit();var crossproduct=v1.cross(v2);var isInnerCorner=crossproduct<.001;if(isInnerCorner){var alpha=v2.angleRadians()-v1.angleRadians()+Math.PI;if(alpha<0){alpha+=2*Math.PI}else if(alpha>=2*Math.PI){alpha-=2*Math.PI}var midvector=v2.minus(v1).unit();var circlesegmentangle=30/180*Math.PI;var radiuscorrected=cutterradius/Math.cos(circlesegmentangle/2);var circlecenter=pointcoord.plus(midvector.times(radiuscorrected));var startangle=alpha+midvector.angleRadians();var deltaangle=2*(Math.PI-alpha);var numsteps=2*Math.ceil(deltaangle/circlesegmentangle/2);var points=[circlecenter];for(var i=0;i<=numsteps;i++){var angle=startangle+i/numsteps*deltaangle;var p=CSG.Vector2D.fromAngleRadians(angle).times(radiuscorrected).plus(circlecenter);points.push(p)}cutouts.push(CAG.fromPoints(points))}}}var result=cag.subtract(cutouts);return result}};CAG.Vertex=function(pos){this.pos=pos};CAG.Vertex.prototype={toString:function(){return"("+this.pos.x.toFixed(2)+","+this.pos.y.toFixed(2)+")"},getTag:function(){var result=this.tag;if(!result){result=CSG.getTag();this.tag=result}return result}};CAG.Side=function(vertex0,vertex1){if(!(vertex0 instanceof CAG.Vertex))throw new Error("Assertion failed");if(!(vertex1 instanceof CAG.Vertex))throw new Error("Assertion failed");this.vertex0=vertex0;this.vertex1=vertex1};CAG.Side._fromFakePolygon=function(polygon){polygon.vertices.forEach(function(v){if(!(v.pos.z>=-1.001&&v.pos.z<-.999)&&!(v.pos.z>=.999&&v.pos.z<1.001)){throw"Assertion failed: _fromFakePolygon expects abs z values of 1"}});if(polygon.vertices.length<4){return null}var reverse=false;var vert1Indices=[];var pts2d=polygon.vertices.filter(function(v,i){if(v.pos.z>0){vert1Indices.push(i);return true}}).map(function(v){return new CSG.Vector2D(v.pos.x,v.pos.y)});if(pts2d.length!=2){throw"Assertion failed: _fromFakePolygon: not enough points found"}var d=vert1Indices[1]-vert1Indices[0];if(d==1||d==3){if(d==1){pts2d.reverse()}}else{throw"Assertion failed: _fromFakePolygon: unknown index ordering"}var result=new CAG.Side(new CAG.Vertex(pts2d[0]),new CAG.Vertex(pts2d[1]));return result};CAG.Side.prototype={toString:function(){return this.vertex0+" -> "+this.vertex1},toPolygon3D:function(z0,z1){var vertices=[new CSG.Vertex(this.vertex0.pos.toVector3D(z0)),new CSG.Vertex(this.vertex1.pos.toVector3D(z0)),new CSG.Vertex(this.vertex1.pos.toVector3D(z1)),new CSG.Vertex(this.vertex0.pos.toVector3D(z1))];return new CSG.Polygon(vertices)},transform:function(matrix4x4){var newp1=this.vertex0.pos.transform(matrix4x4);var newp2=this.vertex1.pos.transform(matrix4x4);return new CAG.Side(new CAG.Vertex(newp1),new CAG.Vertex(newp2))},flipped:function(){return new CAG.Side(this.vertex1,this.vertex0)},direction:function(){return this.vertex1.pos.minus(this.vertex0.pos)},getTag:function(){var result=this.tag;if(!result){result=CSG.getTag();this.tag=result}return result},lengthSquared:function(){var x=this.vertex1.pos.x-this.vertex0.pos.x,y=this.vertex1.pos.y-this.vertex0.pos.y;return x*x+y*y},length:function(){return Math.sqrt(this.lengthSquared())}};CAG.fuzzyCAGFactory=function(){this.vertexfactory=new CSG.fuzzyFactory(2,1e-5)};CAG.fuzzyCAGFactory.prototype={getVertex:function(sourcevertex){var elements=[sourcevertex.pos._x,sourcevertex.pos._y];var result=this.vertexfactory.lookupOrCreate(elements,function(els){return sourcevertex});return result},getSide:function(sourceside){var vertex0=this.getVertex(sourceside.vertex0);var vertex1=this.getVertex(sourceside.vertex1);return new CAG.Side(vertex0,vertex1)},getCAG:function(sourcecag){var _this=this;var newsides=sourcecag.sides.map(function(side){return _this.getSide(side)}).filter(function(side){return side.length()>1e-5});return CAG.fromSides(newsides)}};CSG.addTransformationMethodsToPrototype(CSG.prototype);CSG.addTransformationMethodsToPrototype(CSG.Vector2D.prototype);CSG.addTransformationMethodsToPrototype(CSG.Vector3D.prototype);CSG.addTransformationMethodsToPrototype(CSG.Vertex.prototype);CSG.addTransformationMethodsToPrototype(CSG.Plane.prototype);CSG.addTransformationMethodsToPrototype(CSG.Polygon.prototype);CSG.addTransformationMethodsToPrototype(CSG.Line3D.prototype);CSG.addTransformationMethodsToPrototype(CSG.Connector.prototype);CSG.addTransformationMethodsToPrototype(CSG.Path2D.prototype);CSG.addTransformationMethodsToPrototype(CSG.Line2D.prototype);CSG.addTransformationMethodsToPrototype(CAG.prototype);CSG.addTransformationMethodsToPrototype(CAG.Side.prototype);CSG.addTransformationMethodsToPrototype(CSG.OrthoNormalBasis.prototype);CSG.addCenteringToPrototype(CSG.prototype,["x","y","z"]);CSG.addCenteringToPrototype(CAG.prototype,["x","y"]);CSG.Polygon2D=function(points){var cag=CAG.fromPoints(points);this.sides=cag.sides};CSG.Polygon2D.prototype=CAG.prototype;module.CSG=CSG;module.CAG=CAG})(this);'

/// HACK !!!!! jscad
workerscript += 'OpenJsCad=function(){};OpenJsCad.log=function(txt){var timeInMs=Date.now();var prevtime=OpenJsCad.log.prevLogTime;if(!prevtime)prevtime=timeInMs;var deltatime=timeInMs-prevtime;OpenJsCad.log.prevLogTime=timeInMs;var timefmt=(deltatime*.001).toFixed(3);txt="["+timefmt+"] "+txt;if(typeof console=="object"&&typeof console.log=="function"){console.log(txt)}else if(typeof self=="object"&&typeof self.postMessage=="function"){self.postMessage({cmd:"log",txt:txt})}else throw new Error("Cannot log")};OpenJsCad.Viewer=function(containerelement,initialdepth){var gl=GL.create();this.gl=gl;this.angleX=-60;this.angleY=0;this.angleZ=-45;this.viewpointX=0;this.viewpointY=-5;this.viewpointZ=initialdepth;this.touch={lastX:0,lastY:0,scale:0,ctrl:0,shiftTimer:null,shiftControl:null,cur:null};this.drawAxes=true;this.drawLines=false;this.lineOverlay=false;this.gl.canvas.width=$(containerelement).width();this.gl.canvas.height=$(containerelement).height();this.gl.viewport(0,0,this.gl.canvas.width,this.gl.canvas.height);this.gl.matrixMode(this.gl.PROJECTION);this.gl.loadIdentity();this.gl.perspective(45,this.gl.canvas.width/this.gl.canvas.height,.5,1e3);this.gl.matrixMode(this.gl.MODELVIEW);this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA);this.gl.clearColor(.93,.93,.93,1);this.gl.enable(this.gl.DEPTH_TEST);this.gl.enable(this.gl.CULL_FACE);this.gl.polygonOffset(1,1);this.blackShader=new GL.Shader("    void main() {      gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;    }","    void main() {      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.1);    }");this.lightingShader=new GL.Shader("      varying vec3 color;      varying float alpha;      varying vec3 normal;      varying vec3 light;      void main() {        const vec3 lightDir = vec3(1.0, 2.0, 3.0) / 3.741657386773941;        light = lightDir;        color = gl_Color.rgb;        alpha = gl_Color.a;        normal = gl_NormalMatrix * gl_Normal;        gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;      }","      varying vec3 color;      varying float alpha;      varying vec3 normal;      varying vec3 light;      void main() {        vec3 n = normalize(normal);        float diffuse = max(0.0, dot(light, n));        float specular = pow(max(0.0, -reflect(light, n).z), 10.0) * sqrt(diffuse);        gl_FragColor = vec4(mix(color * (0.3 + 0.7 * diffuse), vec3(1.0), specular), alpha);      }");var _this=this;var shiftControl=$(\'<div class="shift-scene"><div class="arrow arrow-left" />    <div class="arrow arrow-right" />    <div class="arrow arrow-top" />    <div class="arrow arrow-bottom" /></div>\');this.touch.shiftControl=shiftControl;$(containerelement).append(this.gl.canvas).append(shiftControl).hammer({drag_lock_to_axis:true}).on("transform",function(e){if(e.gesture.touches.length>=2){_this.clearShift();_this.onTransform(e);e.preventDefault()}}).on("touch",function(e){if(e.gesture.pointerType!="touch"){e.preventDefault();return}if(e.gesture.touches.length==1){var point=e.gesture.center;_this.touch.shiftTimer=setTimeout(function(){shiftControl.addClass("active").css({left:point.pageX+"px",top:point.pageY+"px"});_this.touch.shiftTimer=null;_this.touch.cur="shifting"},500)}else{_this.clearShift()}}).on("drag",function(e){if(e.gesture.pointerType!="touch"){e.preventDefault();return}if(!_this.touch.cur||_this.touch.cur=="dragging"){_this.clearShift();_this.onPanTilt(e)}else if(_this.touch.cur=="shifting"){_this.onShift(e)}}).on("touchend",function(e){_this.clearShift();if(_this.touch.cur){shiftControl.removeClass("active shift-horizontal shift-vertical")}}).on("transformend dragstart dragend",function(e){if(e.type=="transformend"&&_this.touch.cur=="transforming"||e.type=="dragend"&&_this.touch.cur=="shifting"||e.type=="dragend"&&_this.touch.cur=="dragging")_this.touch.cur=null;_this.touch.lastX=0;_this.touch.lastY=0;_this.touch.scale=0});this.gl.onmousemove=function(e){_this.onMouseMove(e)};this.gl.ondraw=function(){_this.onDraw()};this.gl.resizeCanvas=function(){var canvasWidth=_this.gl.canvas.clientWidth;var canvasHeight=_this.gl.canvas.clientHeight;if(_this.gl.canvas.width!=canvasWidth||_this.gl.canvas.height!=canvasHeight){_this.gl.canvas.width=canvasWidth;_this.gl.canvas.height=canvasHeight;_this.gl.viewport(0,0,_this.gl.canvas.width,_this.gl.canvas.height);_this.gl.matrixMode(_this.gl.PROJECTION);_this.gl.loadIdentity();_this.gl.perspective(45,_this.gl.canvas.width/_this.gl.canvas.height,.5,1e3);_this.gl.matrixMode(_this.gl.MODELVIEW);_this.onDraw()}};window.addEventListener("resize",this.gl.resizeCanvas);this.gl.onmousewheel=function(e){var wheelDelta=0;if(e.wheelDelta){wheelDelta=e.wheelDelta}else if(e.detail){wheelDelta=e.detail*-40}if(wheelDelta){var factor=Math.pow(1.003,-wheelDelta);var coeff=_this.getZoom();coeff*=factor;_this.setZoom(coeff)}};this.clear()};OpenJsCad.Viewer.prototype={setCsg:function(csg){if(0&&csg.length){for(var i=0;i<csg.length;i++)this.meshes.concat(OpenJsCad.Viewer.csgToMeshes(csg[i]))}else{this.meshes=OpenJsCad.Viewer.csgToMeshes(csg)}this.onDraw()},clear:function(){this.meshes=[];this.onDraw()},supported:function(){return!!this.gl},ZOOM_MAX:1e3,ZOOM_MIN:10,onZoomChanged:null,plate:true,state:0,setZoom:function(coeff){coeff=Math.max(coeff,0);coeff=Math.min(coeff,1);this.viewpointZ=this.ZOOM_MIN+coeff*(this.ZOOM_MAX-this.ZOOM_MIN);if(this.onZoomChanged){this.onZoomChanged()}this.onDraw()},getZoom:function(){var coeff=(this.viewpointZ-this.ZOOM_MIN)/(this.ZOOM_MAX-this.ZOOM_MIN);return coeff},onMouseMove:function(e){if(e.dragging){var b=e.button;if(e.which){b=e.which}e.preventDefault();if(e.altKey||b==3){this.angleY+=e.deltaX;this.angleX+=e.deltaY}else if(e.shiftKey||b==2){var factor=.005;this.viewpointX+=factor*e.deltaX*this.viewpointZ;this.viewpointY-=factor*e.deltaY*this.viewpointZ}else if(e.ctrlKey){var factor=Math.pow(1.006,e.deltaX+e.deltaY);var coeff=this.getZoom();coeff*=factor;this.setZoom(coeff)}else{this.angleZ+=e.deltaX;this.angleX+=e.deltaY}this.onDraw()}},clearShift:function(){if(this.touch.shiftTimer){clearTimeout(this.touch.shiftTimer);this.touch.shiftTimer=null}return this},onPanTilt:function(e){this.touch.cur="dragging";var delta=0;if(this.touch.lastY&&(e.gesture.direction=="up"||e.gesture.direction=="down")){delta=e.gesture.deltaY-this.touch.lastY;this.angleX+=delta}else if(this.touch.lastX&&(e.gesture.direction=="left"||e.gesture.direction=="right")){delta=e.gesture.deltaX-this.touch.lastX;this.angleZ+=delta}if(delta)this.onDraw();this.touch.lastX=e.gesture.deltaX;this.touch.lastY=e.gesture.deltaY},onShift:function(e){this.touch.cur="shifting";var factor=.005;var delta=0;if(this.touch.lastY&&(e.gesture.direction=="up"||e.gesture.direction=="down")){this.touch.shiftControl.removeClass("shift-horizontal").addClass("shift-vertical").css("top",e.gesture.center.pageY+"px");delta=e.gesture.deltaY-this.touch.lastY;this.viewpointY-=factor*delta*this.viewpointZ;this.angleX+=delta}if(this.touch.lastX&&(e.gesture.direction=="left"||e.gesture.direction=="right")){this.touch.shiftControl.removeClass("shift-vertical").addClass("shift-horizontal").css("left",e.gesture.center.pageX+"px");delta=e.gesture.deltaX-this.touch.lastX;this.viewpointX+=factor*delta*this.viewpointZ;this.angleZ+=delta}if(delta)this.onDraw();this.touch.lastX=e.gesture.deltaX;this.touch.lastY=e.gesture.deltaY},onTransform:function(e){this.touch.cur="transforming";if(this.touch.scale){var factor=1/(1+e.gesture.scale-this.touch.scale);var coeff=this.getZoom();coeff*=factor;this.setZoom(coeff)}this.touch.scale=e.gesture.scale;return this},onDraw:function(e){var gl=this.gl;gl.makeCurrent();gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.loadIdentity();gl.translate(this.viewpointX,this.viewpointY,-this.viewpointZ);gl.rotate(this.angleX,1,0,0);gl.rotate(this.angleY,0,1,0);gl.rotate(this.angleZ,0,0,1);gl.enable(gl.BLEND);if(!this.lineOverlay)gl.enable(gl.POLYGON_OFFSET_FILL);for(var i=0;i<this.meshes.length;i++){var mesh=this.meshes[i];this.lightingShader.draw(mesh,gl.TRIANGLES)}if(!this.lineOverlay)gl.disable(gl.POLYGON_OFFSET_FILL);gl.disable(gl.BLEND);if(this.drawLines){if(this.lineOverlay)gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);for(var i=0;i<this.meshes.length;i++){var mesh=this.meshes[i];this.blackShader.draw(mesh,gl.LINES)}gl.disable(gl.BLEND);if(this.lineOverlay)gl.enable(gl.DEPTH_TEST)}if(this.drawAxes){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.begin(gl.LINES);var plate=200;if(this.plate){gl.color(.8,.8,.8,.5);for(var x=-plate/2;x<=plate/2;x++){if(x%10){gl.vertex(-plate/2,x,0);gl.vertex(plate/2,x,0);gl.vertex(x,-plate/2,0);gl.vertex(x,plate/2,0)}}gl.color(.5,.5,.5,.5);for(var x=-plate/2;x<=plate/2;x+=10){gl.vertex(-plate/2,x,0);gl.vertex(plate/2,x,0);gl.vertex(x,-plate/2,0);gl.vertex(x,plate/2,0)}}if(0){gl.color(1,.5,.5,.2);gl.vertex(-100,0,0);gl.vertex(0,0,0);gl.color(1,0,0,.8);gl.vertex(0,0,0);gl.vertex(100,0,0);gl.color(.5,1,.5,.2);gl.vertex(0,-100,0);gl.vertex(0,0,0);gl.color(0,1,0,.8);gl.vertex(0,0,0);gl.vertex(0,100,0);gl.color(.5,.5,.5,.2);gl.vertex(0,0,-100);gl.vertex(0,0,0);gl.color(.2,.2,.2,.8);gl.vertex(0,0,0);gl.vertex(0,0,100)}if(0){gl.triangle();gl.color(.6,.2,.6,.2);gl.vertex(-plate,-plate,0);gl.vertex(plate,-plate,0);gl.vertex(plate,plate,0);gl.end();gl.triangle();gl.color(.6,.2,.6,.2);gl.vertex(plate,plate,0);gl.vertex(-plate,plate,0);gl.vertex(-plate,-plate,0);gl.end()}gl.end();gl.disable(gl.BLEND)}}};OpenJsCad.Viewer.csgToMeshes=function(initial_csg){var csg=initial_csg.canonicalized();var mesh=new GL.Mesh({normals:true,colors:true});var meshes=[mesh];var vertexTag2Index={};var vertices=[];var colors=[];var triangles=[];var smoothlighting=false;var polygons=csg.toPolygons();var numpolygons=polygons.length;for(var j=0;j<numpolygons;j++){var polygon=polygons[j];var color=[1,.4,1,1];if(polygon.shared&&polygon.shared.color){color=polygon.shared.color}if(polygon.color){color=polygon.color}if(color.length<4)color.push(1);var indices=polygon.vertices.map(function(vertex){var vertextag=vertex.getTag();var vertexindex;if(smoothlighting&&vertextag in vertexTag2Index){vertexindex=vertexTag2Index[vertextag]}else{vertexindex=vertices.length;vertexTag2Index[vertextag]=vertexindex;vertices.push([vertex.pos.x,vertex.pos.y,vertex.pos.z]);colors.push(color)}return vertexindex});for(var i=2;i<indices.length;i++){triangles.push([indices[0],indices[i-1],indices[i]])}if(vertices.length>65e3){mesh.triangles=triangles;mesh.vertices=vertices;mesh.colors=colors;mesh.computeWireframe();mesh.computeNormals();if(mesh.vertices.length){meshes.push(mesh)}mesh=new GL.Mesh({normals:true,colors:true});triangles=[];colors=[];vertices=[]}}mesh.triangles=triangles;mesh.vertices=vertices;mesh.colors=colors;mesh.computeWireframe();mesh.computeNormals();if(mesh.vertices.length){meshes.push(mesh)}return meshes};OpenJsCad.makeAbsoluteUrl=function(url,baseurl){if(!url.match(/^[a-z]+\\:/i)){var basecomps=baseurl.split("/");if(basecomps.length>0){basecomps.splice(basecomps.length-1,1)}var urlcomps=url.split("/");var comps=basecomps.concat(urlcomps);var comps2=[];comps.map(function(c){if(c==".."){if(comps2.length>0){comps2.splice(comps2.length-1,1)}}else{comps2.push(c)}});url="";for(var i=0;i<comps2.length;i++){if(i>0)url+="/";url+=comps2[i]}}return url};OpenJsCad.isChrome=function(){return navigator.userAgent.search("Chrome")>=0};OpenJsCad.runMainInWorker=function(mainParameters){try{if(typeof main!="function")throw new Error("Your jscad file should contain a function main() which returns a CSG solid or a CAG area.");OpenJsCad.log.prevLogTime=Date.now();var result=main(mainParameters);if(typeof result!="object"||!(result instanceof CSG)&&!(result instanceof CAG)){}if(result.length){var o=result[0];if(o instanceof CAG){o=o.extrude({offset:[0,0,.1]})}for(var i=1;i<result.length;i++){var c=result[i];if(c instanceof CAG){c=c.extrude({offset:[0,0,.1]})}o=o.unionForNonIntersecting(c)}result=o}var result_compact=result.toCompactBinary();result=null;self.postMessage({cmd:"rendered",result:result_compact})}catch(e){var errtxt=e.toString();if(e.stack){errtxt+="\\nStack trace:\\n"+e.stack}self.postMessage({cmd:"error",err:errtxt})}};OpenJsCad.parseJsCadScriptSync=function(script,mainParameters,debugging){var workerscript="//SYNC\\n";workerscript+="_includePath = "+JSON.stringify(_includePath)+";\\n";workerscript+=script;if(debugging){workerscript+="\\n\\n\\n\\n\\n\\n\\n/* -------------------------------------------------------------------------\\n";workerscript+="OpenJsCad debugging\\n\\nAssuming you are running Chrome:\\nF10 steps over an instruction\\nF11 steps into an instruction\\n";workerscript+="F8  continues running\\nPress the (||) button at the bottom to enable pausing whenever an error occurs\\n";workerscript+="Click on a line number to set or clear a breakpoint\\n";workerscript+="For more information see: http://code.google.com/chrome/devtools/docs/overview.html\\n\\n";workerscript+="------------------------------------------------------------------------- */\\n";workerscript+="\\n\\n// Now press F11 twice to enter your main() function:\\n\\n";workerscript+="debugger;\\n"}workerscript+="var me = "+JSON.stringify(me)+";\\n";workerscript+="return main("+JSON.stringify(mainParameters)+");";workerscript+="function include(fn) {  if(0) {    _csg_libraries.push(fn);  } else if(0) {    var url = _includePath!==\'undefined\'?_includePath:\'./\';    var index = url.indexOf(\'index.html\');    if(index!=-1) {       url = url.substring(0,index);    }  \\t importScripts(url+fn);  } else {   console.log(\'SYNC checking gMemFs for \'+fn);   if(gMemFs[fn]) {      console.log(\'found locally & eval:\',gMemFs[fn].name);      eval(gMemFs[fn].source); return;   }   var xhr = new XMLHttpRequest();   xhr.open(\'GET\',_includePath+fn,false);   console.log(\'include:\'+_includePath+fn);   xhr.onload = function() {      var src = this.responseText;      eval(src);   };   xhr.onerror = function() {   };   xhr.send();  }}";if(0){OpenJsCad.log.prevLogTime=Date.now();return eval(workerscript)}else{var f=new Function(workerscript);OpenJsCad.log.prevLogTime=Date.now();return f()}};OpenJsCad.parseJsCadScriptASync=function(script,mainParameters,options,callback){var baselibraries=[];var baseurl=document.location.href.replace(/\\?.*$/,"");baseurl=baseurl.replace(/#.*$/,"");var openjscadurl=baseurl;if(options["openJsCadPath"]!=null){openjscadurl=OpenJsCad.makeAbsoluteUrl(options["openJsCadPath"],baseurl)}var libraries=[];if(options["libraries"]!=null){libraries=options["libraries"]}for(var i in gMemFs){var src=gMemFs[i].source+"\\nfunction include() { }\\n";var f;try{f=new Function(src)}catch(e){this.setError(i+": "+e.message)}}var workerscript="//ASYNC\\n";workerscript+="var me = "+JSON.stringify(me)+";\\n";workerscript+="var _csg_baseurl="+JSON.stringify(baseurl)+";\\n";workerscript+="var _includePath="+JSON.stringify(_includePath)+";\\n";workerscript+="var gMemFs = [];\\n";var ignoreInclude=false;var mainFile;for(var fn in gMemFs){workerscript+="// "+gMemFs[fn].name+":\\n";if(!mainFile)mainFile=fn;if(fn=="main.jscad"||fn.match(/\\/main.jscad$/))mainFile=fn;workerscript+=\'gMemFs["\'+gMemFs[fn].name+\'"] = \'+JSON.stringify(gMemFs[fn].source)+";\\n";ignoreInclude=true}if(ignoreInclude){workerscript+="eval(gMemFs[\'"+mainFile+"\']);\\n"}else{workerscript+=script}workerscript+="\\n\\n\\n\\n//// The following code is added by OpenJsCad + OpenJSCAD.org:\\n";workerscript+="var _csg_baselibraries="+JSON.stringify(baselibraries)+";\\n";workerscript+="var _csg_libraries="+JSON.stringify(libraries)+";\\n";workerscript+="var _csg_openjscadurl="+JSON.stringify(openjscadurl)+";\\n";workerscript+="var _csg_makeAbsoluteURL="+OpenJsCad.makeAbsoluteUrl.toString()+";\\n";workerscript+="_csg_baselibraries = _csg_baselibraries.map(function(l){return _csg_makeAbsoluteURL(l,_csg_openjscadurl);});\\n";workerscript+="_csg_libraries = _csg_libraries.map(function(l){return _csg_makeAbsoluteURL(l,_csg_baseurl);});\\n";workerscript+="_csg_baselibraries.map(function(l){importScripts(l)});\\n";workerscript+="_csg_libraries.map(function(l){importScripts(l)});\\n";workerscript+="self.addEventListener(\'message\', function(e) {if(e.data && e.data.cmd == \'render\'){";workerscript+="  OpenJsCad.runMainInWorker("+JSON.stringify(mainParameters)+");";workerscript+="}},false);\\n";if(!ignoreInclude){workerscript+="function include(fn) {  if(0) {    _csg_libraries.push(fn);  } else if(1) {   if(gMemFs[fn]) {      eval(gMemFs[fn]); return;   }    var url = _csg_baseurl+_includePath;    var index = url.indexOf(\'index.html\');    if(index!=-1) {       url = url.substring(0,index);    }  \\t importScripts(url+fn);  } else {   var xhr = new XMLHttpRequest();   xhr.open(\'GET\', _includePath+fn, true);   xhr.onload = function() {      return eval(this.responseText);   };   xhr.onerror = function() {   };   xhr.send();  }}"}else{workerscript+="function include(fn) { eval(gMemFs[fn]); }\\n"}var blobURL=OpenJsCad.textToBlobUrl(workerscript);if(!window.Worker)throw new Error("Your browser doesn\'t support Web Workers. Please try the Chrome or Firefox browser instead.");var worker=new Worker(blobURL);worker.onmessage=function(e){if(e.data){if(e.data.cmd=="rendered"){var resulttype=e.data.result.class;var result;if(resulttype=="CSG"){result=CSG.fromCompactBinary(e.data.result)}else if(resulttype=="CAG"){result=CAG.fromCompactBinary(e.data.result)}else{throw new Error("Cannot parse result")}callback(null,result)}else if(e.data.cmd=="error"){callback(e.data.err,null)}else if(e.data.cmd=="log"){console.log(e.data.txt)}}};worker.onerror=function(e){var errtxt="Error in line "+e.lineno+": "+e.message;callback(errtxt,null)};worker.postMessage({cmd:"render"});return worker};OpenJsCad.getWindowURL=function(){if(window.URL)return window.URL;else if(window.webkitURL)return window.webkitURL;else throw new Error("Your browser doesn\'t support window.URL")};OpenJsCad.textToBlobUrl=function(txt){var windowURL=OpenJsCad.getWindowURL();var blob=new Blob([txt],{type:"application/javascript"});var blobURL=windowURL.createObjectURL(blob);if(!blobURL)throw new Error("createObjectURL() failed");return blobURL};OpenJsCad.revokeBlobUrl=function(url){if(window.URL)window.URL.revokeObjectURL(url);else if(window.webkitURL)window.webkitURL.revokeObjectURL(url);else throw new Error("Your browser doesn\'t support window.URL")};OpenJsCad.FileSystemApiErrorHandler=function(fileError,operation){var errormap={1:"NOT_FOUND_ERR",2:"SECURITY_ERR",3:"ABORT_ERR",4:"NOT_READABLE_ERR",5:"ENCODING_ERR",6:"NO_MODIFICATION_ALLOWED_ERR",7:"INVALID_STATE_ERR",8:"SYNTAX_ERR",9:"INVALID_MODIFICATION_ERR",10:"QUOTA_EXCEEDED_ERR",11:"TYPE_MISMATCH_ERR",12:"PATH_EXISTS_ERR"};var errname;if(fileError.code in errormap){errname=errormap[fileError.code]}else{errname="Error #"+fileError.code}var errtxt="FileSystem API error: "+operation+" returned error "+errname;throw new Error(errtxt)};OpenJsCad.AlertUserOfUncaughtExceptions=function(){window.onerror=function(message,url,line){message=message.replace(/^Uncaught /i,"");alert(message+"\\n\\n("+url+" line "+line+")")}};OpenJsCad.getParamDefinitions=function(script){var scriptisvalid=true;script+="\\nfunction include() {}";try{new Function(script)()}catch(e){scriptisvalid=false}var params=[];if(scriptisvalid){var script1="if(typeof(getParameterDefinitions) == \'function\') {return getParameterDefinitions();} else {return [];} ";script1+=script;var f=new Function(script1);params=f();if(typeof params!="object"||typeof params.length!="number"){throw new Error("The getParameterDefinitions() function should return an array with the parameter definitions")}}return params};OpenJsCad.Processor=function(containerdiv,onchange){this.containerdiv=containerdiv;this.onchange=onchange;this.viewerdiv=null;this.viewer=null;this.zoomControl=null;this.initialViewerDistance=100;this.currentObject=null;this.hasOutputFile=false;this.worker=null;this.paramDefinitions=[];this.paramControls=[];this.script=null;this.hasError=false;this.debugging=false;this.options={};this.createElements();this.state=0};OpenJsCad.Processor.convertToSolid=function(obj){if(typeof obj=="object"&&obj instanceof CAG){obj=obj.extrude({offset:[0,0,.1]})}else if(typeof obj=="object"&&obj instanceof CSG){}else if(obj.length){var o=obj[0];for(var i=1;i<obj.length;i++){o=o.unionForNonIntersecting(obj[i])}obj=o}else{throw new Error("Cannot convert to solid")}return obj};OpenJsCad.Processor.prototype={createElements:function(){var that=this;while(this.containerdiv.children.length>0){this.containerdiv.removeChild(0)}var viewerdiv=document.createElement("div");viewerdiv.className="viewer";viewerdiv.style.width="100%";viewerdiv.style.height="100%";this.containerdiv.appendChild(viewerdiv);this.viewerdiv=viewerdiv;try{this.viewer=new OpenJsCad.Viewer(this.viewerdiv,this.initialViewerDistance)}catch(e){this.viewerdiv.innerHTML="<b><br><br>Error: "+e.toString()+"</b><br><br>OpenJsCad currently requires Google Chrome or Firefox with WebGL enabled"}if(0){var div=document.createElement("div");this.zoomControl=div.cloneNode(false);this.zoomControl.style.width=this.viewerwidth+"px";this.zoomControl.style.height="20px";this.zoomControl.style.backgroundColor="transparent";this.zoomControl.style.overflowX="scroll";div.style.width=this.viewerwidth*11+"px";div.style.height="1px";this.zoomControl.appendChild(div);this.zoomChangedBySlider=false;this.zoomControl.onscroll=function(event){var zoom=that.zoomControl;var newzoom=zoom.scrollLeft/(10*zoom.offsetWidth);that.zoomChangedBySlider=true;that.viewer.setZoom(newzoom);that.zoomChangedBySlider=false};this.viewer.onZoomChanged=function(){if(!that.zoomChangedBySlider){var newzoom=that.viewer.getZoom();that.zoomControl.scrollLeft=newzoom*(10*that.zoomControl.offsetWidth)}};this.containerdiv.appendChild(this.zoomControl);this.zoomControl.scrollLeft=this.viewer.viewpointZ/this.viewer.ZOOM_MAX*(this.zoomControl.scrollWidth-this.zoomControl.offsetWidth)}this.errordiv=document.getElementById("errordiv");this.errorpre=document.createElement("pre");this.errordiv.appendChild(this.errorpre);this.statusdiv=document.getElementById("statusdiv");this.statusdiv.className="statusdiv";this.statusspan=document.createElement("span");this.statusspan.id="statusspan";this.statusspan.style.marginRight="2em";this.statusbuttons=document.createElement("span");this.statusbuttons.style.float="right";this.statusdiv.appendChild(this.statusspan);this.statusdiv.appendChild(this.statusbuttons);this.abortbutton=document.createElement("button");this.abortbutton.innerHTML="Abort";this.abortbutton.onclick=function(e){that.abort()};this.statusbuttons.appendChild(this.abortbutton);this.formatDropdown=document.createElement("select");this.formatDropdown.onchange=function(e){that.currentFormat=that.formatDropdown.options[that.formatDropdown.selectedIndex].value;that.updateDownloadLink()};this.statusbuttons.appendChild(this.formatDropdown);this.generateOutputFileButton=document.createElement("button");this.generateOutputFileButton.onclick=function(e){that.generateOutputFile()};this.statusbuttons.appendChild(this.generateOutputFileButton);this.downloadOutputFileLink=document.createElement("a");this.downloadOutputFileLink.className="downloadOutputFileLink";this.statusbuttons.appendChild(this.downloadOutputFileLink);this.parametersdiv=document.getElementById("parametersdiv");this.parametersdiv.id="parametersdiv";var headerdiv=document.createElement("div");headerdiv.innerHTML="Parameters:";headerdiv.className="parameterheader";this.parametersdiv.appendChild(headerdiv);this.parameterstable=document.createElement("table");this.parameterstable.className="parameterstable";this.parametersdiv.appendChild(this.parameterstable);var parseParametersButton=document.createElement("button");parseParametersButton.innerHTML="Update";parseParametersButton.onclick=function(e){that.rebuildSolid()};this.parametersdiv.appendChild(parseParametersButton);var instantUpdateCheckbox=document.createElement("input");instantUpdateCheckbox.type="checkbox";instantUpdateCheckbox.id="instantUpdate";this.parametersdiv.appendChild(instantUpdateCheckbox);var instantUpdateCheckboxText=document.createElement("span");instantUpdateCheckboxText.innerHTML="Instant Update";instantUpdateCheckboxText.id="instantUpdateLabel";this.parametersdiv.appendChild(instantUpdateCheckboxText);this.enableItems();this.clearViewer()},setCurrentObject:function(obj){this.currentObject=obj;if(this.viewer){var csg=OpenJsCad.Processor.convertToSolid(obj);this.viewer.setCsg(csg);this.viewer.state=2;if(obj.length)this.currentObject=csg}while(this.formatDropdown.options.length>0)this.formatDropdown.options.remove(0);var that=this;this.supportedFormatsForCurrentObject().forEach(function(format){var option=document.createElement("option");option.setAttribute("value",format);option.appendChild(document.createTextNode(that.formatInfo(format).displayName));that.formatDropdown.options.add(option)});this.updateDownloadLink()},selectedFormat:function(){return this.formatDropdown.options[this.formatDropdown.selectedIndex].value},selectedFormatInfo:function(){return this.formatInfo(this.selectedFormat())},updateDownloadLink:function(){var ext=this.selectedFormatInfo().extension;this.generateOutputFileButton.innerHTML="Generate "+ext.toUpperCase()},clearViewer:function(){this.clearOutputFile();if(this.currentObject){this.setCurrentObject(new CSG);this.currentObject=null}this.viewer.state=1;this.enableItems()},abort:function(){if(this.state==1){this.statusspan.innerHTML="Aborted.";this.worker.terminate();this.state=3;this.enableItems();if(this.onchange)this.onchange()}},enableItems:function(){this.abortbutton.style.display=this.state==1?"inline":"none";this.formatDropdown.style.display=!this.hasOutputFile&&this.currentObject?"inline":"none";this.generateOutputFileButton.style.display=!this.hasOutputFile&&this.currentObject?"inline":"none";this.downloadOutputFileLink.style.display=this.hasOutputFile?"inline":"none";this.parametersdiv.style.display=this.paramControls.length>0?"inline-block":"none";this.errordiv.style.display=this.hasError?"block":"none";this.statusdiv.style.display=this.hasError?"none":"block"},setOpenJsCadPath:function(path){this.options["openJsCadPath"]=path},addLibrary:function(lib){if(this.options["libraries"]==null){this.options["libraries"]=[]}this.options["libraries"].push(lib)},setError:function(txt){this.hasError=txt!="";this.errorpre.textContent=txt;this.enableItems()},setDebugging:function(debugging){this.debugging=debugging},setJsCad:function(script,filename){if(!filename)filename="openjscad.jscad";filename=filename.replace(/\\.jscad$/i,"");this.abort();this.paramDefinitions=[];this.paramControls=[];this.script=null;this.setError("");var scripthaserrors=false;try{this.paramDefinitions=OpenJsCad.getParamDefinitions(script);this.createParamControls()}catch(e){this.setError(e.toString());this.statusspan.innerHTML="Error.";scripthaserrors=true}if(!scripthaserrors){this.script=script;this.filename=filename;this.rebuildSolid()}else{this.enableItems();if(this.onchange)this.onchange()}},getParamValues:function(){var paramValues={};for(var i=0;i<this.paramDefinitions.length;i++){var paramdef=this.paramDefinitions[i];var type="text";if("type"in paramdef){type=paramdef.type}var control=this.paramControls[i];var value=null;if(type=="text"||type=="float"||type=="int"||type=="number"){value=control.value;if(type=="float"||type=="int"||type=="number"){var isnumber=!isNaN(parseFloat(value))&&isFinite(value);if(!isnumber){throw new Error("Not a number: "+value)}if(type=="int"){value=parseInt(value)}else{value=parseFloat(value)}}}else if(type=="choice"){value=control.options[control.selectedIndex].value}paramValues[paramdef.name]=value}return paramValues},rebuildSolid:function(){this.abort();this.setError("");this.clearViewer();this.statusspan.innerHTML="Rendering code, please wait <img id=busy src=\'imgs/busy.gif\'>";this.enableItems();var that=this;var paramValues=this.getParamValues();var useSync=this.debugging;if(!useSync){try{console.log("trying async compute");that.state=1;this.worker=OpenJsCad.parseJsCadScriptASync(this.script,paramValues,this.options,function(err,obj){that.worker=null;if(err){that.setError(err);that.statusspan.innerHTML="Error.";that.state=3}else{that.setCurrentObject(obj);that.statusspan.innerHTML="Ready.";that.state=2}that.enableItems();if(that.onchange)that.onchange()})}catch(e){console.log("async failed, try sync compute, error: "+e.message);useSync=true}}if(useSync){try{that.state=1;this.statusspan.innerHTML="Rendering code, please wait <img id=busy src=\'imgs/busy.gif\'>";var obj=OpenJsCad.parseJsCadScriptSync(this.script,paramValues,this.debugging);that.setCurrentObject(obj);that.statusspan.innerHTML="Ready.";that.state=2}catch(e){var errtxt=e.toString();if(e.stack){errtxt+="\\nStack trace:\\n"+e.stack}that.statusspan.innerHTML="Error.";that.state=3}that.enableItems();if(that.onchange)that.onchange()}},getState:function(){return this.state},clearOutputFile:function(){if(this.hasOutputFile){this.hasOutputFile=false;if(this.outputFileDirEntry){this.outputFileDirEntry.removeRecursively(function(){});this.outputFileDirEntry=null}if(this.outputFileBlobUrl){OpenJsCad.revokeBlobUrl(this.outputFileBlobUrl);this.outputFileBlobUrl=null}this.enableItems();if(this.onchange)this.onchange()}},generateOutputFile:function(){this.clearOutputFile();if(this.currentObject){try{this.generateOutputFileFileSystem()}catch(e){this.generateOutputFileBlobUrl()}}},currentObjectToBlob:function(){var format=this.selectedFormat();var blob;if(format=="stla"){blob=this.currentObject.toStlString();blob=new Blob([blob],{type:this.formatInfo(format).mimetype})}else if(format=="stlb"){blob=this.currentObject.toStlBinary({webBlob:true})}else if(format=="amf"){blob=this.currentObject.toAMFString({producer:"OpenJSCAD.org "+version,date:new Date});blob=new Blob([blob],{type:this.formatInfo(format).mimetype})}else if(format=="x3d"){blob=this.currentObject.fixTJunctions().toX3D()}else if(format=="dxf"){blob=this.currentObject.toDxf()}else{throw new Error("Not supported")}return blob},supportedFormatsForCurrentObject:function(){if(this.currentObject instanceof CSG){return["stlb","stla","amf","x3d"]}else if(this.currentObject instanceof CAG){return["dxf"]}else{throw new Error("Not supported")}},formatInfo:function(format){return{stla:{displayName:"STL (ASCII)",extension:"stl",mimetype:"application/sla"},stlb:{displayName:"STL (Binary)",extension:"stl",mimetype:"application/sla"},amf:{displayName:"AMF (experimental)",extension:"amf",mimetype:"application/amf+xml"},x3d:{displayName:"X3D",extension:"x3d",mimetype:"model/x3d+xml"},dxf:{displayName:"DXF",extension:"dxf",mimetype:"application/dxf"}}[format]},downloadLinkTextForCurrentObject:function(){var ext=this.selectedFormatInfo().extension;return"Download "+ext.toUpperCase()},generateOutputFileBlobUrl:function(){var blob=this.currentObjectToBlob();var windowURL=OpenJsCad.getWindowURL();this.outputFileBlobUrl=windowURL.createObjectURL(blob);if(!this.outputFileBlobUrl)throw new Error("createObjectURL() failed");this.hasOutputFile=true;this.downloadOutputFileLink.href=this.outputFileBlobUrl;this.downloadOutputFileLink.innerHTML=this.downloadLinkTextForCurrentObject();var ext=this.selectedFormatInfo().extension;this.downloadOutputFileLink.setAttribute("download","openjscad."+ext);this.enableItems();if(this.onchange)this.onchange()},generateOutputFileFileSystem:function(){window.requestFileSystem=window.requestFileSystem||window.webkitRequestFileSystem;if(!window.requestFileSystem){throw new Error("Your browser does not support the HTML5 FileSystem API. Please try the Chrome browser instead.")}var dirname="OpenJsCadOutput1_"+parseInt(Math.random()*1e9,10)+"."+extension;var extension=this.selectedFormatInfo().extension;var filename="output."+extension;var that=this;window.requestFileSystem(TEMPORARY,20*1024*1024,function(fs){fs.root.getDirectory(dirname,{create:true,exclusive:true},function(dirEntry){that.outputFileDirEntry=dirEntry;dirEntry.getFile(filename,{create:true,exclusive:true'
workerscript += '},function(fileEntry){fileEntry.createWriter(function(fileWriter){fileWriter.onwriteend=function(e){that.hasOutputFile=true;that.downloadOutputFileLink.href=fileEntry.toURL();that.downloadOutputFileLink.type=that.selectedFormatInfo().mimetype;that.downloadOutputFileLink.innerHTML=that.downloadLinkTextForCurrentObject();that.downloadOutputFileLink.setAttribute("download",fileEntry.name);that.enableItems();if(that.onchange)that.onchange()};fileWriter.onerror=function(e){throw new Error("Write failed: "+e.toString())};var blob=that.currentObjectToBlob();console.log(blob,blob.length);fileWriter.write(blob)},function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror,"createWriter")})},function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror,"getFile(\'"+filename+"\')")})},function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror,"getDirectory(\'"+dirname+"\')")})},function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror,"requestFileSystem")})},createParamControls:function(){this.parameterstable.innerHTML="";this.paramControls=[];var paramControls=[];var tablerows=[];for(var i=0;i<this.paramDefinitions.length;i++){var errorprefix="Error in parameter definition #"+(i+1)+": ";var paramdef=this.paramDefinitions[i];if(!("name"in paramdef)){throw new Error(errorprefix+"Should include a \'name\' parameter")}var type="text";if("type"in paramdef){type=paramdef.type}if(type!=="text"&&type!=="int"&&type!=="float"&&type!=="choice"&&type!=="number"){throw new Error(errorprefix+"Unknown parameter type \'"+type+"\'")}var control;if(type=="text"||type=="int"||type=="float"||type=="number"){control=document.createElement("input");if(type=="number")control.type="number";else control.type="text";if("default"in paramdef){control.value=paramdef["default"]}else if("initial"in paramdef)control.value=paramdef.initial;else{if(type=="int"||type=="float"||type=="number"){control.value="0"}else{control.value=""}}if(paramdef.size!==undefined)control.size=paramdef.size;for(var property in paramdef)if(paramdef.hasOwnProperty(property))if(property!="name"&&property!="type"&&property!="default"&&property!="initial"&&property!="caption")control.setAttribute(property,paramdef[property])}else if(type=="choice"){if(!("values"in paramdef)){throw new Error(errorprefix+"Should include a \'values\' parameter")}control=document.createElement("select");var values=paramdef.values;var captions;if("captions"in paramdef){captions=paramdef.captions;if(captions.length!=values.length){throw new Error(errorprefix+"\'captions\' and \'values\' should have the same number of items")}}else{captions=values}var selectedindex=0;for(var valueindex=0;valueindex<values.length;valueindex++){var option=document.createElement("option");option.value=values[valueindex];option.text=captions[valueindex];control.add(option);if("default"in paramdef){if(paramdef["default"]==values[valueindex]){selectedindex=valueindex}}else if("initial"in paramdef){if(paramdef.initial==values[valueindex]){selectedindex=valueindex}}}if(values.length>0){control.selectedIndex=selectedindex}}control.onchange=function(){if(document.getElementById("instantUpdate").checked==true){that.rebuildSolid()}};paramControls.push(control);var tr=document.createElement("tr");var td=document.createElement("td");var label=paramdef.name+":";if("caption"in paramdef){label=paramdef.caption;td.className="caption"}td.innerHTML=label;tr.appendChild(td);td=document.createElement("td");td.appendChild(control);tr.appendChild(td);tablerows.push(tr)}var that=this;tablerows.map(function(tr){that.parameterstable.appendChild(tr)});this.paramControls=paramControls}};'

/// HACK !!!!! scad
workerscript += 'function JStoMeta(src){var l=src.split(/\\n/);var n=0;var m=[];for(var i=0;;i++){if(l[i].match(/^\\/\\/\\s*(\\S[^:]+):\\s*(\\S.*)/)){var k=RegExp.$1;var v=RegExp.$2;m[k]=v;n++}else{if(i>5&&n==0)break;else if(n>0)break}}return m}function MetaToJS(m){var s="";for(var k in m){s+="// "+k+": "+m[k]+"\\n"}return s}function color(){var map={black:[0/255,0/255,0/255],silver:[192/255,192/255,192/255],gray:[128/255,128/255,128/255],white:[255/255,255/255,255/255],maroon:[128/255,0/255,0/255],red:[255/255,0/255,0/255],purple:[128/255,0/255,128/255],fuchsia:[255/255,0/255,255/255],green:[0/255,128/255,0/255],lime:[0/255,255/255,0/255],olive:[128/255,128/255,0/255],yellow:[255/255,255/255,0/255],navy:[0/255,0/255,128/255],blue:[0/255,0/255,255/255],teal:[0/255,128/255,128/255],aqua:[0/255,255/255,255/255],aliceblue:[240/255,248/255,255/255],antiquewhite:[250/255,235/255,215/255],aqua:[0/255,255/255,255/255],aquamarine:[127/255,255/255,212/255],azure:[240/255,255/255,255/255],beige:[245/255,245/255,220/255],bisque:[255/255,228/255,196/255],black:[0/255,0/255,0/255],blanchedalmond:[255/255,235/255,205/255],blue:[0/255,0/255,255/255],blueviolet:[138/255,43/255,226/255],brown:[165/255,42/255,42/255],burlywood:[222/255,184/255,135/255],cadetblue:[95/255,158/255,160/255],chartreuse:[127/255,255/255,0/255],chocolate:[210/255,105/255,30/255],coral:[255/255,127/255,80/255],cornflowerblue:[100/255,149/255,237/255],cornsilk:[255/255,248/255,220/255],crimson:[220/255,20/255,60/255],cyan:[0/255,255/255,255/255],darkblue:[0/255,0/255,139/255],darkcyan:[0/255,139/255,139/255],darkgoldenrod:[184/255,134/255,11/255],darkgray:[169/255,169/255,169/255],darkgreen:[0/255,100/255,0/255],darkgrey:[169/255,169/255,169/255],darkkhaki:[189/255,183/255,107/255],darkmagenta:[139/255,0/255,139/255],darkolivegreen:[85/255,107/255,47/255],darkorange:[255/255,140/255,0/255],darkorchid:[153/255,50/255,204/255],darkred:[139/255,0/255,0/255],darksalmon:[233/255,150/255,122/255],darkseagreen:[143/255,188/255,143/255],darkslateblue:[72/255,61/255,139/255],darkslategray:[47/255,79/255,79/255],darkslategrey:[47/255,79/255,79/255],darkturquoise:[0/255,206/255,209/255],darkviolet:[148/255,0/255,211/255],deeppink:[255/255,20/255,147/255],deepskyblue:[0/255,191/255,255/255],dimgray:[105/255,105/255,105/255],dimgrey:[105/255,105/255,105/255],dodgerblue:[30/255,144/255,255/255],firebrick:[178/255,34/255,34/255],floralwhite:[255/255,250/255,240/255],forestgreen:[34/255,139/255,34/255],fuchsia:[255/255,0/255,255/255],gainsboro:[220/255,220/255,220/255],ghostwhite:[248/255,248/255,255/255],gold:[255/255,215/255,0/255],goldenrod:[218/255,165/255,32/255],gray:[128/255,128/255,128/255],green:[0/255,128/255,0/255],greenyellow:[173/255,255/255,47/255],grey:[128/255,128/255,128/255],honeydew:[240/255,255/255,240/255],hotpink:[255/255,105/255,180/255],indianred:[205/255,92/255,92/255],indigo:[75/255,0/255,130/255],ivory:[255/255,255/255,240/255],khaki:[240/255,230/255,140/255],lavender:[230/255,230/255,250/255],lavenderblush:[255/255,240/255,245/255],lawngreen:[124/255,252/255,0/255],lemonchiffon:[255/255,250/255,205/255],lightblue:[173/255,216/255,230/255],lightcoral:[240/255,128/255,128/255],lightcyan:[224/255,255/255,255/255],lightgoldenrodyellow:[250/255,250/255,210/255],lightgray:[211/255,211/255,211/255],lightgreen:[144/255,238/255,144/255],lightgrey:[211/255,211/255,211/255],lightpink:[255/255,182/255,193/255],lightsalmon:[255/255,160/255,122/255],lightseagreen:[32/255,178/255,170/255],lightskyblue:[135/255,206/255,250/255],lightslategray:[119/255,136/255,153/255],lightslategrey:[119/255,136/255,153/255],lightsteelblue:[176/255,196/255,222/255],lightyellow:[255/255,255/255,224/255],lime:[0/255,255/255,0/255],limegreen:[50/255,205/255,50/255],linen:[250/255,240/255,230/255],magenta:[255/255,0/255,255/255],maroon:[128/255,0/255,0/255],mediumaquamarine:[102/255,205/255,170/255],mediumblue:[0/255,0/255,205/255],mediumorchid:[186/255,85/255,211/255],mediumpurple:[147/255,112/255,219/255],mediumseagreen:[60/255,179/255,113/255],mediumslateblue:[123/255,104/255,238/255],mediumspringgreen:[0/255,250/255,154/255],mediumturquoise:[72/255,209/255,204/255],mediumvioletred:[199/255,21/255,133/255],midnightblue:[25/255,25/255,112/255],mintcream:[245/255,255/255,250/255],mistyrose:[255/255,228/255,225/255],moccasin:[255/255,228/255,181/255],navajowhite:[255/255,222/255,173/255],navy:[0/255,0/255,128/255],oldlace:[253/255,245/255,230/255],olive:[128/255,128/255,0/255],olivedrab:[107/255,142/255,35/255],orange:[255/255,165/255,0/255],orangered:[255/255,69/255,0/255],orchid:[218/255,112/255,214/255],palegoldenrod:[238/255,232/255,170/255],palegreen:[152/255,251/255,152/255],paleturquoise:[175/255,238/255,238/255],palevioletred:[219/255,112/255,147/255],papayawhip:[255/255,239/255,213/255],peachpuff:[255/255,218/255,185/255],peru:[205/255,133/255,63/255],pink:[255/255,192/255,203/255],plum:[221/255,160/255,221/255],powderblue:[176/255,224/255,230/255],purple:[128/255,0/255,128/255],red:[255/255,0/255,0/255],rosybrown:[188/255,143/255,143/255],royalblue:[65/255,105/255,225/255],saddlebrown:[139/255,69/255,19/255],salmon:[250/255,128/255,114/255],sandybrown:[244/255,164/255,96/255],seagreen:[46/255,139/255,87/255],seashell:[255/255,245/255,238/255],sienna:[160/255,82/255,45/255],silver:[192/255,192/255,192/255],skyblue:[135/255,206/255,235/255],slateblue:[106/255,90/255,205/255],slategray:[112/255,128/255,144/255],slategrey:[112/255,128/255,144/255],snow:[255/255,250/255,250/255],springgreen:[0/255,255/255,127/255],steelblue:[70/255,130/255,180/255],tan:[210/255,180/255,140/255],teal:[0/255,128/255,128/255],thistle:[216/255,191/255,216/255],tomato:[255/255,99/255,71/255],turquoise:[64/255,224/255,208/255],violet:[238/255,130/255,238/255],wheat:[245/255,222/255,179/255],white:[255/255,255/255,255/255],whitesmoke:[245/255,245/255,245/255],yellow:[255/255,255/255,0/255],yellowgreen:[154/255,205/255,50/255]};var o,i=1,a=arguments,c=a[0],alpha;if(a[0].length<4&&a[i]*1-0==a[i]){alpha=a[i++]}if(a[i].length){a=a[i],i=0}if(typeof c=="string")c=map[c.toLowerCase()];if(alpha!==undefined)c=c.concat(alpha);for(o=a[i++];i<a.length;i++){o=o.union(a[i])}return o.setColor(c)}function group(){var o,i=0,a=arguments;if(a[0].length)a=a[0];if(typeof a[i]=="object"&&a[i]instanceof CAG){o=a[i].extrude({offset:[0,0,.1]})}else{o=a[i++]}for(;i<a.length;i++){var obj=a[i];if(typeof a[i]=="object"&&a[i]instanceof CAG){obj=a[i].extrude({offset:[0,0,.1]})}o=o.unionForNonIntersecting(obj)}return o}function union(){var o,i=0,a=arguments;if(a[0].length)a=a[0];o=a[i++];if(0){if(typeof a[i]=="object"&&a[i]instanceof CAG){o=a[i].extrude({offset:[0,0,.1]})}else{o=a[i++]}}for(;i<a.length;i++){var obj=a[i];if(0&&typeof a[i]=="object"&&a[i]instanceof CAG){obj=a[i].extrude({offset:[0,0,.1]})}o=o.union(obj)}return o}function difference(){var o,i=0,a=arguments;if(a[0].length)a=a[0];for(o=a[i++];i<a.length;i++){o=o.subtract(a[i].setColor(1,1,0))}return o}function intersection(){var o,i=0,a=arguments;if(a[0].length)a=a[0];for(o=a[i++];i<a.length;i++){o=o.intersect(a[i].setColor(1,1,0))}return o}function cube(p){var s=1,v=null,off=[0,0,0],round=false,r=0,fn=8;if(p&&p.length)v=p;if(p&&p.size&&p.size.length)v=p.size;if(p&&p.size&&!p.size.length)s=p.size;if(p&&typeof p!="object")s=p;if(p&&p.round==true){round=true,r=v&&v.length?(v[0]+v[1]+v[2])/30:s/10}if(p&&p.radius){round=true,r=p.radius}if(p&&p.fn)fn=p.fn;var x=s,y=s,z=s;if(v&&v.length){x=v[0],y=v[1],z=v[2]}off=[x/2,y/2,z/2];var o=round?CSG.roundedCube({radius:[x/2,y/2,z/2],roundradius:r,resolution:fn}):CSG.cube({radius:[x/2,y/2,z/2]});if(p&&p.center&&p.center.length){off=[p.center[0]?0:x/2,p.center[1]?0:y/2,p.center[2]?0:z/2]}else if(p&&p.center==true){off=[0,0,0]}else if(p&&p.center==false){off=[x/2,y/2,z/2]}if(off[0]||off[1]||off[2])o=o.translate(off);return o}function sphere(p){var r=1;var fn=32;var off=[0,0,0];var type="normal";if(p&&p.r)r=p.r;if(p&&p.fn)fn=p.fn;if(p&&p.type)type=p.type;if(p&&typeof p!="object")r=p;off=[0,0,0];var o;if(type=="geodesic")o=geodesicSphere(p);else o=CSG.sphere({radius:r,resolution:fn});if(p&&p.center&&p.center.length){off=[p.center[0]?0:r,p.center[1]?0:r,p.center[2]?0:r]}else if(p&&p.center==true){off=[0,0,0]}else if(p&&p.center==false){off=[r,r,r]}if(off[0]||off[1]||off[2])o=o.translate(off);return o}function geodesicSphere(p){var r=1,fn=5;var ci=[[.850651,0,-.525731],[.850651,-0,.525731],[-.850651,-0,.525731],[-.850651,0,-.525731],[0,-.525731,.850651],[0,.525731,.850651],[0,.525731,-.850651],[0,-.525731,-.850651],[-.525731,-.850651,-0],[.525731,-.850651,-0],[.525731,.850651,0],[-.525731,.850651,0]];var ti=[[0,9,1],[1,10,0],[6,7,0],[10,6,0],[7,9,0],[5,1,4],[4,1,9],[5,10,1],[2,8,3],[3,11,2],[2,5,4],[4,8,2],[2,11,5],[3,7,6],[6,11,3],[8,7,3],[9,8,4],[11,10,5],[10,11,6],[8,9,7]];var geodesicSubDivide=function(p,fn,off){var p1=p[0],p2=p[1],p3=p[2];var n=off;var c=[];var f=[];for(var i=0;i<fn;i++){for(var j=0;j<fn-i;j++){var t0=i/fn;var t1=(i+1)/fn;var s0=j/(fn-i);var s1=(j+1)/(fn-i);var s2=fn-i-1?j/(fn-i-1):1;var q=[];q[0]=mix3(mix3(p1,p2,s0),p3,t0);q[1]=mix3(mix3(p1,p2,s1),p3,t0);q[2]=mix3(mix3(p1,p2,s2),p3,t1);for(var k=0;k<3;k++){var r=Math.sqrt(q[k][0]*q[k][0]+q[k][1]*q[k][1]+q[k][2]*q[k][2]);for(var l=0;l<3;l++){q[k][l]/=r}}c.push(q[0],q[1],q[2]);f.push([n,n+1,n+2]);n+=3;if(j<fn-i-1){var s3=fn-i-1?(j+1)/(fn-i-1):1;q[0]=mix3(mix3(p1,p2,s1),p3,t0);q[1]=mix3(mix3(p1,p2,s3),p3,t1);q[2]=mix3(mix3(p1,p2,s2),p3,t1);for(var k=0;k<3;k++){var r=Math.sqrt(q[k][0]*q[k][0]+q[k][1]*q[k][1]+q[k][2]*q[k][2]);for(var l=0;l<3;l++){q[k][l]/=r}}c.push(q[0],q[1],q[2]);f.push([n,n+1,n+2]);n+=3}}}return{points:c,triangles:f,off:n}};var mix3=function(a,b,f){var _f=1-f;var c=[];for(var i=0;i<3;i++){c[i]=a[i]*_f+b[i]*f}return c};if(p){if(p.fn)fn=Math.floor(p.fn/6);if(p.r)r=p.r}if(fn<=0)fn=1;var q=[];var c=[],f=[];var off=0;for(var i=0;i<ti.length;i++){var g=geodesicSubDivide([ci[ti[i][0]],ci[ti[i][1]],ci[ti[i][2]]],fn,off);c=c.concat(g.points);f=f.concat(g.triangles);off=g.off}return polyhedron({points:c,triangles:f}).scale(r)}function cylinder(p){var r1=1,r2=1,h=1,fn=32,round=false;var a=arguments;var off=[0,0,0];if(p&&p.d){r1=r2=p.d/2}if(p&&p.r){r1=p.r;r2=p.r}if(p&&p.h){h=p.h}if(p&&(p.r1||p.r2)){r1=p.r1;r2=p.r2;if(p.h)h=p.h}if(p&&(p.d1||p.d2)){r1=p.d1/2;r2=p.d2/2}if(a&&a[0]&&a[0].length){a=a[0];r1=a[0];r2=a[1];h=a[2];if(a.length==4)fn=a[3]}if(p&&p.fn)fn=p.fn;if(p&&p.round==true)round=true;var o;if(p&&(p.start&&p.end)){o=round?CSG.roundedCylinder({start:p.start,end:p.end,radiusStart:r1,radiusEnd:r2,resolution:fn}):CSG.cylinder({start:p.start,end:p.end,radiusStart:r1,radiusEnd:r2,resolution:fn})}else{o=round?CSG.roundedCylinder({start:[0,0,0],end:[0,0,h],radiusStart:r1,radiusEnd:r2,resolution:fn}):CSG.cylinder({start:[0,0,0],end:[0,0,h],radiusStart:r1,radiusEnd:r2,resolution:fn});var r=r1>r2?r1:r2;if(p&&p.center&&p.center.length){off=[p.center[0]?0:r,p.center[1]?0:r,p.center[2]?-h/2:0]}else if(p&&p.center==true){off=[0,0,-h/2]}else if(p&&p.center==false){off=[0,0,0]}if(off[0]||off[1]||off[2])o=o.translate(off)}return o}function torus(p){var ri=1,ro=4,fni=16,fno=32,roti=0;if(p){if(p.ri)ri=p.ri;if(p.fni)fni=p.fni;if(p.roti)roti=p.roti;if(p.ro)ro=p.ro;if(p.fno)fno=p.fno}if(fni<3)fni=3;if(fno<3)fno=3;var c=circle({r:ri,fn:fni,center:true});if(roti)c=c.rotateZ(roti);return rotate_extrude({fn:fno},c.translate([ro,0,0]))}function polyhedron(p){var pgs=[];var ref=p.triangles||p.polygons;for(var i=0;i<ref.length;i++){var pp=[];for(var j=0;j<ref[i].length;j++){pp[j]=p.points[ref[i][j]]}var v=[];for(j=ref[i].length-1;j>=0;j--){v.push(new CSG.Vertex(new CSG.Vector3D(pp[j][0],pp[j][1],pp[j][2])))}pgs.push(new CSG.Polygon(v))}var r=CSG.fromPolygons(pgs);return r}function translate(){var a=arguments,v=a[0],o,i=1;if(a[1].length){a=a[1];i=0}for(o=a[i++];i<a.length;i++){o=o.union(a[i])}return o.translate(v)}function center(){var a=arguments,v=a[0],o,i=1;if(a[1].length){a=a[1];i=0}for(o=a[i++];i<a.length;i++){o=o.union(a[i])}return o.center(v)}function scale(){var a=arguments,v=a[0],o,i=1;if(a[1].length){a=a[1];i=0}for(o=a[i++];i<a.length;i++){o=o.union(a[i])}return o.scale(v)}function rotate(){var o,i,v,r=1,a=arguments;if(!a[0].length){r=a[0];v=a[1];i=2;if(a[2].length){a=a[2];i=0}}else{v=a[0];i=1;if(a[1].length){a=a[1];i=0}}for(o=a[i++];i<a.length;i++){o=o.union(a[i])}if(r!=1){return o.rotateX(v[0]*r).rotateY(v[1]*r).rotateZ(v[2]*r)}else{return o.rotateX(v[0]).rotateY(v[1]).rotateZ(v[2])}}function mirror(v,o){var a=Array.prototype.slice.call(arguments,1,arguments.length),o=a[0];for(var i=1;i<a.length;i++){o=o.union(a[i])}var plane=new CSG.Plane(new CSG.Vector3D(v[0],v[1],v[2]).unit(),0);return o.mirrored(plane)}function expand(r,n,o){return o.expand(r,n)}function contract(r,n,o){return o.contract(r,n)}function multmatrix(){console.log("multmatrix() not yet implemented")}function minkowski(){console.log("minkowski() not yet implemented")}function hull(){var pts=[];var a=arguments;if(a[0].length)a=a[0];var done=[];for(var i=0;i<a.length;i++){var cag=a[i];if(!(cag instanceof CAG)){throw"ERROR: hull() accepts only 2D forms / CAG";return}for(var j=0;j<cag.sides.length;j++){var x=cag.sides[j].vertex0.pos.x;var y=cag.sides[j].vertex0.pos.y;if(done[""+x+","+y])continue;pts.push({x:x,y:y});done[""+x+","+y]++}}var ConvexHullPoint=function(i,a,d){this.index=i;this.angle=a;this.distance=d;this.compare=function(p){if(this.angle<p.angle)return-1;else if(this.angle>p.angle)return 1;else{if(this.distance<p.distance)return-1;else if(this.distance>p.distance)return 1}return 0}};var ConvexHull=function(){this.points=null;this.indices=null;this.getIndices=function(){return this.indices};this.clear=function(){this.indices=null;this.points=null};this.ccw=function(p1,p2,p3){var ccw=(this.points[p2].x-this.points[p1].x)*(this.points[p3].y-this.points[p1].y)-(this.points[p2].y-this.points[p1].y)*(this.points[p3].x-this.points[p1].x);if(ccw<1e-5)return 0;return ccw};this.angle=function(o,a){return Math.atan2(this.points[a].y-this.points[o].y,this.points[a].x-this.points[o].x)};this.distance=function(a,b){return(this.points[b].x-this.points[a].x)*(this.points[b].x-this.points[a].x)+(this.points[b].y-this.points[a].y)*(this.points[b].y-this.points[a].y)};this.compute=function(_points){this.indices=null;if(_points.length<3)return;this.points=_points;var min=0;for(var i=1;i<this.points.length;i++){if(this.points[i].y==this.points[min].y){if(this.points[i].x<this.points[min].x)min=i}else if(this.points[i].y<this.points[min].y)min=i}var al=new Array;var ang=0;var dist=0;for(i=0;i<this.points.length;i++){if(i==min)continue;ang=this.angle(min,i);if(ang<0)ang+=Math.PI;dist=this.distance(min,i);al.push(new ConvexHullPoint(i,ang,dist))}al.sort(function(a,b){return a.compare(b)});var stack=new Array(this.points.length+1);var j=2;for(i=0;i<this.points.length;i++){if(i==min)continue;stack[j]=al[j-2].index;j++}stack[0]=stack[this.points.length];stack[1]=min;var tmp;var M=2;for(i=3;i<=this.points.length;i++){while(this.ccw(stack[M-1],stack[M],stack[i])<=0)M--;M++;tmp=stack[i];stack[i]=stack[M];stack[M]=tmp}this.indices=new Array(M);for(i=0;i<M;i++){this.indices[i]=stack[i+1]}}};var hull=new ConvexHull;hull.compute(pts);var indices=hull.getIndices();if(indices&&indices.length>0){var ch=[];for(var i=0;i<indices.length;i++){ch.push(pts[indices[i]])}return CAG.fromPoints(ch)}}function chain_hull(){var a=arguments;var j=0,closed=false;if(a[j].closed!==undefined)closed=a[j++].closed;if(a[j].length)a=a[j];var h=[];var n=a.length-(closed?0:1);for(var i=0;i<n;i++){h.push(hull(a[i],a[(i+1)%a.length]))}return union(h)}function linear_extrude(p,s){var h=1,off=0,twist=0,slices=10;if(p.height)h=p.height;if(p.twist)twist=p.twist;if(p.slices)slices=p.slices;var o=s.extrude({offset:[0,0,h],twistangle:twist,twiststeps:slices});if(p.center==true){var b=new Array;b=o.getBounds();off=b[1].plus(b[0]);off=off.times(-.5);o=o.translate(off)}return o}function rotate_extrude(p,o){var fn=32;if(arguments.length<2){o=p}else if(p!==undefined){fn=p.fn}if(fn<3)fn=3;var ps=[];for(var i=0;i<fn;i++){for(var j=0;j<o.sides.length;j++){var p=[];var m;m=new CSG.Matrix4x4.rotationZ(i/fn*360);p[0]=new CSG.Vector3D(o.sides[j].vertex0.pos.x,0,o.sides[j].vertex0.pos.y);p[0]=m.rightMultiply1x3Vector(p[0]);p[1]=new CSG.Vector3D(o.sides[j].vertex1.pos.x,0,o.sides[j].vertex1.pos.y);p[1]=m.rightMultiply1x3Vector(p[1]);m=new CSG.Matrix4x4.rotationZ((i+1)/fn*360);p[2]=new CSG.Vector3D(o.sides[j].vertex1.pos.x,0,o.sides[j].vertex1.pos.y);p[2]=m.rightMultiply1x3Vector(p[2]);p[3]=new CSG.Vector3D(o.sides[j].vertex0.pos.x,0,o.sides[j].vertex0.pos.y);p[3]=m.rightMultiply1x3Vector(p[3]);var p1=new CSG.Polygon([new CSG.Vertex(p[0]),new CSG.Vertex(p[1]),new CSG.Vertex(p[2]),new CSG.Vertex(p[3])]);ps.push(p1)}}return CSG.fromPolygons(ps)}function rectangular_extrude(pa,p){var w=1,h=1,fn=8,closed=false,round=true;if(p){if(p.w)w=p.w;if(p.h)h=p.h;if(p.fn)fn=p.fn;if(p.closed!==undefined)closed=p.closed;if(p.round!==undefined)round=p.round}return new CSG.Path2D(pa,closed).rectangularExtrude(w,h,fn,round)}function square(){var v=[1,1],off;var a=arguments,p=a[0];if(p&&!p.size)v=[p,p];if(p&&p.length)v=a[0],p=a[1];if(p&&p.size&&p.size.length)v=p.size;off=[v[0]/2,v[1]/2];if(p&&p.center==true)off=[0,0];var o=CAG.rectangle({center:off,radius:[v[0]/2,v[1]/2]});return o}function circle(){var r=1,off,fn=32;var a=arguments,p=a[0];if(p&&p.r)r=p.r;if(p&&p.fn)fn=p.fn;if(p&&!p.r&&!p.fn&&!p.center)r=p;off=[r,r];if(p&&p.center==true){off=[0,0]}var o=CAG.circle({center:off,radius:r,resolution:fn});return o}function polygon(p){var points=new Array;if(p.paths&&p.paths.length&&p.paths[0].length){for(var j=0;j<p.paths.length;j++){for(var i=0;i<p.paths[j].length;i++){points[i]=p.points[p.paths[j][i]]}}}else if(p.paths&&p.paths.length){for(var i=0;i<p.paths.length;i++){points[i]=p.points[p.paths[i]]}}else{if(p.length){points=p}else{points=p.points}}return CAG.fromPoints(points)}function triangle(){var a=arguments;if(a[0]&&a[0].length)a=a[0];var o=CAG.fromPoints(a);return o}function sin(a){return Math.sin(a/360*Math.PI*2)}function cos(a){return Math.cos(a/360*Math.PI*2)}function asin(a){return Math.asin(a)/(Math.PI*2)*360}function acos(a){return Math.acos(a)/(Math.PI*2)*360}function tan(a){return Math.tan(a/360*Math.PI*2)}function atan(a){return Math.atan(a)/(Math.PI*2)*360}function atan2(a,b){return Math.atan2(a,b)/(Math.PI*2)*360}function ceil(a){return Math.ceil(a)}function floor(a){return Math.floor(a)}function abs(a){return Math.abs(a)}function min(a,b){return a<b?a:b}function max(a,b){return a>b?a:b}function rands(min,max,vn,seed){var v=new Array(vn);for(var i=0;i<vn;i++){v[i]=Math.random()*(max-min)+min}}function log(a){return Math.log(a)}function lookup(ix,v){var r=0;for(var i=0;i<v.length;i++){var a0=v[i];if(a0[0]>=ix){i--;a0=v[i];var a1=v[i+1];var m=0;if(a0[0]!=a1[0]){m=abs((ix-a0[0])/(a1[0]-a0[0]))}if(m>0){r=a0[1]*(1-m)+a1[1]*m}else{r=a0[1]}return r}}return r}function pow(a,b){return Math.pow(a,b)}function sign(a){return a<0?-1:a>1?1:0}function sqrt(a){return Math.sqrt(a)}function round(a){return floor(a+.5)}function echo(){var s="",a=arguments;for(var i=0;i<a.length;i++){if(i)s+=", ";s+=a[i]}if(typeof OpenJsCad!=="undefined"){OpenJsCad.log(s)}else{console.log(s)}}function status(s){if(typeof document!=="undefined"){document.getElementById("statusspan").innerHTML=s}else{echo(s)}}function rgb2hsl(r,g,b){if(r.length){b=r[2],g=r[1],r=r[0]}var max=Math.max(r,g,b),min=Math.min(r,g,b);var h,s,l=(max+min)/2;if(max==min){h=s=0}else{var d=max-min;s=l>.5?d/(2-max-min):d/(max+min);switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break}h/=6}return[h,s,l]}function hsl2rgb(h,s,l){if(h.length){l=h[2],s=h[1],h=h[0]}var r,g,b;if(s==0){r=g=b=l}else{function hue2rgb(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p}var q=l<.5?l*(1+s):l+s-l*s;var p=2*l-q;r=hue2rgb(p,q,h+1/3);g=hue2rgb(p,q,h);b=hue2rgb(p,q,h-1/3)}return[r,g,b]}function rgb2hsv(r,g,b){if(r.length){b=r[2],g=r[1],r=r[0]}var max=Math.max(r,g,b),min=Math.min(r,g,b);var h,s,v=max;var d=max-min;s=max==0?0:d/max;if(max==min){h=0}else{switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break}h/=6}return[h,s,v]}function hsv2rgb(h,s,v){if(h.length){v=h[2],s=h[1],h=h[0]}var r,g,b;var i=Math.floor(h*6);var f=h*6-i;var p=v*(1-s);var q=v*(1-f*s);var t=v*(1-(1-f)*s);switch(i%6){case 0:r=v,g=t,b=p;break;case 1:r=q,g=v,b=p;break;case 2:r=p,g=v,b=t;break;case 3:r=p,g=q,b=v;break;case 4:r=t,g=p,b=v;break;case 5:r=v,g=p,b=q;break}return[r,g,b]}function vector_char(x,y,c){c=c.charCodeAt(0);c-=32;if(c<0||c>=95)return{width:0,segments:[]};var off=c*112;var n=simplexFont[off++];var w=simplexFont[off++];var l=[];var segs=[];for(var i=0;i<n;i++){var xp=simplexFont[off+i*2];var yp=simplexFont[off+i*2+1];if(xp==-1&&yp==-1){segs.push(l);l=[]}else{l.push([xp+x,yp+y])}}if(l.length)segs.push(l);return{width:w,segments:segs}}function vector_text(x,y,s){var o=[];var x0=x;for(var i=0;i<s.length;i++){var c=s.charAt(i);if(c=="\\n"){x=x0;y-=30}else{var d=vector_char(x,y,c);x+=d.width;o=o.concat(d.segments)}}return o}'
workerscript += 'var simplexFont=[0,16,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,10,5,21,5,7,-1,-1,5,2,4,1,5,0,6,1,5,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,16,4,21,4,14,-1,-1,12,21,12,14,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,21,11,25,4,-7,-1,-1,17,25,10,-7,-1,-1,4,12,18,12,-1,-1,3,6,17,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,26,20,8,25,8,-4,-1,-1,12,25,12,-4,-1,-1,17,18,15,20,12,21,8,21,5,20,3,18,3,16,4,14,5,13,7,12,13,10,15,9,16,8,17,6,17,3,15,1,12,0,8,0,5,1,3,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,31,24,21,21,3,0,-1,-1,8,21,10,19,10,17,9,15,7,14,5,14,3,16,3,18,4,20,6,21,8,21,10,20,13,19,16,19,19,20,21,21,-1,-1,17,7,15,6,14,4,14,2,16,0,18,0,20,1,21,3,21,5,19,7,17,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,34,26,23,12,23,13,22,14,21,14,20,13,19,11,17,6,15,3,13,1,11,0,7,0,5,1,4,2,3,4,3,6,4,8,5,9,12,13,13,14,14,16,14,18,13,20,11,21,9,20,8,18,8,16,9,13,11,10,16,3,18,1,20,0,22,0,23,1,23,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,10,5,19,4,20,5,21,6,20,6,18,5,16,4,15,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,14,11,25,9,23,7,20,5,16,4,11,4,7,5,2,7,-2,9,-5,11,-7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,14,3,25,5,23,7,20,9,16,10,11,10,7,9,2,7,-2,5,-5,3,-7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,16,8,21,8,9,-1,-1,3,18,13,12,-1,-1,13,18,3,12,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,26,13,18,13,0,-1,-1,4,9,22,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,10,6,1,5,0,4,1,5,2,6,1,6,-1,5,-3,4,-4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,26,4,9,22,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,10,5,2,4,1,5,0,6,1,5,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,22,20,25,2,-7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,17,20,9,21,6,20,4,17,3,12,3,9,4,4,6,1,9,0,11,0,14,1,16,4,17,9,17,12,16,17,14,20,11,21,9,21,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,20,6,17,8,18,11,21,11,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,14,20,4,16,4,17,5,19,6,20,8,21,12,21,14,20,15,19,16,17,16,15,15,13,13,10,3,0,17,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,15,20,5,21,16,21,10,13,13,13,15,12,16,11,17,8,17,6,16,3,14,1,11,0,8,0,5,1,4,2,3,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,6,20,13,21,3,7,18,7,-1,-1,13,21,13,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,17,20,15,21,5,21,4,12,5,13,8,14,11,14,14,13,16,11,17,8,17,6,16,3,14,1,11,0,8,0,5,1,4,2,3,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,23,20,16,18,15,20,12,21,10,21,7,20,5,17,4,12,4,7,5,3,7,1,10,0,11,0,14,1,16,3,17,6,17,7,16,10,14,12,11,13,10,13,7,12,5,10,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,20,17,21,7,0,-1,-1,3,21,17,21,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,29,20,8,21,5,20,4,18,4,16,5,14,7,13,11,12,14,11,16,9,17,7,17,4,16,2,15,1,12,0,8,0,5,1,4,2,3,4,3,7,4,9,6,11,9,12,13,13,15,14,16,16,16,18,15,20,12,21,8,21,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,23,20,16,14,15,11,13,9,10,8,9,8,6,9,4,11,3,14,3,15,4,18,6,20,9,21,10,21,13,20,15,18,16,14,16,9,15,4,13,1,10,0,8,0,5,1,4,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,10,5,14,4,13,5,12,6,13,5,14,-1,-1,5,2,4,1,5,0,6,1,5,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,14,10,5,14,4,13,5,12,6,13,5,14,-1,-1,6,1,5,0,4,1,5,2,6,1,6,-1,5,-3,4,-4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,24,20,18,4,9,20,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,26,4,12,22,12,-1,-1,4,6,22,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,24,4,18,20,9,4,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,20,18,3,16,3,17,4,19,5,20,7,21,11,21,13,20,14,19,15,17,15,15,14,13,13,12,9,10,9,7,-1,-1,9,2,8,1,9,0,10,1,9,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,55,27,18,13,17,15,15,16,12,16,10,15,9,14,8,11,8,8,9,6,11,5,14,5,16,6,17,8,-1,-1,12,16,10,14,9,11,9,8,10,6,11,5,-1,-1,18,16,17,8,17,6,19,5,21,5,23,7,24,10,24,12,23,15,22,17,20,19,18,20,15,21,12,21,9,20,7,19,5,17,4,15,3,12,3,9,4,6,5,4,7,2,9,1,12,0,15,0,18,1,20,2,21,3,-1,-1,19,16,18,8,18,6,19,5,8,18,9,21,1,0,-1,-1,9,21,17,0,-1,-1,4,7,14,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,23,21,4,21,4,0,-1,-1,4,21,13,21,16,20,17,19,18,17,18,15,17,13,16,12,13,11,-1,-1,4,11,13,11,16,10,17,9,18,7,18,4,17,2,16,1,13,0,4,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,18,21,18,16,17,18,15,20,13,21,9,21,7,20,5,18,4,16,3,13,3,8,4,5,5,3,7,1,9,0,13,0,15,1,17,3,18,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,15,21,4,21,4,0,-1,-1,4,21,11,21,14,20,16,18,17,16,18,13,18,8,17,5,16,3,14,1,11,0,4,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,19,4,21,4,0,-1,-1,4,21,17,21,-1,-1,4,11,12,11,-1,-1,4,0,17,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,18,4,21,4,0,-1,-1,4,21,17,21,-1,-1,4,11,12,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,22,21,18,16,17,18,15,20,13,21,9,21,7,20,5,18,4,16,3,13,3,8,4,5,5,3,7,1,9,0,13,0,15,1,17,3,18,5,18,8,-1,-1,13,8,18,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,22,4,21,4,0,-1,-1,18,21,18,0,-1,-1,4,11,18,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,8,4,21,4,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,16,12,21,12,5,11,2,10,1,8,0,6,0,4,1,3,2,2,5,2,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,21,4,21,4,0,-1,-1,18,21,4,7,-1,-1,9,12,18,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,17,4,21,4,0,-1,-1,4,0,16,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,24,4,21,4,0,-1,-1,4,21,12,0,-1,-1,20,21,12,0,-1,-1,20,21,20,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,22,4,21,4,0,-1,-1,4,21,18,0,-1,-1,18,21,18,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,21,22,9,21,7,20,5,18,4,16,3,13,3,8,4,5,5,3,7,1,9,0,13,0,15,1,17,3,18,5,19,8,19,13,18,16,17,18,15,20,13,21,9,21,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,13,21,4,21,4,0,-1,-1,4,21,13,21,16,20,17,19,18,17,18,14,17,12,16,11,13,10,4,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,24,22,9,21,7,20,5,18,4,16,3,13,3,8,4,5,5,3,7,1,9,0,13,0,15,1,17,3,18,5,19,8,19,13,18,16,17,18,15,20,13,21,9,21,-1,-1,12,4,18,-2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,16,21,4,21,4,0,-1,-1,4,21,13,21,16,20,17,19,18,17,18,15,17,13,16,12,13,11,4,11,-1,-1,11,11,18,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,20,20,17,18,15,20,12,21,8,21,5,20,3,18,3,16,4,14,5,13,7,12,13,10,15,9,16,8,17,6,17,3,15,1,12,0,8,0,5,1,3,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,16,8,21,8,0,-1,-1,1,21,15,21,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,22,4,21,4,6,5,3,7,1,10,0,12,0,15,1,17,3,18,6,18,21,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,18,1,21,9,0,-1,-1,17,21,9,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,24,2,21,7,0,-1,-1,12,21,7,0,-1,-1,12,21,17,0,-1,-1,22,21,17,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,20,3,21,17,0,-1,-1,17,21,3,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,6,18,1,21,9,11,9,0,-1,-1,17,21,9,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,20,17,21,3,0,-1,-1,3,21,17,21,-1,-1,3,0,17,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,14,4,25,4,-7,-1,-1,5,25,5,-7,-1,-1,4,25,11,25,-1,-1,4,-7,11,-7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,14,0,21,14,-3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,14,9,25,9,-7,-1,-1,10,25,10,-7,-1,-1,3,25,10,25,-1,-1,3,-7,10,-7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,16,6,15,8,18,10,15,-1,-1,3,12,8,17,13,12,-1,-1,8,17,8,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,16,0,-2,16,-2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,10,6,21,5,20,4,18,4,16,5,15,6,16,5,17,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,17,19,15,14,15,0,-1,-1,15,11,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,17,19,4,21,4,0,-1,-1,4,11,6,13,8,14,11,14,13,13,15,11,16,8,16,6,15,3,13,1,11,0,8,0,6,1,4,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,14,18,15,11,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,17,19,15,21,15,0,-1,-1,15,11,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,17,18,3,8,15,8,15,10,14,12,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,12,10,21,8,21,6,20,5,17,5,0,-1,-1,2,14,9,14,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,22,19,15,14,15,-2,14,-5,13,-6,11,-7,8,-7,6,-6,-1,-1,15,11,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,19,4,21,4,0,-1,-1,4,10,7,13,9,14,12,14,14,13,15,10,15,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,8,3,21,4,20,5,21,4,22,3,21,-1,-1,4,14,4,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,10,5,21,6,20,7,21,6,22,5,21,-1,-1,6,14,6,-3,5,-6,3,-7,1,-7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,17,4,21,4,0,-1,-1,14,14,4,4,-1,-1,8,8,15,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,8,4,21,4,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,18,30,4,14,4,0,-1,-1,4,10,7,13,9,14,12,14,14,13,15,10,15,0,-1,-1,15,10,18,13,20,14,23,14,25,13,26,10,26,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,19,4,14,4,0,-1,-1,4,10,7,13,9,14,12,14,14,13,15,10,15,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,17,19,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3,16,6,16,8,15,11,13,13,11,14,8,14,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,17,19,4,14,4,-7,-1,-1,4,11,6,13,8,14,11,14,13,13,15,11,16,8,16,6,15,3,13,1,11,0,8,0,6,1,4,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,17,19,15,14,15,-7,-1,-1,15,11,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,13,4,14,4,0,-1,-1,4,8,5,11,7,13,9,14,12,14,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,17,17,14,11,13,13,10,14,7,14,4,13,3,11,4,9,6,8,11,7,13,6,14,4,14,3,13,1,10,0,7,0,4,1,3,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,12,5,21,5,4,6,1,8,0,10,0,-1,-1,2,14,9,14,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,19,4,14,4,4,5,1,7,0,10,0,12,1,15,4,-1,-1,15,14,15,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,16,2,14,8,0,-1,-1,14,14,8,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,22,3,14,7,0,-1,-1,11,14,7,0,-1,-1,11,14,15,0,-1,-1,19,14,15,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,17,3,14,14,0,-1,-1,14,14,3,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,16,2,14,8,0,-1,-1,14,14,8,0,6,-4,4,-6,2,-7,1,-7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,17,14,14,3,0,-1,-1,3,14,14,14,-1,-1,3,0,14,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,39,14,9,25,7,24,6,23,5,21,5,19,6,17,7,16,8,14,8,12,6,10,-1,-1,7,24,6,22,6,20,7,18,8,17,9,15,9,13,8,11,4,9,8,7,9,5,9,3,8,1,7,0,6,-2,6,-4,7,-6,-1,-1,6,8,8,6,8,4,7,2,6,1,5,-1,5,-3,6,-5,7,-6,9,-7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,8,4,25,4,-7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,39,14,5,25,7,24,8,23,9,21,9,19,8,17,7,16,6,14,6,12,8,10,-1,-1,7,24,8,22,8,20,7,18,6,17,5,15,5,13,6,11,10,9,6,7,5,5,5,3,6,1,7,0,8,-2,8,-4,7,-6,-1,-1,8,8,6,6,6,4,7,2,8,1,9,-1,9,-3,8,-5,7,-6,5,-7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,23,24,3,6,3,8,4,11,6,12,8,12,10,11,14,8,16,7,18,7,20,8,21,10,-1,-1,3,8,4,10,6,11,8,11,10,10,14,7,16,6,18,6,20,7,21,10,21,12,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];function parseAMF(amf,fn){var xml,err="";try{xml=$.parseXML(amf)}catch(e){echo("XML parsing error:",e.message.substring(0,120)+"..");err+="XML parsing error / invalid XML"}var v=[];var f=[];var nv=0,np=0;var src="",srci="";srci="\\tvar pgs = [];\\n";var meta=[];var metatag=$(xml).find("metadata");metatag.each(function(){var el=$(this);meta[el.attr("type")]=el.text()});var obj=$(xml).find("object");obj.each(function(){var el=$(this);var mesh=el.find("mesh");mesh.each(function(){var el=$(this);var c=[];var co=el.find("color");var rgbm=[];if(co.length){rgbm=[co.find("r").first().text(),co.find("g").first().text(),co.find("b").first().text()];if(co.find("a").length)rgbm=rgbm.concat(co.find("a").first().text())}v=[];f=[];nv=0;var vertices=el.find("vertices");var sn=nv;vertices.each(function(){var el=$(this);var vertex=el.find("vertex");vertex.each(function(){var el=$(this);var x=el.find("x").text();var y=el.find("y").text();var z=el.find("z").text();v.push([x,y,z]);nv++})});var volume=el.find("volume");volume.each(function(){var el=$(this);var rgbv=[],co=el.find("color");if(co.length){rgbv=[co.find("r").first().text(),co.find("g").first().text(),co.find("b").first().text()]'
workerscript += ';if(co.find("a").length)rgbv=rgbv.concat(co.find("a").first().text())}var triangle=el.find("triangle");triangle.each(function(){var el=$(this);var rgbt=[],co=el.find("color");if(co.length){rgbt=[co.find("r").first().text(),co.find("g").first().text(),co.find("b").first().text()];if(co.find("a").length)rgbt=rgbt.concat(co.find("a").first().text())}var v1=parseInt(el.find("v1").first().text());var v2=parseInt(el.find("v2").first().text());var v3=parseInt(el.find("v3").first().text());if(rgbm.length||rgbv.length||rgbt.length)c[f.length]=rgbt.length?rgbt:rgbv.length?rgbv:rgbm;f.push([v1+sn,v2+sn,v3+sn]);var maps=el.find("map");maps.each(function(){})})});var textures=el.find("texture");textures.each(function(){});for(var i=0;i<f.length;i++){srci+="\\tpgs.push(PP([\\n\\t\\t";for(var j=0;j<f[i].length;j++){if(f[i][j]<0||f[i][j]>=v.length){if(err.length=="")err+="bad index for vertice (out of range)";continue}if(j)srci+=",\\n\\t\\t";srci+="VV("+v[f[i][j]]+")"}srci+="])";if(c[i])srci+=".setColor("+c[i]+")";srci+=");\\n";np++}})});var src="";for(var k in meta){src+="// AMF."+k+": "+meta[k]+"\\n"}src+="// producer: OpenJSCAD "+me.toUpperCase()+" "+version+" AMF Importer\\n";src+="// date: "+new Date+"\\n";src+="// source: "+fn+"\\n";src+="\\n";if(err)src+="// WARNING: import errors: "+err+" (some triangles might be misaligned or missing)\\n";src+="// objects: 1\\n// object #1: polygons: "+np+"\\n\\n";src+="function main() {\\n";src+="\\tvar PP = function(a) { return new CSG.Polygon(a); }\\n";src+="\\tvar VV = function(x,y,z) { return new CSG.Vertex(new CSG.Vector3D(x,y,z)); }\\n";src+=srci;src+="\\treturn CSG.fromPolygons(pgs);\\n}\\n";return src}function parseOBJ(obj,fn){var l=obj.split(/\\n/);var v=[],f=[];for(var i=0;i<l.length;i++){var s=l[i];var a=s.split(/\\s+/);if(a[0]=="v"){v.push([a[1],a[2],a[3]])}else if(a[0]=="f"){var fc=[];var skip=0;for(var j=1;j<a.length;j++){var c=a[j];c=c.replace(/\\/.*$/,"");c--;if(c>=v.length)skip++;if(skip==0)fc.push(c)}if(skip==0)f.push(fc)}else{}}var src="";src+="// producer: OpenJSCAD "+me.toUpperCase()+" "+version+" Wavefront OBJ Importer\\n";src+="// date: "+new Date+"\\n";src+="// source: "+fn+"\\n";src+="\\n";src+="// objects: 1\\n// object #1: polygons: "+f.length+"\\n\\n";src+="function main() { return ";src+=vt2jscad(v,f);src+="; }";return src}function parseSTL(stl,fn){var isAscii=true;for(var i=0;i<stl.length;i++){if(stl[i].charCodeAt(0)==0){isAscii=false;break}}var src;if(!isAscii){src=parseBinarySTL(stl,fn)}else{src=parseAsciiSTL(stl,fn)}return src}function parseBinarySTL(stl,fn){var vertices=[];var triangles=[];var normals=[];var vertexIndex=0;var converted=0;var err=0;var br=new BinaryReader(stl);br.seek(80);var totalTriangles=br.readUInt32();for(var tr=0;tr<totalTriangles;tr++){var no=[];no.push(br.readFloat());no.push(br.readFloat());no.push(br.readFloat());var v1=[];v1.push(br.readFloat());v1.push(br.readFloat());v1.push(br.readFloat());var v2=[];v2.push(br.readFloat());v2.push(br.readFloat());v2.push(br.readFloat());var v3=[];v3.push(br.readFloat());v3.push(br.readFloat());v3.push(br.readFloat());var skip=0;if(1){for(var i=0;i<3;i++){if(isNaN(v1[i]))skip++;if(isNaN(v2[i]))skip++;if(isNaN(v3[i]))skip++;if(isNaN(no[i]))skip++}if(skip>0){echo("bad triangle vertice coords/normal: ",skip)}}err+=skip;var triangle=[];triangle.push(vertexIndex++);triangle.push(vertexIndex++);triangle.push(vertexIndex++);br.readUInt16();if(skip==0){var w1=new CSG.Vector3D(v1);var w2=new CSG.Vector3D(v2);var w3=new CSG.Vector3D(v3);var e1=w2.minus(w1);var e2=w3.minus(w1);var t=new CSG.Vector3D(no).dot(e1.cross(e2));if(t>0){var tmp=v3;v3=v1;v1=tmp}}vertices.push(v1);vertices.push(v2);vertices.push(v3);triangles.push(triangle);normals.push(no);converted++}var src="";src+="// producer: OpenJSCAD "+me.toUpperCase()+" "+version+" STL Binary Importer\\n";src+="// date: "+new Date+"\\n";src+="// source: "+fn+"\\n";src+="\\n";if(err)src+="// WARNING: import errors: "+err+" (some triangles might be misaligned or missing)\\n";src+="// objects: 1\\n// object #1: triangles: "+totalTriangles+"\\n\\n";src+="function main() { return ";src+=vt2jscad(vertices,triangles,normals);src+="; }";return src}function parseAsciiSTL(stl,fn){var src="";var n=0;var converted=0;var o;src+="// producer: OpenJSCAD "+me.toUpperCase()+" "+version+" STL ASCII Importer\\n";src+="// date: "+new Date+"\\n";src+="// source: "+fn+"\\n";src+="\\n";src+="function main() { return union(\\n";var objects=stl.split("endsolid");src+="// objects: "+(objects.length-1)+"\\n";for(o=1;o<objects.length;o++){var patt=/\\bfacet[\\s\\S]*?endloop/gim;var vertices=[];var triangles=[];var normals=[];var vertexIndex=0;var err=0;match=stl.match(patt);if(match==null)continue;for(var i=0;i<match.length;i++){var vpatt=/\\bfacet\\s+normal\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+outer\\s+loop\\s+vertex\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+vertex\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+vertex\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s*/gim;var v=vpatt.exec(match[i]);if(v==null)continue;if(v.length!=13){echo("Failed to parse "+match[i]);break}var skip=0;for(var k=0;k<v.length;k++){if(v[k]=="NaN"){echo("bad normal or triangle vertice #"+converted+" "+k+": \'"+v[k]+"\', skipped");skip++}}err+=skip;if(skip){continue}if(0&&skip){var j=1+3;var v1=[];v1.push(parseFloat(v[j++]));v1.push(parseFloat(v[j++]));v1.push(parseFloat(v[j++]));var v2=[];v2.push(parseFloat(v[j++]));v2.push(parseFloat(v[j++]));v2.push(parseFloat(v[j++]));var v3=[];v3.push(parseFloat(v[j++]));v3.push(parseFloat(v[j++]));v3.push(parseFloat(v[j++]));echo("recalculate norm",v1,v2,v3);var w1=new CSG.Vector3D(v1);var w2=new CSG.Vector3D(v2);var w3=new CSG.Vector3D(v3);var _u=w1.minus(w3);var _v=w1.minus(w2);var norm=_u.cross(_v).unit();j=1;v[j++]=norm._x;v[j++]=norm._y;v[j++]=norm._z;skip=false}var j=1;var no=[];no.push(parseFloat(v[j++]));no.push(parseFloat(v[j++]));no.push(parseFloat(v[j++]));var v1=[];v1.push(parseFloat(v[j++]));v1.push(parseFloat(v[j++]));v1.push(parseFloat(v[j++]));var v2=[];v2.push(parseFloat(v[j++]));v2.push(parseFloat(v[j++]));v2.push(parseFloat(v[j++]));var v3=[];v3.push(parseFloat(v[j++]));v3.push(parseFloat(v[j++]));v3.push(parseFloat(v[j++]));var triangle=[];triangle.push(vertexIndex++);triangle.push(vertexIndex++);triangle.push(vertexIndex++);if(skip==0){var w1=new CSG.Vector3D(v1);var w2=new CSG.Vector3D(v2);var w3=new CSG.Vector3D(v3);var e1=w2.minus(w1);var e2=w3.minus(w1);var t=new CSG.Vector3D(no).dot(e1.cross(e2));if(t>0){var tmp=v3;v3=v1;v1=tmp}}vertices.push(v1);vertices.push(v2);vertices.push(v3);normals.push(no);triangles.push(triangle);converted++}if(n++)src+=",";if(err)src+="// WARNING: import errors: "+err+" (some triangles might be misaligned or missing)\\n";src+="// object #"+o+": triangles: "+match.length+"\\n";src+=vt2jscad(vertices,triangles,normals)}src+="); }\\n";return src}function vt2jscad(v,t,n,c){var src="";src+="polyhedron({ points: [\\n\\t";for(var i=0,j=0;i<v.length;i++){if(j++)src+=",\\n\\t";src+="["+v[i]+"]"}src+="],\\n\\tpolygons: [\\n\\t";for(var i=0,j=0;i<t.length;i++){if(j++)src+=",\\n\\t";src+="["+t[i]+"]"}src+="] })\\n";return src}BinaryReader=function(data){this._buffer=data;this._pos=0};BinaryReader.prototype={readInt8:function(){return this._decodeInt(8,true)},readUInt8:function(){return this._decodeInt(8,false)},readInt16:function(){return this._decodeInt(16,true)},readUInt16:function(){return this._decodeInt(16,false)},readInt32:function(){return this._decodeInt(32,true)},readUInt32:function(){return this._decodeInt(32,false)},readFloat:function(){return this._decodeFloat(23,8)},readDouble:function(){return this._decodeFloat(52,11)},readChar:function(){return this.readString(1)},readString:function(length){this._checkSize(length*8);var result=this._buffer.substr(this._pos,length);this._pos+=length;return result},seek:function(pos){this._pos=pos;this._checkSize(0)},getPosition:function(){return this._pos},getSize:function(){return this._buffer.length},_decodeFloat:function(precisionBits,exponentBits){var length=precisionBits+exponentBits+1;var size=length>>3;this._checkSize(length);var bias=Math.pow(2,exponentBits-1)-1;var signal=this._readBits(precisionBits+exponentBits,1,size);var exponent=this._readBits(precisionBits,exponentBits,size);var significand=0;var divisor=2;var curByte=0;do{var byteValue=this._readByte(++curByte,size);var startBit=precisionBits%8||8;var mask=1<<startBit;while(mask>>=1){if(byteValue&mask){significand+=1/divisor}divisor*=2}}while(precisionBits-=startBit);this._pos+=size;return exponent==(bias<<1)+1?significand?NaN:signal?-Infinity:+Infinity:(1+signal*-2)*(exponent||significand?!exponent?Math.pow(2,-bias+1)*significand:Math.pow(2,exponent-bias)*(1+significand):0)},_decodeInt:function(bits,signed){var x=this._readBits(0,bits,bits/8),max=Math.pow(2,bits);var result=signed&&x>=max/2?x-max:x;this._pos+=bits/8;return result},_shl:function(a,b){for(++b;--b;a=((a%=2147483647+1)&1073741824)==1073741824?a*2:(a-1073741824)*2+2147483647+1);return a},_readByte:function(i,size){return this._buffer.charCodeAt(this._pos+size-i-1)&255},_readBits:function(start,length,size){var offsetLeft=(start+length)%8;var offsetRight=start%8;var curByte=size-(start>>3)-1;var lastByte=size+(-(start+length)>>3);var diff=curByte-lastByte;var sum=this._readByte(curByte,size)>>offsetRight&(1<<(diff?8-offsetRight:length))-1;if(diff&&offsetLeft){sum+=(this._readByte(lastByte++,size)&(1<<offsetLeft)-1)<<(diff--<<3)-offsetRight}while(diff){sum+=this._shl(this._readByte(lastByte++,size),(diff--<<3)-offsetRight)}return sum},_checkSize:function(neededBits){if(!(this._pos+Math.ceil(neededBits/8)<this._buffer.length)){}}};function parseGCode(gcode,fn){var l=gcode.split(/[\\n]/);var srci="";var d=0,pos=[],lpos=[],le=0,ld=0,p=[];var origin=[-100,-100];var layers=0;var lh=.35,lz=0;for(var i=0;i<l.length;i++){var val="",k,e=0;if(l[i].match(/^\\s*;/))continue;var c=l[i].split(/\\s+/);for(var j=0;j<c.length;j++){if(c[j].match(/G(\\d+)/)){var n=parseInt(RegExp.$1);if(n==1)d++;if(n==90)pos.type="abs";if(n==91)pos.type="rel"}else if(c[j].match(/M(\\d+)/)){var n=parseInt(RegExp.$1);if(n==104||n==109)k="temp"}else if(c[j].match(/S([\\d\\.]+)/)){var v=parseInt(RegExp.$1);if(k!==undefined)val[k]=v}else if(c[j].match(/([XYZE])([\\-\\d\\.]+)/)){var a=RegExp.$1,v=parseFloat(RegExp.$2);if(pos.type=="abs"){if(d)pos[a]=v}else{if(d)pos[a]+=v}if(d&&a=="E"&&lpos.E===undefined)lpos.E=pos.E;if(d&&a=="E"&&pos.E-lpos.E>0){e++}}}if(d&&pos.X&&pos.Y){if(e){if(!le&&lpos.X&&lpos.Y){p.push("["+(lpos.X+origin[0])+","+(lpos.Y+origin[1])+"]")}p.push("["+(pos.X+origin[0])+","+(pos.Y+origin[1])+"]")}if(!e&&le&&p.length>1){if(srci.length)srci+=",\\n\\t\\t";if(pos.Z!=lz){lh=pos.Z-lz;layers++}srci+="EX(["+p.join(", ")+"],{w: "+lh*1.1+", h:"+lh*1.02+", fn:1, closed: false}).translate([0,0,"+pos["Z"]+"])";p=[];lz=pos.Z}le=e;lpos.X=pos.X;lpos.Y=pos.Y;lpos.Z=pos.Z;lpos.E=pos.E}ld=d}var src="";src+="// producer: OpenJSCAD "+me.toUpperCase()+" "+version+" GCode Importer\\n";src+="// date: "+new Date+"\\n";src+="// source: "+fn+"\\n";src+="\\n";src+="// layers: "+layers+"\\n";src+="function main() {\\n\\tvar EX = function(p,opt) { return rectangular_extrude(p,opt); }\\n\\treturn [";src+=srci;src+="\\n\\t];\\n}\\n";return src}function clone(obj){if(null==obj||"object"!=typeof obj)return obj;var copy=obj.constructor();for(var attr in obj){if(obj.hasOwnProperty(attr))copy[attr]=obj[attr]}return copy}sprintf=function(){function get_type(variable){return Object.prototype.toString.call(variable).slice(8,-1).toLowerCase()}function str_repeat(input,multiplier){for(var output=[];multiplier>0;output[--multiplier]=input){}return output.join("")}var str_format=function(){if(!str_format.cache.hasOwnProperty(arguments[0])){str_format.cache[arguments[0]]=str_format.parse(arguments[0])}return str_format.format.call(null,str_format.cache[arguments[0]],arguments)};str_format.format=function(parse_tree,argv){var cursor=1,tree_length=parse_tree.length,node_type="",arg,output=[],i,k,match,pad,pad_character,pad_length;for(i=0;i<tree_length;i++){node_type=get_type(parse_tree[i]);if(node_type==="string"){output.push(parse_tree[i])}else if(node_type==="array"){match=parse_tree[i];if(match[2]){arg=argv[cursor];for(k=0;k<match[2].length;k++){if(!arg.hasOwnProperty(match[2][k])){throw sprintf(\'[sprintf] property "%s" does not exist\',match[2][k])}arg=arg[match[2][k]]}}else if(match[1]){arg=argv[match[1]]}else{arg=argv[cursor++]}if(/[^s]/.test(match[8])&&get_type(arg)!="number"){throw sprintf("[sprintf] expecting number but found %s",get_type(arg))}switch(match[8]){case"b":arg=arg.toString(2);break;case"c":arg=String.fromCharCode(arg);break;case"d":arg=parseInt(arg,10);break;case"e":arg=match[7]?arg.toExponential(match[7]):arg.toExponential();break;case"f":arg=match[7]?parseFloat(arg).toFixed(match[7]):parseFloat(arg);break;case"o":arg=arg.toString(8);break;case"s":arg=(arg=String(arg))&&match[7]?arg.substring(0,match[7]):arg;break;case"u":arg=Math.abs(arg);break;case"x":arg=arg.toString(16);break;case"X":arg=arg.toString(16).toUpperCase();break}arg=/[def]/.test(match[8])&&match[3]&&arg>=0?"+"+arg:arg;pad_character=match[4]?match[4]=="0"?"0":match[4].charAt(1):" ";pad_length=match[6]-String(arg).length;pad=match[6]?str_repeat(pad_character,pad_length):"";output.push(match[5]?arg+pad:pad+arg)}}return output.join("")};str_format.cache={};str_format.parse=function(fmt){var _fmt=fmt,match=[],parse_tree=[],arg_names=0;while(_fmt){if((match=/^[^\\x25]+/.exec(_fmt))!==null){parse_tree.push(match[0])}else if((match=/^\\x25{2}/.exec(_fmt))!==null){parse_tree.push("%")}else if((match=/^\\x25(?:([1-9]\\d*)\\$|\\(([^\\)]+)\\))?(\\+)?(0|\'[^$])?(-)?(\\d+)?(?:\\.(\\d+))?([b-fosuxX])/.exec(_fmt))!==null){if(match[2]){arg_names|=1;var field_list=[],replacement_field=match[2],field_match=[];if((field_match=/^([a-z_][a-z_\\d]*)/i.exec(replacement_field))!==null){field_list.push(field_match[1]);while((replacement_field=replacement_field.substring(field_match[0].length))!==""){if((field_match=/^\\.([a-z_][a-z_\\d]*)/i.exec(replacement_field))!==null){field_list.push(field_match[1])}else if((field_match=/^\\[(\\d+)\\]/.exec(replacement_field))!==null){field_list.push(field_match[1])}else{throw"[sprintf] huh?"}}}else{throw"[sprintf] huh?"}match[2]=field_list}else{arg_names|=2}if(arg_names===3){throw"[sprintf] mixing positional and named placeholders is not (yet) supported"}parse_tree.push(match)}else{throw"[sprintf] huh?"}_fmt=_fmt.substring(match[0].length)}return parse_tree};return str_format}();vsprintf=function(fmt,argv){argv.unshift(fmt);return sprintf.apply(null,argv)};_getParameterDefinitions=function(param){if(typeof getParameterDefinitions!=="undefined"){var p={};var pa=getParameterDefinitions();for(var a in pa){p[pa[a].name]=pa[a].default||pa[a].initial}for(var a in param){p[a]=param[a]}if(0){for(var a in p){echo("param=",a,p[a])}}return p}else return param};if(typeof module!=="undefined"){var CSG=require("./csg.js").CSG;module.exports={parseSTL:parseSTL,parseAMF:parseAMF,CSG:CSG,color:color,group:group,union:union,difference:difference,intersection:intersection,simplexFont:simplexFont,vector_text:vector_text,vector_char:vector_char,hsv2rgb:hsv2rgb,rgb2hsv:rgb2hsv,hsl2rgb:hsl2rgb,rgb2hsl:rgb2hsl,pow:pow,sign:sign,sqrt:sqrt,round:round,log:log,lookup:lookup,rands:rands,atan:atan,atan2:atan2,ceil:ceil,floor:floor,abs:abs,min:min,max:max,tan:tan,acos:acos,cos:cos,asin:asin,sin:sin,triangle:triangle,polygon:polygon,circle:circle,square:square,rectangular_extrude:rectangular_extrude,rotate_extrude:rotate_extrude,linear_extrude:linear_extrude,chain_hull:chain_hull,hull:hull,minkowski:minkowski,multmatrix:multmatrix,expand:expand,contract:contract,mirror:mirror,rotate:rotate,scale:scale,center:center,translate:translate,polyhedron:polyhedron,torus:torus,cylinder:cylinder,geodesicSphere:geodesicSphere,sphere:sphere,cube:cube};me="cli"}'
/// HACK !!!!!


  workerscript += "var _csg_baselibraries=" + JSON.stringify(baselibraries)+";\n";
  workerscript += "var _csg_libraries=" + JSON.stringify(libraries)+";\n";
  workerscript += "var _csg_openjscadurl=" + JSON.stringify(openjscadurl)+";\n";
  workerscript += "var _csg_makeAbsoluteURL=" + OpenJsCad.makeAbsoluteUrl.toString()+";\n";
//  workerscript += "if(typeof(libs) == 'function') _csg_libraries = _csg_libraries.concat(libs());\n";
  workerscript += "_csg_baselibraries = _csg_baselibraries.map(function(l){return _csg_makeAbsoluteURL(l,_csg_openjscadurl);});\n";
  workerscript += "_csg_libraries = _csg_libraries.map(function(l){return _csg_makeAbsoluteURL(l,_csg_baseurl);});\n";
  workerscript += "_csg_baselibraries.map(function(l){importScripts(l)});\n";
  workerscript += "_csg_libraries.map(function(l){importScripts(l)});\n";
  workerscript += "self.addEventListener('message', function(e) {if(e.data && e.data.cmd == 'render'){";
  workerscript += "  OpenJsCad.runMainInWorker("+JSON.stringify(mainParameters)+");";
//  workerscript += "  if(typeof(main) != 'function') throw new Error('Your jscad file should contain a function main() which returns a CSG solid.');\n";
//  workerscript += "  var csg; try {csg = main("+JSON.stringify(mainParameters)+"); self.postMessage({cmd: 'rendered', csg: csg});}";
//  workerscript += "  catch(e) {var errtxt = e.stack; self.postMessage({cmd: 'error', err: errtxt});}";
  workerscript += "}},false);\n";

// trying to get include() somewhere: 
// 1) XHR fails: not allowed in blobs
// 2) importScripts() works for ASYNC <----
// 3) _csg_libraries.push(fn) provides only 1 level include()

  if(!ignoreInclude) {
     workerscript += "function include(fn) {\
  if(0) {\
    _csg_libraries.push(fn);\
  } else if(1) {\
   if(gMemFs[fn]) {\
      eval(gMemFs[fn]); return;\
   }\
    var url = _csg_baseurl+_includePath;\
    var index = url.indexOf('index.html');\
    if(index!=-1) {\
       url = url.substring(0,index);\
    }\
  	 importScripts(url+fn);\
  } else {\
   var xhr = new XMLHttpRequest();\
   xhr.open('GET', _includePath+fn, true);\
   xhr.onload = function() {\
      return eval(this.responseText);\
   };\
   xhr.onerror = function() {\
   };\
   xhr.send();\
  }\
}\
";
  } else {
     //workerscript += "function include() {}\n";
     workerscript += "function include(fn) { eval(gMemFs[fn]); }\n";
  }
  //workerscript += "function includePath(p) { _includePath = p; }\n";
  var blobURL = OpenJsCad.textToBlobUrl(workerscript);
  
  if(!window.Worker) throw new Error("Your browser doesn't support Web Workers. Please try the Chrome or Firefox browser instead.");
  var worker = new Worker(blobURL);
  worker.onmessage = function(e) {
    if(e.data)
    { 
      if(e.data.cmd == 'rendered')
      {
        var resulttype = e.data.result.class;
        var result;
        if(resulttype == "CSG")
        {
          result = CSG.fromCompactBinary(e.data.result);
        }
        else if(resulttype == "CAG")
        {
          result = CAG.fromCompactBinary(e.data.result);
        }
        else
        {
          throw new Error("Cannot parse result");
        }
        callback(null, result);
      }
      else if(e.data.cmd == "error")
      {
        callback(e.data.err, null);
      }
      else if(e.data.cmd == "log")
      {
        console.log(e.data.txt);
      }
    }
  };
  worker.onerror = function(e) {
    var errtxt = "Error in line "+e.lineno+": "+e.message;
    callback(errtxt, null);
  };
  worker.postMessage({
    cmd: "render"
  }); // Start the worker.
  return worker;
};

OpenJsCad.getWindowURL = function() {
  if(window.URL) return window.URL;
  else if(window.webkitURL) return window.webkitURL;
  else throw new Error("Your browser doesn't support window.URL");
};

OpenJsCad.textToBlobUrl = function(txt) {
  var windowURL=OpenJsCad.getWindowURL();
  var blob = new Blob([txt], { type : 'application/javascript' });
  var blobURL = windowURL.createObjectURL(blob);
  if(!blobURL) throw new Error("createObjectURL() failed"); 
  return blobURL;
};

OpenJsCad.revokeBlobUrl = function(url) {
  if(window.URL) window.URL.revokeObjectURL(url);
  else if(window.webkitURL) window.webkitURL.revokeObjectURL(url);
  else throw new Error("Your browser doesn't support window.URL");
};

OpenJsCad.FileSystemApiErrorHandler = function(fileError, operation) {
  var errormap = {
    1: 'NOT_FOUND_ERR',
    2: 'SECURITY_ERR',
    3: 'ABORT_ERR',
    4: 'NOT_READABLE_ERR',
    5: 'ENCODING_ERR',
    6: 'NO_MODIFICATION_ALLOWED_ERR',
    7: 'INVALID_STATE_ERR',
    8: 'SYNTAX_ERR',
    9: 'INVALID_MODIFICATION_ERR',
    10: 'QUOTA_EXCEEDED_ERR',
    11: 'TYPE_MISMATCH_ERR',
    12: 'PATH_EXISTS_ERR',
  };
  var errname;
  if(fileError.code in errormap)
  {
    errname = errormap[fileError.code];
  }
  else
  {
    errname = "Error #"+fileError.code;
  }
  var errtxt = "FileSystem API error: "+operation+" returned error "+errname;
  throw new Error(errtxt);
};

OpenJsCad.AlertUserOfUncaughtExceptions = function() {
  window.onerror = function(message, url, line) {
    message = message.replace(/^Uncaught /i, "");
    alert(message+"\n\n("+url+" line "+line+")");
  };
};

// parse the jscad script to get the parameter definitions
OpenJsCad.getParamDefinitions = function(script) {
  var scriptisvalid = true;
  script += "\nfunction include() {}";    // at least make it not throw an error so early
  try
  {
    // first try to execute the script itself
    // this will catch any syntax errors
    //    BUT we can't introduce any new function!!!
    (new Function(script))();
  }
  catch(e) {
    scriptisvalid = false;
  }
  var params = [];
  if(scriptisvalid)
  {
    var script1 = "if(typeof(getParameterDefinitions) == 'function') {return getParameterDefinitions();} else {return [];} ";
    script1 += script;
    var f = new Function(script1);
    params = f();
    if( (typeof(params) != "object") || (typeof(params.length) != "number") )
    {
      throw new Error("The getParameterDefinitions() function should return an array with the parameter definitions");
    }
  }
  return params;
};

OpenJsCad.Processor = function(containerdiv, onchange) {
  this.containerdiv = containerdiv;
  this.onchange = onchange;
  this.viewerdiv = null;
  this.viewer = null;
  this.zoomControl = null;
  //this.viewerwidth = 1200;
  //this.viewerheight = 800;
  this.initialViewerDistance = 100;
  this.currentObject = null;
  this.hasOutputFile = false;
  this.worker = null;
  this.paramDefinitions = [];
  this.paramControls = [];
  this.script = null;
  this.hasError = false;
  this.debugging = false;
  this.options = {};
  this.createElements();
// state of the processor
// 0 - initialized - no viewer, no parameters, etc
// 1 - processing  - processing JSCAD script
// 2 - complete    - completed processing
// 3 - incomplete  - incompleted due to errors in processing
  this.state = 0; // initialized
};

OpenJsCad.Processor.convertToSolid = function(obj) {
  //echo("typeof="+typeof(obj),obj.length);

  if( (typeof(obj) == "object") && ((obj instanceof CAG)) ) {
    // convert a 2D shape to a thin solid:
    obj = obj.extrude({offset: [0,0,0.1]});

  } else if( (typeof(obj) == "object") && ((obj instanceof CSG)) ) {
    // obj already is a solid, nothing to do
    ;
    
  } else if(obj.length) {                   // main() return an array, we consider it a bunch of CSG not intersecting
    //echo("putting them together");
    var o = obj[0];
    for(var i=1; i<obj.length; i++) {
       o = o.unionForNonIntersecting(obj[i]);
    }
    obj = o;
    //echo("done.");
    
  } else {
    throw new Error("Cannot convert to solid");
  }
  return obj;
};

OpenJsCad.Processor.prototype = {
  createElements: function() {
    var that = this;   // for event handlers

    while(this.containerdiv.children.length > 0)
    {
      this.containerdiv.removeChild(0);
    }
/*    
    if(!OpenJsCad.isChrome() )
    {
      var div = document.createElement("div");
      div.innerHTML = "Please note: OpenJsCad currently only runs reliably on Google Chrome!";
      this.containerdiv.appendChild(div);
    }
*/    
    var viewerdiv = document.createElement("div");
    viewerdiv.className = "viewer";
    viewerdiv.style.width = '100%';
    viewerdiv.style.height = '100%';
    this.containerdiv.appendChild(viewerdiv);
    this.viewerdiv = viewerdiv;
    try {
      //this.viewer = new OpenJsCad.Viewer(this.viewerdiv, this.viewerwidth, this.viewerheight, this.initialViewerDistance);
      //this.viewer = new OpenJsCad.Viewer(this.viewerdiv, viewerdiv.offsetWidth, viewer.offsetHeight, this.initialViewerDistance);
      this.viewer = new OpenJsCad.Viewer(this.viewerdiv, this.initialViewerDistance);
    } catch(e) {
      this.viewerdiv.innerHTML = "<b><br><br>Error: " + e.toString() + "</b><br><br>OpenJsCad currently requires Google Chrome or Firefox with WebGL enabled";
    }
    //Zoom control
    if(0) {
       var div = document.createElement("div");
       this.zoomControl = div.cloneNode(false);
       this.zoomControl.style.width = this.viewerwidth + 'px';
       this.zoomControl.style.height = '20px';
       this.zoomControl.style.backgroundColor = 'transparent';
       this.zoomControl.style.overflowX = 'scroll';
       div.style.width = this.viewerwidth * 11 + 'px';
       div.style.height = '1px';
       this.zoomControl.appendChild(div);
       this.zoomChangedBySlider = false;
       this.zoomControl.onscroll = function(event) {
         var zoom = that.zoomControl;
         var newzoom=zoom.scrollLeft / (10 * zoom.offsetWidth);
         that.zoomChangedBySlider=true; // prevent recursion via onZoomChanged 
         that.viewer.setZoom(newzoom);
         that.zoomChangedBySlider=false;
       };
       this.viewer.onZoomChanged = function() {
         if(!that.zoomChangedBySlider)
         {
           var newzoom = that.viewer.getZoom();
           that.zoomControl.scrollLeft = newzoom * (10 * that.zoomControl.offsetWidth);
         }
       };

       this.containerdiv.appendChild(this.zoomControl);
       //this.zoomControl.scrollLeft = this.viewer.viewpointZ / this.viewer.ZOOM_MAX * this.zoomControl.offsetWidth;
       this.zoomControl.scrollLeft = this.viewer.viewpointZ / this.viewer.ZOOM_MAX * 
         (this.zoomControl.scrollWidth - this.zoomControl.offsetWidth);

       //end of zoom control
    }
    //this.errordiv = document.createElement("div");
    this.errordiv = document.getElementById("errordiv");
    this.errorpre = document.createElement("pre"); 
    this.errordiv.appendChild(this.errorpre);
    //this.statusdiv = document.createElement("div");
    this.statusdiv = document.getElementById("statusdiv");
    this.statusdiv.className = "statusdiv";
    //this.statusdiv.style.width = this.viewerwidth + "px";
    this.statusspan = document.createElement("span");
    this.statusspan.id = 'statusspan';
    this.statusspan.style.marginRight = '2em';
    this.statusbuttons = document.createElement("span");
    this.statusbuttons.style.float = "right";
    this.statusdiv.appendChild(this.statusspan);
    this.statusdiv.appendChild(this.statusbuttons);
    this.abortbutton = document.createElement("button");
    this.abortbutton.innerHTML = "Abort";
    this.abortbutton.onclick = function(e) {
      that.abort();
    };
    this.statusbuttons.appendChild(this.abortbutton);
    this.formatDropdown = document.createElement("select");
    this.formatDropdown.onchange = function(e) {
      that.currentFormat = that.formatDropdown.options[that.formatDropdown.selectedIndex].value;
      that.updateDownloadLink();
    };
    this.statusbuttons.appendChild(this.formatDropdown);
    this.generateOutputFileButton = document.createElement("button");
    this.generateOutputFileButton.onclick = function(e) {
      that.generateOutputFile();
    };
    this.statusbuttons.appendChild(this.generateOutputFileButton);
    this.downloadOutputFileLink = document.createElement("a");
    this.downloadOutputFileLink.className = "downloadOutputFileLink"; // so we can css it
    this.statusbuttons.appendChild(this.downloadOutputFileLink);

    //this.parametersdiv = document.createElement("div");            // already created
    this.parametersdiv = document.getElementById("parametersdiv");   // get the info
    this.parametersdiv.id = "parametersdiv";
    // this.parametersdiv.className = "ui-draggable";                   // via jQuery draggable() but it screws up 

    var headerdiv = document.createElement("div");
    //headerdiv.innerText = "Parameters:";
    headerdiv.innerHTML = "Parameters:";
    headerdiv.className = "parameterheader";
    this.parametersdiv.appendChild(headerdiv);

    this.parameterstable = document.createElement("table");
    this.parameterstable.className = "parameterstable";
    this.parametersdiv.appendChild(this.parameterstable);

    var parseParametersButton = document.createElement("button");
    parseParametersButton.innerHTML = "Update";
    parseParametersButton.onclick = function(e) {
      that.rebuildSolid();
    };
    this.parametersdiv.appendChild(parseParametersButton);

    // implementing instantUpdate
    var instantUpdateCheckbox = document.createElement("input");
    instantUpdateCheckbox.type = "checkbox";
    instantUpdateCheckbox.id = "instantUpdate";
    this.parametersdiv.appendChild(instantUpdateCheckbox);

    var instantUpdateCheckboxText = document.createElement("span");
    instantUpdateCheckboxText.innerHTML = "Instant Update";
    instantUpdateCheckboxText.id = "instantUpdateLabel";
    this.parametersdiv.appendChild(instantUpdateCheckboxText);

    this.enableItems();    

    // they exist already, so no appendChild anymore (remains here)
    //this.containerdiv.appendChild(this.statusdiv);
    //this.containerdiv.appendChild(this.errordiv);
    //this.containerdiv.appendChild(this.parametersdiv); 

    this.clearViewer();
  },
  
  setCurrentObject: function(obj) {
    this.currentObject = obj;                                  // CAG or CSG
    if(this.viewer) {
      var csg = OpenJsCad.Processor.convertToSolid(obj);       // enfore CSG to display
      this.viewer.setCsg(csg);
      this.viewer.state = 2;
      if(obj.length)             // if it was an array (multiple CSG is now one CSG), we have to reassign currentObject
         this.currentObject = csg;
    }
    
    while(this.formatDropdown.options.length > 0)
      this.formatDropdown.options.remove(0);
    
    var that = this;
    this.supportedFormatsForCurrentObject().forEach(function(format) {
      var option = document.createElement("option");
      option.setAttribute("value", format);
      option.appendChild(document.createTextNode(that.formatInfo(format).displayName));
      that.formatDropdown.options.add(option);
    });
    
    this.updateDownloadLink();
  },
  
  selectedFormat: function() {
    return this.formatDropdown.options[this.formatDropdown.selectedIndex].value;
  },

  selectedFormatInfo: function() {
    return this.formatInfo(this.selectedFormat());
  },
  
  updateDownloadLink: function() {
    var ext = this.selectedFormatInfo().extension;
    this.generateOutputFileButton.innerHTML = "Generate "+ext.toUpperCase();
  },
  
  clearViewer: function() {
    this.clearOutputFile();
    if (this.currentObject) {
      this.setCurrentObject(new CSG());
      this.currentObject = null;
    }
    this.viewer.state = 1; // cleared
    this.enableItems();
  },
  
  abort: function() {
  // abort if state is processing
    if(this.state == 1)
    {
      //todo: abort
      this.statusspan.innerHTML = "Aborted.";
      this.worker.terminate();
      this.state = 3; // incomplete
      this.enableItems();
      if(this.onchange) this.onchange();
    }
  },
  
  enableItems: function() {
    this.abortbutton.style.display = (this.state == 1) ? "inline":"none";
    this.formatDropdown.style.display = ((!this.hasOutputFile)&&(this.currentObject))? "inline":"none";
    this.generateOutputFileButton.style.display = ((!this.hasOutputFile)&&(this.currentObject))? "inline":"none";
    this.downloadOutputFileLink.style.display = this.hasOutputFile? "inline":"none";
    this.parametersdiv.style.display = (this.paramControls.length > 0)? "inline-block":"none";     // was 'block' 
    this.errordiv.style.display = this.hasError? "block":"none";
    this.statusdiv.style.display = this.hasError? "none":"block";    
  },

  setOpenJsCadPath: function(path) {
    this.options[ 'openJsCadPath' ] = path;
  },

  addLibrary: function(lib) {
    if( this.options[ 'libraries' ] == null ) {
      this.options[ 'libraries' ] = [];
    }
    this.options[ 'libraries' ].push( lib );
  },
  
  setError: function(txt) {
    this.hasError = (txt != "");
    this.errorpre.textContent = txt;
    this.enableItems();
  },
  
  setDebugging: function(debugging) {
    this.debugging = debugging;
  },
  
  // script: javascript code
  // filename: optional, the name of the .jscad file
  setJsCad: function(script, filename) {
    if(!filename) filename = "openjscad.jscad";
    filename = filename.replace(/\.jscad$/i, "");
    this.abort();
    this.paramDefinitions = [];
    this.paramControls = [];
    this.script = null;
    this.setError("");
    var scripthaserrors = false;
    try
    {
      this.paramDefinitions = OpenJsCad.getParamDefinitions(script);
      this.createParamControls();
    }
    catch(e)
    {
      this.setError(e.toString());
      this.statusspan.innerHTML = "Error.";
      scripthaserrors = true;
    }
    if(!scripthaserrors)
    {
      this.script = script;
      this.filename = filename;
      this.rebuildSolid();
    }
    else
    {
      this.enableItems();
      if(this.onchange) this.onchange();
    }
  },
  
  getParamValues: function()
  {
    var paramValues = {};
    for(var i = 0; i < this.paramDefinitions.length; i++)
    {
      var paramdef = this.paramDefinitions[i];
      var type = "text";
      if('type' in paramdef)
      {
        type = paramdef.type;
      }
      var control = this.paramControls[i];
      var value = null;
      if( (type == "text") || (type == "float") || (type == "int") || (type == "number") )
      {
        value = control.value;
        if( (type == "float") || (type == "int") || (type == "number") )
        {
          var isnumber = !isNaN(parseFloat(value)) && isFinite(value);
          if(!isnumber)
          {
            throw new Error("Not a number: "+value);
          }
          if(type == "int")
          {
            value = parseInt(value);
          }
          else
          {
            value = parseFloat(value);
          }
        }
      }
      else if(type == "choice")
      {
        value = control.options[control.selectedIndex].value;
      }
      paramValues[paramdef.name] = value;
    }
    return paramValues;
  },
    
  rebuildSolid: function()
  {
    this.abort();
    this.setError("");
    this.clearViewer();
    this.statusspan.innerHTML = "Rendering code, please wait <img id=busy src='imgs/busy.gif'>";
    this.enableItems();
    var that = this;
    var paramValues = this.getParamValues();
    var useSync = this.debugging;

    //useSync = true;
    if(!useSync)
    {
      try
      {
          console.log("trying async compute");
          that.state = 1; // processing
          this.worker = OpenJsCad.parseJsCadScriptASync(this.script, paramValues, this.options, function(err, obj) {
          that.worker = null;
          if(err)
          {
            that.setError(err);
            that.statusspan.innerHTML = "Error.";
            that.state = 3; // incomplete
          }
          else
          {
            that.setCurrentObject(obj);
            that.statusspan.innerHTML = "Ready.";
            that.state = 2; // complete
          }
          that.enableItems();
          if(that.onchange) that.onchange();
        });
      }
      catch(e)
      {
        console.log("async failed, try sync compute, error: "+e.message);
        useSync = true;
      }
    }
    
    if(useSync)
    {
      try
      {
        that.state = 1; // processing
        this.statusspan.innerHTML = "Rendering code, please wait <img id=busy src='imgs/busy.gif'>";
        var obj = OpenJsCad.parseJsCadScriptSync(this.script, paramValues, this.debugging);
        that.setCurrentObject(obj);
        that.statusspan.innerHTML = "Ready.";
        that.state = 2; // complete
      }
      catch(e)
      {
        var errtxt = e.toString();
        if(e.stack) {
          errtxt += '\nStack trace:\n'+e.stack;
        } 
        that.statusspan.innerHTML = "Error.";
        that.state = 3; // incomplete
      }
      that.enableItems();
      if(that.onchange) that.onchange();
    }
  },
  
  getState: function() {
    return this.state;
  },

  clearOutputFile: function() {
    if(this.hasOutputFile)
    {
      this.hasOutputFile = false;
      if(this.outputFileDirEntry)
      {
        this.outputFileDirEntry.removeRecursively(function(){});
        this.outputFileDirEntry=null;
      }
      if(this.outputFileBlobUrl)
      {
        OpenJsCad.revokeBlobUrl(this.outputFileBlobUrl);
        this.outputFileBlobUrl = null;
      }
      this.enableItems();
      if(this.onchange) this.onchange();
    }
  },

  generateOutputFile: function() {
    this.clearOutputFile();
    if(this.currentObject)
    {
      try
      {
        this.generateOutputFileFileSystem();
      }
      catch(e)
      {
        this.generateOutputFileBlobUrl();
      }
    }
  },

  currentObjectToBlob: function() {
    var format = this.selectedFormat();
    
    var blob;
    if(format == "stla") {      
      blob = this.currentObject.toStlString();        
      blob = new Blob([blob],{ type: this.formatInfo(format).mimetype });
    }
    else if(format == "stlb") {      
      //blob = this.currentObject.fixTJunctions().toStlBinary();   // gives normal errors, but we keep it for now (fixTJunctions() needs debugging)
      blob = this.currentObject.toStlBinary({webBlob: true});     

      // -- binary string -> blob gives bad data, so we request cgs.js already blobbing the binary
      //blob = new Blob([blob],{ type: this.formatInfo(format).mimetype+"/charset=UTF-8" }); 
    }
    else if(format == "amf") {
      blob = this.currentObject.toAMFString({
        producer: "OpenJSCAD.org "+version,
        date: new Date()
      });
      blob = new Blob([blob],{ type: this.formatInfo(format).mimetype });
    }  
    else if(format == "x3d") {
      blob = this.currentObject.fixTJunctions().toX3D();
    }
    else if(format == "dxf") {
      blob = this.currentObject.toDxf();
    }
    else {
      throw new Error("Not supported");
    }    
    return blob;
  },
  
  supportedFormatsForCurrentObject: function() {
    if (this.currentObject instanceof CSG) {
      return ["stlb", "stla", "amf", "x3d"];
    } else if (this.currentObject instanceof CAG) {
      return ["dxf"];
    } else {
      throw new Error("Not supported");
    }
  },
  
  formatInfo: function(format) {
    return {
      stla: {
        displayName: "STL (ASCII)",
        extension: "stl",
        mimetype: "application/sla",
        },
      stlb: {
        displayName: "STL (Binary)",
        extension: "stl",
        mimetype: "application/sla",
        },
      amf: {
        displayName: "AMF (experimental)",
        extension: "amf",
        mimetype: "application/amf+xml",
        },
      x3d: {
        displayName: "X3D",
        extension: "x3d",
        mimetype: "model/x3d+xml",
        },
      dxf: {
        displayName: "DXF",
        extension: "dxf",
        mimetype: "application/dxf",
        }
    }[format];
  },

  downloadLinkTextForCurrentObject: function() {
    var ext = this.selectedFormatInfo().extension;
    return "Download "+ext.toUpperCase();
  },

  generateOutputFileBlobUrl: function() {
    var blob = this.currentObjectToBlob();
    var windowURL=OpenJsCad.getWindowURL();
    this.outputFileBlobUrl = windowURL.createObjectURL(blob);
    if(!this.outputFileBlobUrl) throw new Error("createObjectURL() failed"); 
    this.hasOutputFile = true;
    this.downloadOutputFileLink.href = this.outputFileBlobUrl;
    this.downloadOutputFileLink.innerHTML = this.downloadLinkTextForCurrentObject();
    var ext = this.selectedFormatInfo().extension;
    this.downloadOutputFileLink.setAttribute("download", "openjscad."+ext);
    this.enableItems();
    if(this.onchange) this.onchange();
  },

  generateOutputFileFileSystem: function() {
    window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
    if(!window.requestFileSystem)
    {
      throw new Error("Your browser does not support the HTML5 FileSystem API. Please try the Chrome browser instead.");
    }
    // create a random directory name:
    var dirname = "OpenJsCadOutput1_"+parseInt(Math.random()*1000000000, 10)+"."+extension;
    var extension = this.selectedFormatInfo().extension;
    var filename = "output."+extension;
    var that = this;
    window.requestFileSystem(TEMPORARY, 20*1024*1024, function(fs){
        fs.root.getDirectory(dirname, {create: true, exclusive: true}, function(dirEntry) {
            that.outputFileDirEntry = dirEntry;
            dirEntry.getFile(filename, {create: true, exclusive: true}, function(fileEntry) {
                 fileEntry.createWriter(function(fileWriter) {
                    fileWriter.onwriteend = function(e) {
                      that.hasOutputFile = true;
                      that.downloadOutputFileLink.href = fileEntry.toURL();
                      that.downloadOutputFileLink.type = that.selectedFormatInfo().mimetype; 
                      that.downloadOutputFileLink.innerHTML = that.downloadLinkTextForCurrentObject();
                      that.downloadOutputFileLink.setAttribute("download", fileEntry.name);
                      that.enableItems();
                      if(that.onchange) that.onchange();
                    };
                    fileWriter.onerror = function(e) {
                      throw new Error('Write failed: ' + e.toString());
                    };
                    var blob = that.currentObjectToBlob();
                    console.log(blob,blob.length);                
                    fileWriter.write(blob);
                  }, 
                  function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "createWriter");} 
                );
              },
              function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "getFile('"+filename+"')");} 
            );
          },
          function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "getDirectory('"+dirname+"')");} 
        );         
      }, 
      function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "requestFileSystem");}
    );
  },
  
  createParamControls: function() {
    this.parameterstable.innerHTML = "";
    this.paramControls = [];
    var paramControls = [];
    var tablerows = [];
    for(var i = 0; i < this.paramDefinitions.length; i++)
    {
      var errorprefix = "Error in parameter definition #"+(i+1)+": ";
      var paramdef = this.paramDefinitions[i];
      if(!('name' in paramdef))
      {
        throw new Error(errorprefix + "Should include a 'name' parameter");
      }
      var type = "text";
      if('type' in paramdef)
      {
        type = paramdef.type;
      }
      if( (type !== "text") && (type !== "int") && (type !== "float") && (type !== "choice") && (type !== "number") )
      {
        throw new Error(errorprefix + "Unknown parameter type '"+type+"'");
      }
      var control;
      if( (type == "text") || (type == "int") || (type == "float") || (type == "number") )
      {
        control = document.createElement("input");
        if (type == "number")
            control.type = "number";
        else
            control.type = "text";
        if('default' in paramdef)
        {
          control.value = paramdef["default"];
        }
        else if('initial' in paramdef)
          control.value = paramdef.initial;
        else
        {
          if( (type == "int") || (type == "float") || (type == "number") )
          {
            control.value = "0";
          }
          else
          {
            control.value = "";
          }
        }
        if(paramdef.size!==undefined) 
           control.size = paramdef.size;
        for (var property in paramdef)
            if (paramdef.hasOwnProperty (property))
                if ((property != "name") && (property != "type") && (property != "default") && (property != "initial") && (property != "caption"))
                    control.setAttribute (property, paramdef[property]);
      }
      else if(type == "choice")
      {
        if(!('values' in paramdef))
        {
          throw new Error(errorprefix + "Should include a 'values' parameter");
        }        
        control = document.createElement("select");
        var values = paramdef.values;
        var captions;
        if('captions' in paramdef)
        {
          captions = paramdef.captions;
          if(captions.length != values.length)
          {
            throw new Error(errorprefix + "'captions' and 'values' should have the same number of items");
          }
        }
        else
        {
          captions = values;
        }
        var selectedindex = 0;
        for(var valueindex = 0; valueindex < values.length; valueindex++)
        {
          var option = document.createElement("option");
          option.value = values[valueindex];
          option.text = captions[valueindex];
          control.add(option);
          if('default' in paramdef)
          {
            if(paramdef["default"] == values[valueindex])
            {
              selectedindex = valueindex;
            }
          }
          else if('initial' in paramdef)
          {
            if(paramdef.initial == values[valueindex])
            {
              selectedindex = valueindex;
            }
          }
        }
        if(values.length > 0)
        {
          control.selectedIndex = selectedindex;
        }        
      }
      // implementing instantUpdate
      control.onchange = function() { 
         if(document.getElementById("instantUpdate").checked==true) {
            that.rebuildSolid();
         }
      };
      paramControls.push(control);
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      var label = paramdef.name + ":";
      if('caption' in paramdef)
      {
        label = paramdef.caption;
        td.className = 'caption';
      }
       
      td.innerHTML = label;
      tr.appendChild(td);
      td = document.createElement("td");
      td.appendChild(control);
      tr.appendChild(td);
      tablerows.push(tr);
    }
    var that = this;
    tablerows.map(function(tr){
      that.parameterstable.appendChild(tr);
    }); 
    this.paramControls = paramControls;
  },
};


