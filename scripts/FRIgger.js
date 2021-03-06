// Global variable definitionvar canvas;
var canvas;
var gl;
var shaderProgram;

// Buffers
var worldVertexPositionBuffer = Array();
var worldVertexTextureCoordBuffer = Array();
var worldItemsToLoad = 5;
var wordlDataPaths = ["world.txt", "worldEnd.txt", "worldStreha.txt", "cesta.txt", "voda.txt"];

//world textures
var worldTexturesPaths = ["tla.png", "friTexture.png", "streha.png", "cesta.png", "voda.png"];

/*
var worldVertexPositionBuffer = null;
var worldVertexTextureCoordBuffer = null;

var worldEndVertexPositionBuffer = null;
var worldEndVertexTextureCoordBuffer = null;

var worldStrehaVertexPositionBuffer = null;
var worldStrehaVertexTextureCoordBuffer = null;
*/
// izpit
var izpitVertexPositionBuffer;
var izpitVertexNormalBuffer;
var izpitVertexTextureCoordBuffer;
var izpitVertexIndexBuffer;

var numOfIzpits = 5;
var izpitMoveMatrix = Array();

//collisions
var colisionWorld = Array();

/*
class Izpit{
  constructor(VertexPositionBuffer, VertexNormalBuffer, VertexTextureCoordBuffer, VertexIndexBuffer){
    this.VertexPositionBuffer = VertexPositionBuffer;
    this.VertexNormalBuffer = VertexNormalBuffer;
    this.VertexTextureCoordBuffer = VertexTextureCoordBuffer;
    this.VertexIndexBuffer = VertexIndexBuffer;
  }
}*/

// Model-view and projection matrix and model-view matrix stack
var mvMatrixStack = [];
var mvMatrix = mat4.create();
var pMatrix = mat4.create();

// Variables for storing textures
var worldTextures = new Array();

// Variable that stores  loading state of textures.
var texturesLoaded = 0;
var texturesToLoad = 5;

// Keyboard handling helper variable for reading the status of keys
var currentlyPressedKeys = {};

// Variables for storing current position and speed
var pitch = 0;
var pitchRate = 0;
var yaw = 90;
var yawRate = 0;
var xPosition = 19;
var yPosition = 8.4;
var zPosition = 0;
var speed = 0;

// Used to make us "jog" up and down as we move forward.
var joggingAngle = 0;

// Helper variable for animation
var lastTime = 0;

//
// Matrix utility functions
//
// mvPush   ... push current matrix on matrix stack
// mvPop    ... pop top matrix from stack
// degToRad ... convert degrees to radians
//
function mvPushMatrix() {
  var copy = mat4.create();
  mat4.set(mvMatrix, copy);
  mvMatrixStack.push(copy);
}

function mvPopMatrix() {
  if (mvMatrixStack.length == 0) {
    throw "Invalid popMatrix!";
  }
  mvMatrix = mvMatrixStack.pop();
}

function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

//
// initGL
//
// Initialize WebGL, returning the GL context or null if
// WebGL isn't available or could not be initialized.
//
function initGL(canvas) {
  var gl = null;
  try {
    // Try to grab the standard context. If it fails, fallback to experimental.
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
  } catch(e) {}

  // If we don't have a GL context, give up now
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
  }
  return gl;
}

//
// getShader
//
// Loads a shader program by scouring the current document,
// looking for a script with the specified ID.
//
function getShader(gl, id) {
  var shaderScript = document.getElementById(id);

  // Didn't find an element with the specified ID; abort.
  if (!shaderScript) {
    return null;
  }
  
  // Walk through the source element's children, building the
  // shader source string.
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) {
        shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }
  
  // Now figure out what type of shader script we have,
  // based on its MIME type.
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;  // Unknown shader type
  }

  // Send the source to the shader object
  gl.shaderSource(shader, shaderSource);

  // Compile the shader program
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

