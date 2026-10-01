import './styles.css';
import { createScene } from './scene.js';
import { analyzeHand, createGestureController } from './gestures.js';
import { fusionName } from './element-fusion.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#scene');
const video = $('#camera');
const scene = createScene(canvas);
const welcome = $('#welcome');
const captureButton = $('#capture');
const cameraState = $('#camera-state');
const trackingState = $('#tracking-state');
const hint = $('#stage-hint');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const elementButtons = [...document.querySelectorAll('[data-element]')];
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const filterNames = filterButtons.map(button => button.dataset.filter);
const elementNames = [...new Set(elementButtons.map(button => button.dataset.element))];
const modeNames = modeButtons.map(button => button.dataset.mode);
const modeLabels = { '2d': '2D portal', '3d': '3D mesh', elemental: '3D elements' };
const gestureController = createGestureController();
const handGestures = { left: createGestureController(), right: createGestureController() };
let stream = null;
let landmarker = null;
let trackingLoopActive = false;
let lastVideoTime = -1;
let cameraRequest = 0;
let handCount = 0;
let captureInProgress = false;

function updateCaptureAvailability() {
  captureButton.disabled = !stream || handCount === 0 || captureInProgress;
}

function setSourceStatus(label, live = false) {
  cameraState.innerHTML = `<span class="status-signal${live ? ' on' : ''}"></span> ${label}`;
  $('#stage-live-label').textContent = live ? 'CAMERA LIVE' : label;
  $('.live-dot').classList.toggle('on', live);
}

function hideWelcome() {
  welcome.classList.add('hidden');
  $('#end-session').hidden = false;
  updateCaptureAvailability();
}

function setHint(message) {
  hint.textContent = message;
}

function stopCamera() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  video.pause();
  video.srcObject = null;
  trackingLoopActive = false;
  scene.setHands([]);
  scene.resetSession();
  gestureController.reset();
  Object.values(handGestures).forEach(controller => controller.reset());
  handCount = 0;
  updateCaptureAvailability();
}

function endSession(message = 'Spread your hands to open the portal. Your photo stays on this device.') {
  ++cameraRequest;
  stopCamera();
  scene.setSource(null);
  setSourceStatus('CAMERA OFF');
  trackingState.textContent = 'WAITING FOR CAMERA';
  welcome.querySelector('p').textContent = message;
  welcome.classList.remove('hidden');
  $('#end-session').hidden = true;
  setHint(message);
}

async function loadLandmarker() {
  if (landmarker) return landmarker;
  const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks('/wasm');
  const options = {
    baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.5,
  };
  try {
    landmarker = await HandLandmarker.createFromOptions(fileset, options);
  } catch {
    options.baseOptions.delegate = 'CPU';
    landmarker = await HandLandmarker.createFromOptions(fileset, options);
  }
  return landmarker;
}

