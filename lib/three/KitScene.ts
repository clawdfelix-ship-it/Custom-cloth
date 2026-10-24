import * as THREE from "three";
import type { KitState, KitTemplate } from "@/types/kit";
import { buildGarment, type GarmentParts } from "./buildGeometry";

/**
 * Three.js scene manager for the kit preview.
 *
 * Responsibilities:
 * - own the renderer / camera / lights
 * - rebuild garment meshes when the template changes
 * - apply kit colours to the garment materials
 * - expose a raycast helper so the hotspot editor can pick a logo anchor
 *
 * The texture itself is produced by the 2D renderer (`lib/render`), which
 * writes to a canvas; the 3D layer consumes that canvas as a texture so the
 * preview and the export always agree.
 */

export interface KitSceneOptions {
  container: HTMLElement;
  template: KitTemplate;
  /** Called once per frame with the renderer size for canvas syncing. */
  onResize?: (width: number, height: number) => void;
}

export class KitScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement;
  private parts: GarmentParts | null = null;
  private meshes: THREE.Mesh[] = [];
  private textureCanvas: HTMLCanvasElement | null = null;
  private garmentMaterial: THREE.MeshStandardMaterial;
  private shortsMaterial: THREE.MeshStandardMaterial;
  private socksMaterial: THREE.MeshStandardMaterial;
  private animationFrame = 0;
  private disposed = false;
  private rotationSpeed = 0.15;
  private autoRotate = true;

  constructor(options: KitSceneOptions) {
    this.container = options.container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(options.container.clientWidth, options.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    options.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      35,
      options.container.clientWidth / Math.max(1, options.container.clientHeight),
      0.1,
      100,
    );
    this.camera.position.set(0, 0.1, options.template.cameraPositionZ.reg / 90);
    this.camera.lookAt(0, 0, 0);

    this.setupLights();

    this.garmentMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    this.shortsMaterial = this.garmentMaterial.clone();
    this.socksMaterial = this.garmentMaterial.clone();

    this.buildGarment(options.template);

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener("resize", this.handleResize);

    this.loop();
  }

  private handleResize = () => {
    if (this.disposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private setupLights() {
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.2, 3.4, 3.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.85);
    fill.position.set(-2.8, 1.4, 2.2);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 1.1);
    rim.position.set(-1.2, 2.6, -3.4);
    this.scene.add(rim);

    this.scene.add(new THREE.HemisphereLight(0xd8e4ff, 0x2a2f38, 0.7));
  }

  /** Rebuild all garment meshes for a template. */
  buildGarment(template: KitTemplate) {
    this.clearGarment();

    const parts = buildGarment(template.body);
    this.parts = parts;

    const body = new THREE.Mesh(parts.body, this.garmentMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    this.scene.add(body);
    this.meshes.push(body);

    const sleeves = new THREE.Mesh(parts.sleeves, this.garmentMaterial);
    sleeves.castShadow = true;
    this.scene.add(sleeves);
    this.meshes.push(sleeves);

    const neck = new THREE.Mesh(parts.neck, this.shortsMaterial);
    this.scene.add(neck);
    this.meshes.push(neck);

    const collarIndex = Math.min(
      Math.max(0, template.body.collarCount - 1),
      parts.collars.length - 1,
    );
    const collar = new THREE.Mesh(parts.collars[collarIndex], this.shortsMaterial);
    this.scene.add(collar);
    this.meshes.push(collar);

    this.buildShorts(template);
    this.buildSocks(template);
  }

  private buildShorts(template: KitTemplate) {
    const { waistWidth, length } = template.body;
    const geometry = new THREE.CylinderGeometry(
      waistWidth * 1.06,
      waistWidth * 1.14,
      length * 0.34,
      28,
      1,
      false,
    );
    geometry.scale(1, 1, 0.86);
    geometry.translate(0, -length * 0.52, 0);
    const mesh = new THREE.Mesh(geometry, this.shortsMaterial);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
  }

  private buildSocks(template: KitTemplate) {
    const { waistWidth } = template.body;
    const height = template.body.length * 0.42;
    for (const side of [-1, 1]) {
      const geometry = new THREE.CylinderGeometry(
        waistWidth * 0.3,
        waistWidth * 0.34,
        height,
        20,
        1,
      );
      geometry.translate(side * waistWidth * 0.42, -length0(template) - height * 0.5, 0);
      const mesh = new THREE.Mesh(geometry, this.socksMaterial);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  private clearGarment() {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes = [];
    this.parts = null;
  }

  /** Push kit colours into the garment materials. */
  applyKit(kit: KitState) {
    const { settings } = kit;
    this.garmentMaterial.color.set(settings.primary);
    this.shortsMaterial.color.set(settings.shorts);
    this.socksMaterial.color.set(settings.socks);
    this.garmentMaterial.needsUpdate = true;
    this.shortsMaterial.needsUpdate = true;
    this.socksMaterial.needsUpdate = true;
  }

  /** Attach the 2D-rendered garment texture. */
  setTexture(canvas: HTMLCanvasElement) {
    this.textureCanvas = canvas;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    for (const mesh of this.meshes) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material.map) {
        material.map = texture;
        material.needsUpdate = true;
      }
    }
  }

  /** Refresh the attached texture after the 2D renderer changed. */
  refreshTexture() {
    if (!this.textureCanvas) return;
    for (const mesh of this.meshes) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material.map) {
        (material.map as THREE.CanvasTexture).needsUpdate = true;
      }
    }
  }

  /**
   * Convert a pointer position into a normalized garment UV coordinate.
   * Returns null when the ray misses the shirt body.
   */
  pickGarmentUv(clientX: number, clientY: number): { u: number; v: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);

    const bodyMesh = this.meshes.find((m) => m.geometry === this.parts?.body);
    if (!bodyMesh) return null;

    const hits = raycaster.intersectObject(bodyMesh, false);
    if (hits.length === 0) return null;
    const hit = hits[0];
    if (!hit.uv) return null;
    return { u: hit.uv.x, v: hit.uv.y };
  }

  setAutoRotate(enabled: boolean) {
    this.autoRotate = enabled;
  }

  setRotationSpeed(speed: number) {
    this.rotationSpeed = speed;
  }

  resetCamera(template: KitTemplate) {
    this.camera.position.set(0, 0.1, template.cameraPositionZ.reg / 90);
    this.camera.lookAt(0, 0, 0);
  }

  private loop = () => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.loop);

    if (this.autoRotate) {
      const pivot = this.meshes[0];
      if (pivot) pivot.rotation.y += this.rotationSpeed * 0.01;
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.handleResize);
    this.clearGarment();
    this.garmentMaterial.dispose();
    this.shortsMaterial.dispose();
    this.socksMaterial.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

function length0(template: KitTemplate) {
  return template.body.length * 0.62;
}