//
// initShaders
//
// Initialize the shaders, so WebGL knows how to light our scene.
//
function initShaders() {
  var fragmentShader = getShader(gl, "shader-fs");
  var vertexShader = getShader(gl, "shader-vs");
  
  // Create the shader program
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  
  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Unable to initialize the shader program.");
  }
  
  // start using shading program for rendering
  gl.useProgram(shaderProgram);
  
  // store location of aVertexPosition variable defined in shader
  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");

  // turn on vertex position attribute at specified position
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  // store location of aVertexNormal variable defined in shader
  shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");

  // store location of aTextureCoord variable defined in shader
  gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

  // store location of uPMatrix variable defined in shader - projection matrix 
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  // store location of uMVMatrix variable defined in shader - model-view matrix 
  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  // store location of uSampler variable defined in shader
  shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
}

//
// setMatrixUniforms
//
// Set the uniforms in shaders.
//
function setMatrixUniforms() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//
// initTextures
//
// Initialize the textures we'll be using, then initiate a load of
// the texture images. The handleTextureLoaded() callback will finish
// the job; it gets called each time a texture finishes loading.
//
function initTextures() {
  for(var i = 0; i<texturesToLoad; i++){
    (function (i){
      worldTextures[i] = gl.createTexture();
      worldTextures[i].image = new Image();
      worldTextures[i].image.onload = function () {
        handleTextureLoaded(worldTextures[i])
      }
      worldTextures[i].image.src = "./assets/" + worldTexturesPaths[i];
    })(i);
  }
  
  /*
  goraTexture = gl.createTexture();
  goraTexture.image = new Image();
  goraTexture.image.onload = function () {
    handleTextureLoaded(goraTexture)
  }
  goraTexture.image.src = "./assets/friTexture.png";
  
  strehaTexture = gl.createTexture();
  strehaTexture.image = new Image();
  strehaTexture.image.onload = function () {
    handleTextureLoaded(strehaTexture)
  }
  strehaTexture.image.src = "./assets/streha.png";*/
}

function handleTextureLoaded(texture) {
  console.log("t");
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Third texture usus Linear interpolation approximation with nearest Mipmap selection
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.bindTexture(gl.TEXTURE_2D, null);

  // when texture loading is finished we can draw scene.
  texturesLoaded += 1;
}

//nalaganje ludeka
function handleLoadedLudek(teapotData) {
    // Pass the normals into WebGL
    ludekVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ludekVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(teapotData.data.attributes.normal.array), gl.STATIC_DRAW);
    ludekVertexNormalBuffer.itemSize = 3;
    ludekVertexNormalBuffer.numItems = teapotData.data.attributes.normal.array.length / 3;

    // Pass the texture coordinates into WebGL
    ludekVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ludekVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(teapotData.data.attributes.uv.array), gl.STATIC_DRAW);
    ludekVertexTextureCoordBuffer.itemSize = 2;
    ludekVertexTextureCoordBuffer.numItems = teapotData.data.attributes.uv.array.length / 2;

    // Pass the vertex positions into WebGL
    ludekVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ludekVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(teapotData.data.attributes.position.array), gl.STATIC_DRAW);
    ludekVertexPositionBuffer.itemSize = 3;
    ludekVertexPositionBuffer.numItems = teapotData.data.attributes.position.array.length / 3;

    // Pass the indices into WebGL
    ludekVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ludekVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(teapotData.data.index.array), gl.STATIC_DRAW);
    ludekVertexIndexBuffer.itemSize = 1;
    ludekVertexIndexBuffer.numItems = teapotData.data.index.array.length;

    document.getElementById("loadingtext").textContent = "";
}


//
// handleLoadedWorld
//
// Initialisation of world 
//
function handleLoadedWorld(data, part) {
  console.log("w");
  var lines = data.split("\n");
  var vertexCount = 0;
  var vertexPositions = [];
  var vertexTextureCoords = [];
  for (var i in lines) {
    
    //if(part==3)
    //  debugger;
      
    var vals = lines[i].replace(/^\s+/, "").split(/\s+/);
    if (vals.length != 1 && vals[0] != "//") {
		
      // It is a line describing a vertex; get X, Y and Z first
      vertexPositions.push(parseFloat(vals[0]));
      vertexPositions.push(parseFloat(vals[1]));
      vertexPositions.push(parseFloat(vals[2]));

      // And then the texture coords
      vertexTextureCoords.push(parseFloat(vals[3]));
      vertexTextureCoords.push(parseFloat(vals[4]));

      vertexCount += 1;
    }
  }

  worldVertexPositionBuffer[part] = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer[part]);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW);
  worldVertexPositionBuffer[part].itemSize = 3;
  worldVertexPositionBuffer[part].numItems = vertexCount;

  worldVertexTextureCoordBuffer[part] = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer[part]);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexTextureCoords), gl.STATIC_DRAW);
  worldVertexTextureCoordBuffer[part].itemSize = 2;
  worldVertexTextureCoordBuffer[part].numItems = vertexCount;

  document.getElementById("loadingtext").textContent = "";
}