function processHands(result) {
  const scale = Math.max(1280 / video.videoWidth, 800 / video.videoHeight);
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;
  const detected = (result.landmarks || []).map((raw, index) => {
    const landmarks = raw.map(p => ({
      x: ((1 - p.x) * drawWidth + (1280 - drawWidth) / 2) / 1280,
      y: (p.y * drawHeight + (800 - drawHeight) / 2) / 800,
      z: p.z * drawWidth / 1280,
    }));
    return { ...analyzeHand(landmarks, result.worldLandmarks?.[index]), handedness: result.handedness?.[index]?.[0]?.categoryName };
  });
  const hands = scene.setHands(detected);
  const gesture = gestureController.update(hands, performance.now());
  handCount = hands.length;
  updateCaptureAvailability();
  if (gesture.toggleMode) {
    selectMode(modeNames[(modeNames.indexOf(scene.state.mode) + 1) % modeNames.length]);
    setHint(`Mode switched to ${modeLabels[scene.state.mode]}. Spread your hands again to reshape it.`);
  } else if (scene.state.mode === 'elemental') {
    for (const slot of ['left', 'right']) {
      const hand = hands.find(candidate => candidate.slot === slot);
      const local = handGestures[slot].update(gesture.dualFist || !hand ? [] : [hand], performance.now());
      if (local.nextFilter) {
        selectElement(scene.state.elements[slot] === 'fire' ? 'water' : 'fire', slot);
        setHint(`${slot === 'left' ? 'Left' : 'Right'} hand element changed. Bring both orbs together and hold for five seconds to forge them.`);
      }
    }
  } else if (gesture.nextFilter) {
    cycleLook(1);
    setHint(`${scene.state.mode === 'elemental' ? 'Element' : 'Look'} changed. Release your thumb and pinky, then touch them again to change it once more.`);
  }
  trackingState.textContent = gesture.dualFist ? 'TWO FISTS / MODE SWITCH' : gesture.filterPinch ? `THUMB + PINKY / NEXT ${scene.state.mode === 'elemental' ? 'ELEMENT' : 'LOOK'}` : hands.length >= 2 ? `TWO HANDS / ${scene.state.mode === '3d' ? 'MESH' : scene.state.mode === 'elemental' ? 'ELEMENTS' : 'PORTAL'} LIVE` : hands.length === 1 ? `ONE HAND / MINI ${scene.state.mode === 'elemental' ? 'ELEMENT' : 'PORTAL'}` : 'SHOW YOUR HANDS TO OPEN PORTAL';
}

function trackHands() {
  if (!trackingLoopActive || !stream) return;
  if (!document.hidden && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try {
      processHands(landmarker.detectForVideo(video, performance.now()));
    } catch (error) {
      console.error('Hand tracking stopped:', error);
      endSession('Hand tracking stopped. Reopen the camera to try again.');
      return;
    }
  }
  requestAnimationFrame(trackHands);
}

async function openCamera() {
  const request = ++cameraRequest;
  const launch = $('#open-camera');
  launch.disabled = true;
  launch.innerHTML = 'Opening camera… <span>✳</span>';
  setSourceStatus('CONNECTING…');
  trackingState.textContent = 'WAITING FOR CAMERA';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support camera access.');
    stopCamera();
    const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    if (request !== cameraRequest) { nextStream.getTracks().forEach(track => track.stop()); return; }
    stream = nextStream;
    video.srcObject = stream;
    await video.play();
    if (request !== cameraRequest || !stream) return;
    scene.setSource({ kind: 'video', element: video });
    hideWelcome();
    setSourceStatus('CAMERA LIVE', true);
    trackingState.textContent = 'LOADING HAND TRACKER…';
    setHint('Spread two hands to open the effect. Touch thumb to pinky for the next look or element; close both fists to change mode.');
    try {
      await loadLandmarker();
      if (request !== cameraRequest || !stream) return;
      lastVideoTime = -1;
      trackingLoopActive = true;
      trackHands();
    } catch (error) {
      console.error('Hand tracker could not load:', error);
      endSession('Hand tracking could not start. Reopen the camera to try again.');
    }
  } catch (error) {
    console.error('Camera could not start:', error);
    if (request !== cameraRequest) return;
    const message = error?.name === 'NotAllowedError' ? 'Camera access was declined. Allow it in your browser, then try again.' : 'The camera could not open. Check that it is connected, then try again.';
    endSession(message);
  } finally {
    launch.disabled = false;
    launch.innerHTML = 'Open the camera <span>↗</span>';
  }
}

