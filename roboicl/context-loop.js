(() => {
  const root = document.querySelector('#context-loop');
  if (!root) return;

  // The footage clock drives the explainer. Stage boundaries are editorial cues.
  const chapters = {
    icl: {
      task: 'Stack Bowls', camera: 'Head camera', label: 'Reference context', title: 'One demonstration',
      stages: [
        [0, 'Read the demo', 'Read context', 'Current scene ready', 'Time-spaced windows from one demonstration enter the context.', [0]],
        [1.5, 'Observe', 'Read the scene', 'Current observation', 'The model sees the current scene and the retained interaction history.', [3, 1]],
        [2.8, 'Execute', 'Send an action', 'Action chunk', 'The model sends an action chunk and the arm moves in the recorded episode.', [2]],
        [16, 'Update memory', 'Keep the result', 'Execution feedback', 'The new observation and execution receipt feed the next decision. Earlier anchors stay in memory.', [3, 4]],
      ],
    },
    wrist: {
      task: 'Insert Tubes', camera: 'Wrist camera', label: 'MXI · Wrist guides', title: 'Where the fingers close',
      evidence: [['wrist-evidence', 'A second view shows the arm and target in the scene.']],
      stages: [
        [0, 'Inspect', 'Read the wrist view', 'Original wrist view', 'The wrist camera sees the target before the guides appear.', [3]],
        [1.45, 'Project', 'Use the guide', 'Projected grasp center', 'Camera calibration projects the nominal closing center and the inner finger edges.', [0]],
        [3.2, 'Align', 'Align the grasp', 'Approach the reticle', 'As the arm approaches, the projected center gives the model a reference for correcting the offset.', [2]],
        [6.55, 'Close and lift', 'Read the result', 'Close and lift', 'The wrist view follows the fingers as they close and lift the tube.', [2, 3]],
      ],
    },
    triangulation: {
      task: 'Target localization', camera: 'Head camera', label: 'MXI · Triangulation', title: 'From rays to a 3D point',
      evidence: [
        ['triangulation-input', 'A single image leaves the distance along the viewing ray open.'],
        ['triangulation-input', 'A corresponding landmark in the wrist view adds a second constraint.'],
        ['triangulation-evidence', 'The calibrated views constrain the same target point.'],
      ],
      stages: [
        [0, 'One ray', 'Inspect the pixel', 'Depth unknown', 'One pixel defines a direction. The distance along that ray is still unknown.', [3]],
        [5.65, 'Two views', 'Match the target', 'Second viewing ray', 'A matching point in the wrist view adds a second calibrated ray.', [0]],
        [9.55, 'Resolve depth', 'Read the 3D point', 'Depth · 0.507 m', 'The rays constrain the target position. Its estimated optical-axis depth is 0.507 m in the head view.', [0]],
        [12.2, 'Return to motion', 'Observe the arm', 'Recorded motion', 'The view returns to the recorded episode after the geometry explanation.', [2, 3]],
      ],
    },
    motion: {
      task: 'Pouring', camera: 'Head camera', label: 'MXI · Motion checks', title: 'Preview before execution',
      evidence: [
        ['motion-check', 'The candidate is checked before the arm moves.'],
        ['motion-rejected', 'The controller receives no motion for this candidate.'],
        ['motion-evidence', 'The accepted preview reconstructs motion from recorded joint targets.'],
      ],
      stages: [
        [0, 'Check', 'Propose a pose', 'Checking the candidate', 'The motion tool checks whether the proposed pose has an IK solution.', [2]],
        [1.2, 'Reject', 'Revise the proposal', 'IK rejected · no motion', 'The first proposal has no valid IK solution. The arm stays at its current pose.', [3]],
        [2.6, 'Preview', 'Preview the route', 'Accepted kinematic preview', 'The translucent arm previews the accepted route before the recorded arm moves.', [2]],
        [10.2, 'Execute', 'Observe the result', 'Recorded execution', 'The preview clears and the recorded arm executes the motion.', [2, 3]],
      ],
    },
  };

  const asset = name => new URL(`../assets/overview/${name}`, document.baseURI).href;
  const find = name => root.querySelector(`[data-loop-${name}]`);
  const video = find('video');
  const stage = root.querySelector('.loop-stage');
  const cameraFrame = root.querySelector('.loop-camera');
  const reference = root.querySelector('.loop-reference');
  const evidence = root.querySelector('.loop-evidence');
  const modeButtons = [...root.querySelectorAll('[data-loop-mode]')];
  const stepButtons = [...root.querySelectorAll('[data-loop-step]')];
  const paths = [...root.querySelectorAll('[data-loop-path]')];
  const signals = [...root.querySelectorAll('[data-loop-signal]')];
  const lengths = paths.map(path => path.getTotalLength());
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const error = find('error');
  const trail = find('trail');
  let activeRoute = -1;
  const play = find('play');
  let mode = 'icl';
  let phase = -1;
  let frame = 0;
  let pendingTime = 0;
  let visible = false;
  let wantsPlayback = !motionPreference.matches;

  function paint(time) {
    const { stages, evidence: images } = chapters[mode];
    const index = stages.findLastIndex(([start]) => start <= time);
    const [start, , agent, cue, caption, routes] = stages[Math.max(0, index)];
    if (index !== phase) {
      phase = index;
      root.dataset.phase = index;
      find('agent').textContent = agent;
      find('cue').textContent = cue;
      find('caption').textContent = caption;
      if (images) {
        const [image, note] = images[Math.min(Math.max(0, index), images.length - 1)];
        find('evidence-img').src = asset(`${image}.webp`);
        find('evidence-note').textContent = note;
      }
      stepButtons.forEach((button, i) => {
        if (i === index) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
    }
    const pulse = (Math.max(0, time - start) / 1.45) % routes.length;
    const active = routes[Math.floor(pulse)];
    const position = paths[active].getPointAtLength(lengths[active] * (pulse % 1));
    signals[active].setAttribute('cx', position.x);
    signals[active].setAttribute('cy', position.y);
    const flowing = !video.paused && !motionPreference.matches;
    if (activeRoute !== active) {
      activeRoute = active;
      trail.setAttribute('d', paths[active].getAttribute('d'));
    }
    trail.setAttribute('stroke-dashoffset', .2 - (pulse % 1));
    trail.toggleAttribute('data-active', flowing);
    paths.forEach((path, i) => path.toggleAttribute('data-active', routes.includes(i)));
    signals.forEach((signal, i) => signal.toggleAttribute('data-active', i === active && flowing));
  }

  function tick() {
    paint(video.currentTime);
    if (!video.paused) frame = requestAnimationFrame(tick);
  }

  function loadClip() {
    if (!video.hasAttribute('src')) video.src = asset(`${mode}.mp4`);
  }

  function syncPlayback() {
    if (!wantsPlayback || !visible || document.hidden || (video.ended && !video.seeking)) {
      video.pause();
      play.textContent = 'Play';
      return;
    }
    loadClip();
    const requestedSource = video.src;
    video.play().catch(reason => {
      if (reason.name === 'AbortError' || requestedSource !== video.src) return;
      play.textContent = 'Play';
      // Autoplay policies may require a user gesture. The Play control stays available.
      if (reason.name !== 'NotAllowedError') error.hidden = false;
    });
  }

  function seek(time) {
    loadClip();
    if (video.readyState) video.currentTime = time;
    else pendingTime = time;
    paint(time);
  }

  function choose(next) {
    if (next === mode && phase >= 0) return;
    mode = next;
    phase = -1;
    pendingTime = 0;
    const chapter = chapters[mode];
    root.dataset.mode = mode;
    video.pause();
    video.removeAttribute('src');
    video.load();
    cameraFrame.removeAttribute('data-ready');
    video.poster = asset(`${mode}.webp`);
    find('poster').src = video.poster;
    video.setAttribute('aria-label', `Recorded ${chapter.task} sequence`);
    find('task').textContent = chapter.task;
    find('camera').textContent = chapter.camera;
    find('input-label').textContent = chapter.label;
    find('input-title').textContent = chapter.title;
    reference.hidden = mode !== 'icl';
    evidence.hidden = mode === 'icl';
    error.hidden = true;
    error.querySelector('a').href = asset(`${mode}.mp4`);
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.loopMode === mode)));
    stepButtons.forEach((button, i) => { button.querySelector('b').textContent = chapter.stages[i][1]; });
    paint(0);
    syncPlayback();
  }

  video.addEventListener('loadedmetadata', () => { if (pendingTime) video.currentTime = pendingTime; pendingTime = 0; });
  video.addEventListener('loadeddata', () => { cameraFrame.setAttribute('data-ready', ''); error.hidden = true; });
  video.addEventListener('seeked', () => paint(video.currentTime));
  video.addEventListener('playing', () => {
    play.textContent = 'Pause';
    cancelAnimationFrame(frame);
    tick();
  });
  video.addEventListener('pause', () => {
    play.textContent = 'Play';
    cancelAnimationFrame(frame);
    if (video.readyState) paint(video.currentTime);
  });
  video.addEventListener('error', () => { if (video.hasAttribute('src')) error.hidden = false; });
  modeButtons.forEach(button => button.addEventListener('click', () => choose(button.dataset.loopMode)));
  stepButtons.forEach((button, i) => button.addEventListener('click', () => seek(chapters[mode].stages[i][0])));
  play.addEventListener('click', () => {
    wantsPlayback = video.paused;
    if (video.ended && wantsPlayback) seek(0);
    syncPlayback();
  });
  find('replay').addEventListener('click', () => { wantsPlayback = true; seek(0); syncPlayback(); });
  document.addEventListener('visibilitychange', syncPlayback);
  motionPreference.addEventListener('change', () => { wantsPlayback = !motionPreference.matches; syncPlayback(); });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= .32;
    syncPlayback();
  }, { threshold: [.32] }).observe(stage);
  choose(mode);
})();
