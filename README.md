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

- Spread two hands. Your thumb and index fingertips define the 2D portal, which can fold into a bowtie as you rotate a hand. In 3D Mesh mode, all five fingertips form two filtered mesh bands. In 3D Elements mode, each hand holds its own Fire or Water orb. Choose each hand’s element independently. The assignments follow your first left/right positions in the mirrored view and stay attached as your hands move.
- Face your palm toward the camera and briefly touch thumb to pinky to change the look, or that hand’s element in 3D Elements, once; visibly separate them before changing it again. Sideways hands and projected fingertip overlap do not count as a tap. Close both fists to cycle through 2D Portal, 3D Mesh, and 3D Elements. The gesture guards prevent a held pose from cycling rapidly.
- Choose among six looks in 2D Portal and 3D Mesh, or Fire and Water in 3D Elements mode, and adjust strength on screen.
- Bring both elemental orbs together and hold for five seconds. The mixing animation and countdown build toward Steamfire (Fire + Water), a larger Tidal sphere (Water + Water), or Inferno with a fire splash burst (Fire + Fire). Separate your hands to split the result. Brief tracking flicker pauses the timer; a longer interruption cancels the hold. Changing an element, changing mode, or ending the session resets fusion.
- The portal appears only while one or two hands are visible to the camera. Without a tracked hand, visitors see the mirrored camera feed.
- Capture a branded PNG using **Capture this moment** while a hand is tracked. **End session** stops the camera for the next visitor.

Shortcuts: `C` changes dimension, `N` / `P` (or arrow keys) cycle looks or toggle both hand elements, and `Space` captures. Buttons have keyboard focus and accessible labels.

## Privacy and assets

The camera feed and hand landmarks are processed in the browser. Photos are not uploaded, and the app does not request microphone access. Captured PNGs download to the visitor's device. The MediaPipe hand model and WebAssembly files live in `public/`, so hand tracking does not rely on a CDN during the fair.

The CSS and University artwork came from the linked society repository. Pixelify Sans and DM Sans are included with their OFL license texts under `public/assets/fonts/`.

The Retrolens gesture and fingertip geometry concept was translated from its Python implementation. Its MIT license is retained in `licenses/RETROLENS-MIT.txt`.