//handleLoadedColisions
function handleLoadedCollisionWorld(data){
  console.log("cw");
  var lines = data.split("\n");
  var vertexPositions = [];
  for (var i in lines) {
    var vals = lines[i].replace(/^\s+/, "").split(/\s+/);
    if (vals.length != 1 && vals[0] != "//") {
      // It is a line describing a vertex; get X, Y and Z first
      vertexPositions.push(parseFloat(vals[0]));
      vertexPositions.push(parseFloat(vals[1]));
      vertexPositions.push(parseFloat(vals[2]));

      colisionWorld.push(vertexPositions);
      vertexPositions = [];
    }
  }
}

//
// loadWorld
//
// Loading world 
//
function loadWorld() {
  var requests = Array();

  for(var i=0; i<worldItemsToLoad; i++){
    (function (i){
      requests[i] = new XMLHttpRequest();

      requests[i].open("GET", "./assets/" + wordlDataPaths[i]);
      requests[i].onreadystatechange = function () {
        if (requests[i].readyState == 4 && requests[i].status == 200) {
          handleLoadedWorld(requests[i].responseText, i);
        }
      }
      requests[i].send();
    })(i);
  }
}

//nalozi ludeka
function loadLudek() {
    var request = new XMLHttpRequest();
    request.open("GET", "./assets/fri_izpit.json");
    request.onreadystatechange = function () {
        if (request.readyState == 4) {
            handleLoadedLudek(JSON.parse(request.responseText));
        }
    }
    request.send();
}

//nalozi colision boxe
//svet
function loadWorldCollisionBox() {
  requests = new XMLHttpRequest();

  requests.open("GET", "./assets/collisionWorld.txt");
  requests.onreadystatechange = function () {
    if (requests.readyState == 4 && requests.status == 200) {
      handleLoadedCollisionWorld(requests.responseText);
    }
  }
  requests.send();
}




//initialise izpite
function initIzpit(){
  for(var i=0; i<3; i++){
    izpitMoveMatrix[i] = Array();
    for(var j=0; j<numOfIzpits; j++){
      if(i!=1)
        izpitMoveMatrix[i].push([0, 0, -20+(j*(40/numOfIzpits))]);
      else
        izpitMoveMatrix[i].push([0, 0, 20-(j*(40/numOfIzpits))]);
    }
  }
  //debugger;
}

