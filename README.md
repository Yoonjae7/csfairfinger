# CSS Reality Lab

A hand-controlled camera experience for the Computer Science Society fair. It borrows the typography, colors, and society artwork from the [CSS Photo Club](https://github.com/Yoonjae7/cssphotoclub) and adapts the fingertip portal mechanic from [Retrolens](https://github.com/syahdanfx/Retrolens). Hand tracking, its model, fonts, and artwork are bundled locally.

## Run at the booth

Use Node.js 22.12 or newer. Install and build while you have internet access:

```bash
npm ci
npm run build
```

Then run the static preview, even while offline:

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173) in Chrome or Edge on the booth laptop. Allow camera access when prompted. The browser needs `localhost` or HTTPS for camera access; an ordinary HTTP LAN address will not work.

For local development, use `npm run dev -- --host 127.0.0.1`.

## Play

- Spread two hands. Your thumb and index fingertips define the 2D portal, which can fold into a bowtie as you rotate a hand. In 3D Mesh mode, all five fingertips form two filtered mesh bands. These original geometry algorithms are unchanged.
- **Hypergeometry** expands the same five-tip mesh into a large prismatic field: a rotating 3D icosahedron, a layered crystal core, translucent prism faces, tilted polygon orbits, traveling light, and orbiting tetrahedral shards. Spread your hands to grow the field, open or curl your fingers to change its size and depth, tilt them to turn it, and move them to bend the geometry and stretch its light trails. Prism faces carry inset patterns and moving reflections, with darker edges that keep the shape visible in bright rooms. Bring both hands closer together to accelerate the cage, crystal, orbits, and flowing light; move them apart to slow down. Spin speed changes smoothly without jumping the animation phase. One hand makes a smaller field at the normal slow speed. This replaces Elements mode.
- Show your palm to the camera and tap thumb to pinky to change the look once; visibly separate them before changing it again. Sideways hands and projected fingertip overlap do not count as a tap. Close both fists to cycle through 2D Portal, 3D Mesh, and Hypergeometry. The gesture guards prevent a held pose from cycling rapidly.
- Choose among the same six looks in every mode and adjust strength on screen. Hypergeometry uses a distinct light palette for each look and responds immediately, with no forging timer. Automatic motion pauses when the browser requests reduced motion; fingertip control still works.
- The portal appears only while one or two hands are visible to the camera. Without a tracked hand, visitors see the mirrored camera feed.
- Capture a branded PNG using **Capture this moment** while a hand is tracked. **End session** stops the camera for the next visitor.

Shortcuts: `C` changes dimension, `N` / `P` (or arrow keys) cycle looks, and `Space` captures. Buttons have keyboard focus and accessible labels.

## Privacy and assets

The camera feed and hand landmarks are processed in the browser. Photos are not uploaded, and the app does not request microphone access. Captured PNGs download to the visitor's device. The MediaPipe hand model and WebAssembly files live in `public/`, so hand tracking does not rely on a CDN during the fair.

The CSS and University artwork came from the linked society repository. Pixelify Sans and DM Sans are included with their OFL license texts under `public/assets/fonts/`.

The Retrolens gesture and fingertip geometry concept was translated from its Python implementation. Its MIT license is retained in `licenses/RETROLENS-MIT.txt`.
