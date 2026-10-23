(function attachKitPreview(global) {
  /**
   * Three.js preview for the kit editor.
   *
   * Renders the procedural garment with the texture produced by the layered
   * renderer, so the 3D view and the export always agree. The scene owns its
   * renderer, camera and lights and rebuilds the garment when the template
   * changes.
   */

  function createKitPreview(options) {
    var opts = options || {};
    var container = opts.container;
    var THREE = global.THREE;

    if (!container || !THREE) return null;

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 640);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();

    var camera = new THREE.PerspectiveCamera(
      35,
      (container.clientWidth || 640) / Math.max(1, container.clientHeight || 640),
      0.1,
      100
    );
    camera.position.set(0, 0.1, 5.2);
    camera.lookAt(0, 0, 0);

    var key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.2, 3.4, 3.6);
    key.castShadow = true;
    scene.add(key);

    var fill = new THREE.DirectionalLight(0xdfe8ff, 0.85);
    fill.position.set(-2.8, 1.4, 2.2);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xffffff, 1.1);
    rim.position.set(-1.2, 2.6, -3.4);
    scene.add(rim);

    scene.add(new THREE.HemisphereLight(0xd8e4ff, 0x2a2f38, 0.7));

    var garmentMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide
    });

    var meshes = [];
    var garmentBody = null;
    var textureCanvas = null;
    var autoRotate = opts.autoRotate !== false;
    var rotationSpeed = opts.rotationSpeed || 0.15;
    var frame = null;
    var disposed = false;

    function bufferGeometry(buffers) {
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(buffers.positions, 3)
      );
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
      geometry.setIndex(buffers.indices);
      geometry.computeVertexNormals();
      return geometry;
    }

    function clearGarment() {
      meshes.forEach(function (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
      });
      meshes = [];
      garmentBody = null;
    }

    function buildGarment(body) {
      clearGarment();

      var parts = global.CustomizerKitGeometry.buildGarment(body || {});

      var bodyMesh = new THREE.Mesh(bufferGeometry(parts.body), garmentMaterial);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      scene.add(bodyMesh);
      meshes.push(bodyMesh);
      garmentBody = bodyMesh;

      var sleeves = new THREE.Mesh(bufferGeometry(parts.sleeves), garmentMaterial);
      sleeves.castShadow = true;
      scene.add(sleeves);
      meshes.push(sleeves);

      if (textureCanvas) setTexture(textureCanvas);
    }

    function setTexture(canvas) {
      textureCanvas = canvas;
      var texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      meshes.forEach(function (mesh) {
        if (!mesh.material.map) {
          mesh.material.map = texture;
          mesh.material.needsUpdate = true;
        }
      });
    }

    function refreshTexture() {
      meshes.forEach(function (mesh) {
        if (mesh.material.map) mesh.material.map.needsUpdate = true;
      });
    }

    function applyColors(design) {
      var zones = (design && design.colorZones) || {};
      garmentMaterial.color.set(zones.primary || '#f4f4f5');
      garmentMaterial.needsUpdate = true;
    }

    /**
     * Resolve a pointer position to a garment UV coordinate.
     * Used by the hotspot editor to place crest, sponsor and brand markers.
     */
    function pickGarmentUv(clientX, clientY) {
      if (!garmentBody) return null;
      var rect = renderer.domElement.getBoundingClientRect();
      var ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      var raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObject(garmentBody, false);
      if (!hits.length || !hits[0].uv) return null;
      return { u: hits[0].uv.x, v: hits[0].uv.y };
    }

    function onResize() {
      if (disposed) return;
      var width = container.clientWidth;
      var height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    global.addEventListener('resize', onResize);

    function loop() {
      if (disposed) return;
      frame = global.requestAnimationFrame(loop);
      if (autoRotate && meshes[0]) meshes[0].rotation.y += rotationSpeed * 0.01;
      renderer.render(scene, camera);
    }
    loop();

    return {
      buildGarment: buildGarment,
      setTexture: setTexture,
      refreshTexture: refreshTexture,
      applyColors: applyColors,
      pickGarmentUv: pickGarmentUv,
      setAutoRotate: function (enabled) { autoRotate = !!enabled; },
      setRotationSpeed: function (speed) { rotationSpeed = speed; },
      dispose: function () {
        disposed = true;
        if (frame) global.cancelAnimationFrame(frame);
        global.removeEventListener('resize', onResize);
        clearGarment();
        garmentMaterial.dispose();
        renderer.dispose();
        if (renderer.domElement.parentElement === container) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }

  global.CustomizerKitPreview = {
    create: createKitPreview
  };
})(window);