//
// drawScene
//
// Draw the scene.
//
function drawScene() {
  // set the rendering environment to full canvas size
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  // Clear the canvas before we start drawing on it.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // If buffers are empty we stop loading the application.
  if (worldVertexTextureCoordBuffer.length != texturesToLoad || worldVertexPositionBuffer.length != worldItemsToLoad ||
  ludekVertexPositionBuffer == null || ludekVertexNormalBuffer == null || ludekVertexTextureCoordBuffer == null || ludekVertexIndexBuffer == null)
  {
    return;
  }
  
  // Establish the perspective with which we want to view the
  // scene. Our field of view is 45 degrees, with a width/height
  // ratio of 640:480, and we only want to see objects between 0.1 units
  // and 100 units away from the camera.
  mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  mat4.identity(mvMatrix);

  // Now move the drawing position a bit to where we want to start
  // drawing the world.
  
  mat4.rotate(mvMatrix, degToRad(-pitch), [1, 0, 0]);
  mat4.rotate(mvMatrix, degToRad(-yaw), [0, 1, 0]);
  mat4.translate(mvMatrix, [-xPosition, -yPosition, -zPosition]);
  
  //draw world
  for(var i = 0; i<worldItemsToLoad; i++){
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, worldTextures[i]);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    // Set the texture coordinates attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer[i]);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, worldVertexTextureCoordBuffer[i].itemSize, gl.FLOAT, false, 0, 0);

    // Draw the world by binding the array buffer to the world's vertices
    // array, setting attributes, and pushing it to GL.
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer[i]);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, worldVertexPositionBuffer[i].itemSize, gl.FLOAT, false, 0, 0);

    // Draw the cube.
    setMatrixUniforms();
    gl.drawArrays(gl.TRIANGLES, 0, worldVertexPositionBuffer[i].numItems);
  }
 
  mvPushMatrix();

  mat4.translate(mvMatrix, [12, -0.9, 0]);  

  for(var i=0; i<3; i++){
    if(i==1)
      mat4.translate(mvMatrix, [-4, 0, 0]);
    if(i==2)
      mat4.translate(mvMatrix, [-4, 0, 0]);

    //debugger;
    
    izpitMoveMatrix[i].forEach(function(move) {
      mvPushMatrix();

      mat4.translate(mvMatrix, move);
      mat4.rotate(mvMatrix, degToRad(90), [0, 1, 0]);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, worldTextures[3]);
      gl.uniform1i(shaderProgram.samplerUniform, 0);
      
      // Set the texture coordinates attribute for the vertices.
      gl.bindBuffer(gl.ARRAY_BUFFER, ludekVertexTextureCoordBuffer);
      gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, ludekVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
    
      // Draw the world by binding the array buffer to the world's vertices
      // array, setting attributes, and pushing it to GL.
      gl.bindBuffer(gl.ARRAY_BUFFER, ludekVertexPositionBuffer);
      gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, ludekVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
      
      // Draw the ludek.
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ludekVertexIndexBuffer);
      setMatrixUniforms();
      gl.drawElements(gl.TRIANGLES, ludekVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

      mvPopMatrix();
    });

    //mvPopMatrix();
  }
  /*
  //ludek
  // Activate textures
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, worldTextures[3]);
  gl.uniform1i(shaderProgram.samplerUniform, 0);
  
  // Set the texture coordinates attribute for the vertices.
  gl.bindBuffer(gl.ARRAY_BUFFER, ludekVertexTextureCoordBuffer);
  gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, ludekVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Draw the world by binding the array buffer to the world's vertices
  // array, setting attributes, and pushing it to GL.
  gl.bindBuffer(gl.ARRAY_BUFFER, ludekVertexPositionBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, ludekVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
  
  // Draw the ludek.
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ludekVertexIndexBuffer);
  setMatrixUniforms();
  gl.drawElements(gl.TRIANGLES, ludekVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
  */
  mvPopMatrix();
}

//
// animate
//
// Called every time before redeawing the screen.
//
function animate() {
  var timeNow = new Date().getTime();
  if (lastTime != 0) {
    var elapsed = timeNow - lastTime;

    //debugger;
    animateIzpit(elapsed);
    //console.log(izpitMoveMatrix[1][2]);
    if (speed != 0) {
      //debugger;
      var oldXPosition = xPosition;
      var oldYPosition = yPosition;
      var oldZPosition = zPosition;
      var oldJoggingAngle = joggingAngle;

      xPosition -= Math.sin(degToRad(yaw)) * speed * elapsed;
      zPosition -= Math.cos(degToRad(yaw)) * speed * elapsed;

      joggingAngle += elapsed * 0.6; // 0.6 "fiddle factor" - makes it feel more realistic :-)
      yPosition = Math.sin(degToRad(joggingAngle)) / 20 + 0.4

      //console.log(!checkColision([[xPosition, yPosition, zPosition]], colisionWorld));

      if(!checkColision([[xPosition, yPosition, zPosition]], colisionWorld)){
        xPosition = oldXPosition;
        yPosition = oldYPosition;
        zPosition = oldZPosition;
        joggingAngle = oldJoggingAngle;
      }

    }

    yaw += yawRate * elapsed;
    pitch += pitchRate * elapsed;

  }
  lastTime = timeNow;
}

