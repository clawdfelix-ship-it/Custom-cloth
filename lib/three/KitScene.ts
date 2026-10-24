import * as THREE from "three";
import type { KitState, KitTemplate } from "@/types/kit";
import { loadGarmentModels } from "./loadGarment";

/**
 * Three.js scene manager for the kit preview.
 *
 * The garment geometry comes from the reference kit creator (FIFA / EAFC):
 * the same .obj meshes the original app ships. Their UVs are the game's own
 * UVs, so the preview and the exported texture can never drift apart.
 *
 * Every piece lives under one group so the turntable spins the whole kit,
 * and the camera auto-frames whatever was loaded.
 */

export interface KitSceneOptions {
  container: HTMLElement;
  template: KitTemplate;
  /** Called once per frame with the renderer size for canvas syncing. */
  onResize?: (width: number, height: number) => void;
}

type Area = "shirt" | "shorts" | "socks";

export class KitScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement;
  private group: THREE.Group;
  private meshes: THREE.Mesh[] = [];
  private areaMeshes: Record<Area, THREE.Mesh[]> = {
    shirt: [],
    shorts: [],
    socks: [],
  };
  private textureCanvas: Record<Area, HTMLCanvasElement | null> = {
    shirt: null,
    shorts: null,
    socks: null,
  };
  private garmentMaterial: THREE.MeshStandardMaterial;
  private shortsMaterial: THREE.MeshStandardMaterial;
  private socksMaterial: THREE.MeshStandardMaterial;
  private animationFrame = 0;
  private disposed = false;
  private rotationSpeed = 0.15;
  private autoRotate = true;
  private loadToken = 0;

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
      2000,
    );
    this.camera.position.set(0, 0, 450);
    this.camera.lookAt(0, 0, 0);

    this.setupLights();

    // Materials stay white: the per-area texture already carries the kit
    // colour. Tinting the material as well would multiply the two and make
    // the whole garment black.
    this.garmentMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    this.shortsMaterial = this.garmentMaterial.clone();
    this.socksMaterial = this.garmentMaterial.clone();

    this.group = new THREE.Group();
    this.scene.add(this.group);

    void this.buildGarment(options.template);

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
    this.frameKit();
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
  async buildGarment(template: KitTemplate) {
    const token = ++this.loadToken;
    this.clearGarment();

    const { shirt, shorts, socks } = await loadGarmentModels(template);
    // A newer template started loading while we were waiting; drop this result.
    if (token !== this.loadToken) return;

    const shirtMesh = new THREE.Mesh(shirt, this.garmentMaterial);
    shirtMesh.castShadow = true;
    shirtMesh.receiveShadow = true;
    this.addMesh(shirtMesh, "shirt");

    const shortsMesh = new THREE.Mesh(shorts, this.shortsMaterial);
    shortsMesh.castShadow = true;
    this.addMesh(shortsMesh, "shorts");

    const socksMesh = new THREE.Mesh(socks, this.socksMaterial);
    socksMesh.castShadow = true;
    this.addMesh(socksMesh, "socks");

    // The meshes load asynchronously, so any texture that arrived before
    // them has to be re-applied.
    this.applyStoredTextures();
    this.frameKit();
  }

  /**
   * Centre the loaded kit and pull the camera back far enough to fit it.
   *
   * The reference meshes are authored in the game's body coordinate space
   * (the shirt spans y 162..298, the shorts 112..206 and the socks 13..96),
   * so centring the combined bounding box gives a player wearing the kit.
   */
  private frameKit() {
    if (this.meshes.length === 0) return;
    const box = new THREE.Box3();
    for (const mesh of this.meshes) box.expandByObject(mesh);
    if (box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    this.group.position.set(-center.x, -center.y, -center.z);

    const fov = (this.camera.fov * Math.PI) / 180;
    const aspect = Math.max(0.2, this.camera.aspect);
    const distanceForHeight = size.y / 2 / Math.tan(fov / 2);
    const distanceForWidth = size.x / 2 / Math.tan(fov / 2) / aspect;
    const distance = Math.max(distanceForHeight, distanceForWidth) * 1.25;
    this.camera.position.set(0, 0, distance);
    this.camera.lookAt(0, 0, 0);
  }

  private addMesh(mesh: THREE.Mesh, area: Area) {
    this.group.add(mesh);
    this.meshes.push(mesh);
    this.areaMeshes[area].push(mesh);
  }

  private clearGarment() {
    for (const mesh of this.meshes) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes = [];
    this.areaMeshes = { shirt: [], shorts: [], socks: [] };
  }

  /**
   * Push kit colours into the garment materials.
   *
   * The colour is only used when no texture is attached; once a texture is
   * present the material must stay white or the two multiply together and
   * the kit renders black.
   */
  applyKit(kit: KitState) {
    const { settings } = kit;
    const targets: [THREE.MeshStandardMaterial, string][] = [
      [this.garmentMaterial, settings.primary],
      [this.shortsMaterial, settings.shorts],
      [this.socksMaterial, settings.socks],
    ];
    for (const [material, colour] of targets) {
      if (!material.map) material.color.set(colour);
      material.needsUpdate = true;
    }
  }

  /** Attach the 2D-rendered garment texture for one area. */
  setTexture(area: Area, canvas: HTMLCanvasElement) {
    this.textureCanvas[area] = canvas;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    for (const mesh of this.areaMeshes[area]) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      // The renderer hands over a fresh canvas each time, so the previous
      // texture has to be released explicitly.
      if (material.map) material.map.dispose();
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    }
  }

  /** Re-apply the stored canvases to meshes that were created after them. */
  private applyStoredTextures() {
    for (const area of ["shirt", "shorts", "socks"] as Area[]) {
      const canvas = this.textureCanvas[area];
      if (!canvas) continue;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      for (const mesh of this.areaMeshes[area]) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material.map) material.map.dispose();
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      }
    }
  }

  /** Refresh the attached texture after the 2D renderer changed. */
  refreshTexture() {
    for (const area of ["shirt", "shorts", "socks"] as Area[]) {
      const canvas = this.textureCanvas[area];
      if (!canvas) continue;
      for (const mesh of this.areaMeshes[area]) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material.map) {
          (material.map as THREE.CanvasTexture).needsUpdate = true;
        }
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

    const bodyMesh = this.areaMeshes.shirt[0];
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
    void template;
    this.frameKit();
  }

  private loop = () => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.loop);

    if (this.autoRotate) {
      this.group.rotation.y += this.rotationSpeed * 0.01;
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
