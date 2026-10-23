# Custom Cloth x Fifakitcreator Reverse Reconstruction

Date: 2026-10-23
Status: Draft for review
Scope: Reconstruct the product structure and interaction model inspired by `fifakitcreator.com` without copying protected code, assets, template graphics, naming, or branded UI details.

## 1. Goal

Turn `Custom Cloth` from a form-first customizer into a template-driven sportswear editor that feels structurally similar to `fifakitcreator`:

- users start from a garment family and template system, not from a generic form
- garment appearance is assembled from interchangeable parts
- preview updates immediately when parts or colors change
- order and quote flows stay connected to the same design session

This phase intentionally targets a "half-template system" rather than full 3D or full pattern authoring. The objective is to reproduce the interaction model first.

## 2. Reverse-Engineered Product Structure

Based on prior reverse-engineering of the live product flow, the core structure appears to behave like this:

1. sport category selects the garment grammar
2. template family defines the overall style language
3. part variants define visible construction choices
4. color zones define editable mapped regions
5. text and logo layers sit on top of garment parts
6. roster and checkout are downstream of the same design session

The closest internal reconstruction for phase one is:

- `productType`
  - football
  - basketball
  - volleyball
  - sleeveless
  - polo
- `templateFamily`
  - a coherent style system for one garment type
- `partType`
  - `body`
  - `sleeve`
  - `collar`
- `partVariant`
  - one selectable style option inside a `partType`
- `colorZone`
  - named editable paintable area controlled by the active part stack
- `overlay`
  - logo, team name, player name, player number, badges

## 3. Selected Approach

Chosen approach: `C. Half-template system`

Why this approach:

- it is the fastest path from "customizer form" to "template gameplay"
- it preserves current submit flows and existing API surface
- it creates the right architecture for future expansion into side panels, patterns, trims, shorts, and full 3D

What is included in phase one:

- template family picker
- part pickers for `body`, `sleeve`, `collar`
- immediate preview recomposition on part change
- front/back view switching
- shared design session persistence

What is intentionally deferred:

- pixel-precise drag canvas for all overlays
- shorts/socks configurator
- photorealistic 3D
- arbitrary pattern authoring
- full production artwork export

## 4. UX Reconstruction

The editor should feel like a template workshop, not an order form.

### 4.1 Entry Flow

`/customizer`

- choose sport
- choose template family
- choose start mode:
  - recommended family preset
  - blank-from-family

### 4.2 Editor Layout

Left column: build style

- product type selector
- template family selector
- body variant chooser
- sleeve variant chooser
- collar variant chooser
- color palette controls

Center: live preview

- front/back switch
- assembled garment layers
- immediate visual change when variants or colors change

Right column: design extras

- team name
- player name / number style
- logo upload / preset assets
- roster
- quote / order actions

### 4.3 Interaction Rules

- switching `templateFamily` resets incompatible part variants
- switching `productType` filters families and variants
- each part change re-evaluates available color zones
- preview must update without full page reload
- quote and order use the same saved session snapshot

## 5. Data Model Reconstruction

### 5.1 Template Family

Represents the design language for a garment type.

Suggested fields:

- `id`
- `slug`
- `product_type`
- `name`
- `description`
- `preview_thumbnail`
- `default_part_selection`
- `enabled`

### 5.2 Part Variant

Represents one selectable visual part option.

Suggested fields:

- `id`
- `template_family_id`
- `product_type`
- `part_type` (`body`, `sleeve`, `collar`)
- `variant_code`
- `name`
- `sort_order`
- `preview_layers_front`
- `preview_layers_back`
- `supported_color_zones`
- `enabled`

### 5.3 Design Session Shape

The current session record should evolve to include part-driven composition:

```json
{
  "productType": "football",
  "templateFamily": "velocity",
  "views": {
    "front": {
      "parts": {
        "body": "body-v1",
        "sleeve": "sleeve-v2",
        "collar": "collar-v1"
      }
    },
    "back": {
      "parts": {
        "body": "body-v1",
        "sleeve": "sleeve-v2",
        "collar": "collar-v1"
      }
    }
  },
  "colorZones": {
    "primary": "#7f1d45",
    "secondary": "#f8fafc",
    "trim": "#fbbf24"
  },
  "overlays": [],
  "roster": []
}
```

## 6. Preview Reconstruction

Preview is assembled from layered assets, not one flat image.

### 6.1 Layer Order

Recommended order:

1. garment silhouette base
2. active body layer
3. active sleeve layer
4. active collar layer
5. color fills or masked tint zones
6. logos
7. text and number overlays
8. highlight/shadow finish layer

### 6.2 Compositor Contract

The frontend compositor should accept:

- active part selection
- current color zone values
- current view (`front` or `back`)
- overlay payload

It returns:

- drawable layer list
- zone metadata for controls
- preview-ready state

## 7. Backend and API Changes

Phase one should preserve current route families while changing payload meaning.

### 7.1 Keep

- `GET /api/customizer/catalog`
- `POST /api/customizer/session`
- `PATCH /api/customizer/session/:id`
- quote and order submit endpoints

### 7.2 Extend

`catalog` response should include:

- product types
- template families
- part variants grouped by family and part type
- color zone definitions

`session` payload should include:

- selected `templateFamily`
- selected `partVariant` by part type
- current `view`

## 8. Implementation Mapping

### 8.1 Files To Refactor

- `models/customizer/catalog.js`
- `models/customizer/sessions.js`
- `routes/customizerApi.js`
- `views/customizer/index.ejs`
- `views/customizer/editor.ejs`
- `public/js/customizer/catalog.js`
- `public/js/customizer/state.js`
- `public/js/customizer/editor.js`
- `public/js/customizer/compositor.js`
- `public/js/customizer/app.js`

### 8.2 New Supporting Assets

- template-family seed data
- part-variant seed data
- preview layer manifests for front/back

## 9. Non-Goals

This phase does not attempt to:

- recreate the original site pixel for pixel
- reuse proprietary template files
- copy product names, assets, or exact UI artwork
- implement full manufacturing CAD output

## 10. Success Criteria

The rebuild is successful when:

- editor starts with style selection, not generic form entry
- a user can visibly change `body`, `sleeve`, and `collar`
- preview changes show garment construction differences, not only color changes
- session persistence still works
- quote and order flows still accept the reconstructed design session

## 11. Rollout Order

1. add new catalog schema and seed data
2. update API to serve families and part variants
3. rebuild editor UI around part selection
4. rebuild compositor for layered preview assembly
5. reconnect quote/order submission to new session payload
6. validate with focused tests for catalog, session shape, and preview state