function animateIzpit(elapsed){
  for(var i=0; i<3; i++){
    for(var j=0; j<numOfIzpits; j++){
      if(i==0){
        izpitMoveMatrix[i][j][2] += 0.008 * elapsed;
        if(izpitMoveMatrix[i][j][2] > 20)
          izpitMoveMatrix[i][j][2] = -20;   
      }
      else if(i==1){
        izpitMoveMatrix[i][j][2] -= 0.007 * elapsed;
        if(izpitMoveMatrix[i][j][2] < -20)
          izpitMoveMatrix[i][j][2] = 20;
      }
      else if(i==2){
        izpitMoveMatrix[i][j][2] += 0.009 * elapsed;
        if(izpitMoveMatrix[i][j][2] > 20)
          izpitMoveMatrix[i][j][2] = -20;
      }
    }
  }
}
//
// Keyboard handling helper functions
//
// handleKeyDown    ... called on keyDown event
// handleKeyUp      ... called on keyUp event
//
function handleKeyDown(event) {
  // storing the pressed state for individual key
  currentlyPressedKeys[event.keyCode] = true;
}

function handleKeyUp(event) {
  // reseting the pressed state for individual key
  currentlyPressedKeys[event.keyCode] = false;
}

//
// handleKeys
//
// Called every time before redeawing the screen for keyboard
// input handling. Function continuisly updates helper variables.
//
function handleKeys() {
  if (currentlyPressedKeys[33]) {
    // Page Up
    pitchRate = 0.1;
  } else if (currentlyPressedKeys[34]) {
    // Page Down
    pitchRate = -0.1;
  } else {
    pitchRate = 0;
  }

  if (currentlyPressedKeys[37] || currentlyPressedKeys[65]) {
    // Left cursor key or A
    yawRate = 0.3;
  } else if (currentlyPressedKeys[39] || currentlyPressedKeys[68]) {
    // Right cursor key or D
    yawRate = -0.3;
  } else {
    yawRate = 0;
  }

  if (currentlyPressedKeys[38] || currentlyPressedKeys[87]) {
    // Up cursor key or W
    speed = 0.023;
  } else if (currentlyPressedKeys[40] || currentlyPressedKeys[83]) {
    // Down cursor key
    speed = -0.023;
  } else {
    speed = 0;
  }
}

function checkColision(colider, box){
var dotikanje = true;

  colider.forEach(function(tocka) {
    dotikanje = true;

    box.forEach(function(t1) {
      box.forEach(function(t2) {
        if(t1!=t2){
          for(var dimenzija = 0; dimenzija<3; dimenzija++){
            //debugger;
            var razmik = Math.abs(t1[dimenzija] - t2[dimenzija]);

            if (t1[dimenzija] != t2[dimenzija]){
              if (t1[dimenzija] + razmik < tocka[dimenzija])
                dotikanje = false;

              if (t1[dimenzija] - razmik > tocka[dimenzija])
                dotikanje = false;
            }
          }
        }
      }, false);
    }, false);

    if (dotikanje)
      return true;
  }, false);

  if(dotikanje)
    return true;

  return false;
}

//
// start
//
// Called when the canvas is created to get the ball rolling.
// Figuratively, that is. There's nothing moving in this demo.
//
function start() {
  canvas = document.getElementById("glcanvas");

  gl = initGL(canvas);      // Initialize the GL context

  // Only continue if WebGL is available and working
  if (gl) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);                      // Set clear color to black, fully opaque
    gl.clearDepth(1.0);                                     // Clear everything
    gl.enable(gl.DEPTH_TEST);                               // Enable depth testing
    gl.depthFunc(gl.LEQUAL);                                // Near things obscure far things

    // Initialize the shaders; this is where all the lighting for the
    // vertices and so forth is established.
    initShaders();
    
    // Next, load and set up the textures we'll be using.
    initTextures();

    //inicializiraj izpite
    initIzpit();

    // Initialise world objects
    loadWorld();
    loadLudek();
    
    // Initialise colision boxes
    loadWorldCollisionBox();

    // Bind keyboard handling functions to document handlers
    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;
    
    // Set up to draw the scene periodically.
    setInterval(function() {
      if (texturesLoaded == texturesToLoad) { // only draw scene and animate when textures are loaded.
        requestAnimationFrame(animate);
        handleKeys();
        drawScene();
      }
    }, 15);
  }
}