function selectMode(mode) {
  if (scene.state.mode !== mode) Object.values(handGestures).forEach(controller => controller.reset());
  scene.setMode(mode);
  modeButtons.forEach(button => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('#filter-section').hidden = mode === 'elemental';
  $('#element-section').hidden = mode !== 'elemental';
  updateEffectLabel();
}

function selectFilter(name) {
  scene.setFilter(name);
  filterButtons.forEach(button => {
    const active = button.dataset.filter === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('#filter-count').textContent = `${String(filterNames.indexOf(name) + 1).padStart(2, '0')} / 06`;
  updateEffectLabel();
}

function selectElement(name, slot) {
  scene.setElement(name, slot);
  elementButtons.forEach(button => {
    const active = button.dataset.element === scene.state.elements[button.dataset.hand];
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  for (const hand of ['left', 'right']) $(`#${hand}-element-name`).textContent = scene.state.elements[hand].toUpperCase();
  updateEffectLabel();
}

function updateEffectLabel() {
  const look = scene.state.mode === 'elemental'
    ? scene.state.fusion.fused ? fusionName(scene.state.fusion.fused.kind) : `${scene.state.elements.left} + ${scene.state.elements.right}`
    : scene.state.filter;
  $('#effect-label').textContent = `◌  ${modeLabels[scene.state.mode].toUpperCase()} / ${look.toUpperCase()}`;
}

function cycleLook(direction) {
  if (scene.state.mode === 'elemental') {
    for (const slot of ['left', 'right']) selectElement(elementNames[(elementNames.indexOf(scene.state.elements[slot]) + direction + elementNames.length) % elementNames.length], slot);
  } else {
    selectFilter(filterNames[(filterNames.indexOf(scene.state.filter) + direction + filterNames.length) % filterNames.length]);
  }
}

function capture() {
  if (captureButton.disabled) return;
  captureInProgress = true;
  updateCaptureAvailability();
  const flash = $('#flash');
  flash.classList.remove('active');
  void flash.offsetWidth;
  flash.classList.add('active');
  const image = scene.capture();
  image.toBlob(blob => {
    captureInProgress = false;
    updateCaptureAvailability();
    if (!blob) { setHint('The image could not be saved. Please try again.'); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `css-reality-lab-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setHint('Moment captured! The PNG was downloaded to this device.');
  }, 'image/png');
}

$('#open-camera').addEventListener('click', openCamera);
$('#end-session').addEventListener('click', () => endSession());
$('#capture').addEventListener('click', capture);
modeButtons.forEach(button => button.addEventListener('click', () => selectMode(button.dataset.mode)));
filterButtons.forEach(button => button.addEventListener('click', () => selectFilter(button.dataset.filter)));
elementButtons.forEach(button => button.addEventListener('click', () => selectElement(button.dataset.element, button.dataset.hand)));
$('#swap-elements').addEventListener('click', () => {
  const { left, right } = scene.state.elements;
  selectElement(right, 'left'); selectElement(left, 'right');
});
$('#split-elements').addEventListener('click', () => scene.resetFusion(true));
$('#strength').addEventListener('input', event => {
  const value = Number(event.target.value);
  scene.setStrength(value / 100);
  $('#strength-value').textContent = `${value}%`;
});

document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
  if (event.key.toLowerCase() === 'c') selectMode(modeNames[(modeNames.indexOf(scene.state.mode) + 1) % modeNames.length]);
  if (event.key.toLowerCase() === 'n' || event.key === 'ArrowRight') cycleLook(1);
  if (event.key.toLowerCase() === 'p' || event.key === 'ArrowLeft') cycleLook(-1);
  if (event.key === ' ' && !captureButton.disabled) { event.preventDefault(); capture(); }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { handCount = 0; scene.setHands([]); scene.resetFusion(); updateCaptureAvailability(); }
});
window.addEventListener('pagehide', stopCamera);

selectMode(scene.state.mode);
selectFilter(scene.state.filter);
selectElement(scene.state.elements.left, 'left');
selectElement(scene.state.elements.right, 'right');
scene.onFusionChange(fusion => {
  $('#split-elements').hidden = fusion.phase === 'idle';
  const kind = scene.state.elements.left === scene.state.elements.right ? scene.state.elements.left : 'hybrid';
  const name = fusionName(kind);
  $('#fusion-status').textContent = fusion.phase === 'fused' ? `${name} forged! Pull your hands apart to split it.`
    : fusion.phase === 'mixing' ? `Forging ${name}… Keep both hands close.`
    : `${scene.state.elements.left === 'fire' ? 'Fire' : 'Water'} + ${scene.state.elements.right === 'fire' ? 'Fire' : 'Water'} → ${name}. Start with hands apart.`;
  updateEffectLabel();
});
