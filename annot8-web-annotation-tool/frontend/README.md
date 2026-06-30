# Annot8 Frontend

This directory contains the Vue 3 frontend that implements the main Annot8 annotation workflow.

For installation, execution and testing instructions, see the [main repository README](../../README.md).

## Responsibilities

The frontend is responsible for:

* displaying and navigating document pages
* managing zoom and document coordinates
* creating rectangles, polygons and polylines
* selecting, moving, resizing and deleting regions
* editing polygon and polyline points
* handling overlapping regions
* displaying hierarchical annotation schemas
* assigning annotations to regions
* storing regions and annotations in the browser

## Main Structure

```text
frontend/
├── src/
│   ├── components/viewer/   Viewer components and canvas behaviour
│   ├── models/              Document and schema models
│   ├── services/            Mock API access
│   ├── utils/               Geometry, validation and viewer utilities
│   ├── views/               Main application views
│   ├── App.vue
│   └── main.js
├── tests/                   Frontend test suite
├── package.json
└── vite.config.js
```

## Application State

`ViewerPage.vue` owns the active document regions and coordinates the main viewer components.

`AnnotationCanvas.vue` manages the Konva canvas and delegates drawing and editing behaviour to specialised composables.

`ProjectDocumentModel.js` serialises and restores regions using `localStorage`.

## Coordinate System

Regions are stored using the original document coordinates.

The current zoom level only changes their visual representation on the canvas. It does not modify the stored region geometry.

## Region Types

### Rectangle

Rectangles can be created, selected, moved and resized.

They are stored using:

```text
left
top
right
bottom
```

### Polygon

Polygons are stored as closed ordered lists of points.

They support:

* movement
* vertex editing
* point insertion
* point deletion

### Polyline

Polylines are stored as open ordered lists of points.

They support:

* movement
* vertex editing
* point insertion
* endpoint extension
* point deletion

## Spatial Indexing

A QuadTree spatial index reduces the number of regions evaluated during point-based selection.

The final geometric checks still determine whether a region is actually selected.

## Persistence

Regions and assigned annotations are stored under:

```text
annot8:documents:<documentId>:regions
```

The mock backend is not used to save region changes.

## Testing

The frontend test suite covers:

* components and views
* document and schema models
* API services
* geometry and validation
* spatial indexing
* region creation and editing
* viewer interactions

Vitest, Vue Test Utils and jsdom are used as the testing environment.
