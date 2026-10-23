(function attachKitGeometry(global) {
  /**
   * Procedural garment geometry.
   *
   * The garment is generated at runtime rather than loaded from authored mesh
   * files, so the project carries no third-party asset licensing burden.
   * The torso is a swept elliptical profile (hem to shoulder) with a UV
   * layout that runs V from 0 at the hem to 1 at the shoulder, matching the
   * texture layout the kit texture pipeline expects.
   */

  var RADIAL = 32;
  var PROFILE_STEPS = 40;

  function buildProfile(body) {
    var length = body.length || 1;
    var chestWidth = body.chestWidth || 0.52;
    var waistWidth = body.waistWidth || 0.46;
    var shoulderWidth = chestWidth * 1.06;
    var scale = length / 1;

    var raw = [
      { t: 0.0, width: waistWidth * 1.04, depth: waistWidth * 0.62 },
      { t: 0.12, width: waistWidth * 1.0, depth: waistWidth * 0.6 },
      { t: 0.38, width: waistWidth * 0.99, depth: waistWidth * 0.61 },
      { t: 0.6, width: chestWidth * 0.97, depth: chestWidth * 0.62 },
      { t: 0.78, width: chestWidth * 1.0, depth: chestWidth * 0.63 },
      { t: 0.9, width: chestWidth * 1.02, depth: chestWidth * 0.6 },
      { t: 0.97, width: shoulderWidth * 0.94, depth: chestWidth * 0.5 },
      { t: 1.0, width: shoulderWidth * 0.82, depth: chestWidth * 0.38 }
    ];

    return raw.map(function (point) {
      return {
        t: point.t,
        width: point.width * scale,
        depth: point.depth * scale
      };
    });
  }

  function sampleProfile(profile, t) {
    for (var i = 0; i < profile.length - 1; i++) {
      var a = profile[i];
      var b = profile[i + 1];
      if (t >= a.t && t <= b.t) {
        var span = b.t - a.t;
        var k = span === 0 ? 0 : (t - a.t) / span;
        // Smoothstep keeps the silhouette free of visible creases.
        var s = k * k * (3 - 2 * k);
        return {
          t: t,
          width: a.width + (b.width - a.width) * s,
          depth: a.depth + (b.depth - a.depth) * s
        };
      }
    }
    return profile[profile.length - 1];
  }

  function buildTorsoPositions(body) {
    var profile = buildProfile(body);
    var length = body.length || 1;
    var positions = [];
    var uvs = [];
    var indices = [];

    for (var row = 0; row < PROFILE_STEPS; row++) {
      var t = row / (PROFILE_STEPS - 1);
      var point = sampleProfile(profile, t);
      var y = point.t * length;

      for (var col = 0; col <= RADIAL; col++) {
        var angle = (col / RADIAL) * Math.PI * 2;
        // Slightly flatten the back so the silhouette reads like a torso.
        var zScale = 0.92 + 0.08 * Math.cos(angle);
        positions.push(
          Math.sin(angle) * point.width,
          y,
          Math.cos(angle) * point.depth * zScale
        );
        uvs.push(col / RADIAL, point.t);
      }
    }

    for (var r = 0; r < PROFILE_STEPS - 1; r++) {
      for (var c = 0; c < RADIAL; c++) {
        var a = r * (RADIAL + 1) + c;
        var b = a + 1;
        var d = a + (RADIAL + 1);
        var e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }

    return { positions: positions, uvs: uvs, indices: indices };
  }

  function buildSleevePositions(body, side) {
    var profile = buildProfile(body);
    var shoulder = profile[profile.length - 2];
    var length = body.length || 1;
    var segments = 12;
    var rings = 8;

    var positions = [];
    var uvs = [];
    var indices = [];

    var shoulderX = shoulder.width * 0.9;
    var shoulderY = 0.94 * length;
    var sleeveLength = (body.sleeveLength || 0.22) * length;
    var topRadius = shoulder.width * 0.34;
    var bottomRadius = topRadius * 0.78;

    for (var ringIndex = 0; ringIndex < rings; ringIndex++) {
      var t = ringIndex / (rings - 1);
      var radius = topRadius + (bottomRadius - topRadius) * t;
      var x = shoulderX + sleeveLength * t * 0.78 * side;
      var y = shoulderY - sleeveLength * t * 0.62;

      for (var i = 0; i <= segments; i++) {
        var angle = (i / segments) * Math.PI * 2;
        positions.push(
          x + Math.cos(angle) * radius * 0.9 * side,
          y + Math.sin(angle) * radius,
          Math.cos(angle) * radius * 0.85
        );
        uvs.push(i / segments, t);
      }
    }

    for (var r2 = 0; r2 < rings - 1; r2++) {
      for (var c2 = 0; c2 < segments; c2++) {
        var a2 = r2 * (segments + 1) + c2;
        var b2 = a2 + 1;
        var d2 = a2 + (segments + 1);
        var e2 = d2 + 1;
        indices.push(a2, d2, b2, b2, d2, e2);
      }
    }

    return { positions: positions, uvs: uvs, indices: indices };
  }

  function mergeParts(parts) {
    var positions = [];
    var uvs = [];
    var indices = [];
    var offset = 0;

    parts.forEach(function (part) {
      part.positions.forEach(function (p) { positions.push(p); });
      part.uvs.forEach(function (uv) { uvs.push(uv); });
      part.indices.forEach(function (i) { indices.push(i + offset); });
      offset += part.positions.length / 3;
    });

    return { positions: positions, uvs: uvs, indices: indices };
  }

  /**
   * Build every garment part for a template body description.
   * Returns plain buffers so the caller can feed them to whichever renderer
   * is available (Three.js in the browser, or a headless canvas in tests).
   */
  function buildGarment(body) {
    var safeBody = {
      length: body && body.length ? body.length : 1,
      chestWidth: body && body.chestWidth ? body.chestWidth : 0.52,
      waistWidth: body && body.waistWidth ? body.waistWidth : 0.46,
      sleeveLength: body && body.sleeveLength ? body.sleeveLength : 0.22
    };

    return {
      body: buildTorsoPositions(safeBody),
      sleeves: mergeParts([
        buildSleevePositions(safeBody, -1),
        buildSleevePositions(safeBody, 1)
      ])
    };
  }

  global.CustomizerKitGeometry = {
    buildGarment: buildGarment,
    buildTorsoPositions: buildTorsoPositions,
    buildSleevePositions: buildSleevePositions
  };
})(window);
