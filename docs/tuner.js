/* The hero instrument: the app's cents scale, running in the page.
 *
 * The app's audio engine is built on react-native-audio-api, which implements
 * the Web Audio spec — so the drone here is the same construction as the one
 * on the phone, and the measurement is the same measurement.
 *
 * The pitch detector is not the same: the app uses the McLeod method via
 * pitchy. This is a plain autocorrelation, which is smaller and good enough to
 * show a needle, but less robust on the low strings.
 */
(function () {
  'use strict';

  var A4 = 440;
  var NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

  /* Geometry of the 500×104 viewBox: ±50 cents across 450px, centred on 250. */
  var CENTRE_X = 250;
  var PX_PER_CENT = 4.5;

  var els = {
    readout: document.getElementById('readout'),
    note: document.getElementById('note'),
    cents: document.getElementById('cents'),
    hz: document.getElementById('hz'),
    needle: document.getElementById('needle'),
    ticks: document.getElementById('ticks'),
    droneBtn: document.getElementById('drone'),
    micBtn: document.getElementById('mic'),
    status: document.getElementById('status'),
  };
  if (!els.readout) return;

  /* ---------------------------------------------------------------- ticks */

  var SVG_NS = 'http://www.w3.org/2000/svg';
  for (var c = -50; c <= 50; c += 5) {
    var major = c % 25 === 0;
    var line = document.createElementNS(SVG_NS, 'line');
    var x = CENTRE_X + c * PX_PER_CENT;
    line.setAttribute('x1', x);
    line.setAttribute('x2', x);
    line.setAttribute('y1', major ? 14 : 30);
    line.setAttribute('y2', major ? 90 : 74);
    line.setAttribute('class', major ? 'tick-major' : 'tick');
    els.ticks.appendChild(line);
  }

  /* ---------------------------------------------------------------- audio */

  var ctx = null;
  var drone = null;
  var mic = null;

  function audio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function startDrone() {
    var ac = audio();
    var out = ac.createGain();
    out.gain.value = 0;
    out.connect(ac.destination);

    // Fundamental plus a couple of quiet harmonics reads as a bowed string
    // rather than a test tone.
    var partials = [
      [1, 0.5],
      [2, 0.18],
      [3, 0.09],
    ];
    var oscs = partials.map(function (p) {
      var osc = ac.createOscillator();
      var g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = A4 * p[0];
      g.gain.value = p[1];
      osc.connect(g).connect(out);
      osc.start();
      return osc;
    });

    // Slow breathing swell, as on the phone.
    var lfo = ac.createOscillator();
    var lfoGain = ac.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain).connect(out.gain);
    lfo.start();

    out.gain.setValueAtTime(0, ac.currentTime);
    out.gain.linearRampToValueAtTime(0.13, ac.currentTime + 0.4);

    drone = { out: out, oscs: oscs, lfo: lfo };
  }

  function stopDrone() {
    if (!drone) return;
    var d = drone;
    drone = null;
    var t = ctx.currentTime;
    d.out.gain.cancelScheduledValues(t);
    d.out.gain.setValueAtTime(d.out.gain.value, t);
    d.out.gain.linearRampToValueAtTime(0, t + 0.25);
    setTimeout(function () {
      d.oscs.forEach(function (o) {
        o.stop();
      });
      d.lfo.stop();
      d.out.disconnect();
    }, 350);
  }

  /* ------------------------------------------------------- pitch tracking */

  function detect(buf, sampleRate) {
    var size = buf.length;
    var rms = 0;
    for (var i = 0; i < size; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / size);
    if (rms < 0.008) return -1;

    // Autocorrelation over the lag range that covers a violin: the open G is
    // 196 Hz and the top of the E string is around 2100 Hz.
    var minLag = Math.floor(sampleRate / 2200);
    var maxLag = Math.floor(sampleRate / 150);
    if (maxLag > size - 1) maxLag = size - 1;

    var best = -1;
    var bestCorr = 0;
    var prev = 0;
    var rising = false;

    for (var lag = minLag; lag <= maxLag; lag++) {
      var sum = 0;
      for (var j = 0; j < size - lag; j++) sum += buf[j] * buf[j + lag];
      var corr = sum / (size - lag);

      // Take the first strong peak, not the global maximum: the global max
      // tends to sit an octave down.
      if (corr > prev) {
        rising = true;
      } else if (rising) {
        if (corr > bestCorr && prev > 0) {
          bestCorr = prev;
          best = lag - 1;
          break;
        }
        rising = false;
      }
      prev = corr;
    }
    if (best < 1) return -1;

    // Parabolic interpolation around the peak for sub-sample resolution.
    var y0 = corrAt(buf, best - 1, size);
    var y1 = corrAt(buf, best, size);
    var y2 = corrAt(buf, best + 1, size);
    var denom = 2 * (2 * y1 - y0 - y2);
    var shift = denom !== 0 ? (y2 - y0) / denom : 0;
    return sampleRate / (best + shift);
  }

  function corrAt(buf, lag, size) {
    if (lag < 1 || lag >= size) return 0;
    var sum = 0;
    for (var j = 0; j < size - lag; j++) sum += buf[j] * buf[j + lag];
    return sum / (size - lag);
  }

  /* --------------------------------------------------------------- render */

  var smoothed = null;

  // Show nothing rather than a stale reading — a greyed-out note above a
  // confident "0¢" reads as broken, not as waiting.
  function showIdle() {
    els.readout.setAttribute('data-grade', 'idle');
    smoothed = null;
    moveNeedle(0);
  }

  function show(freq) {
    if (freq <= 0) {
      showIdle();
      return;
    }
    var n = 12 * Math.log2(freq / A4);
    var midi = Math.round(n) + 69;
    var cents = (n - Math.round(n)) * 100;

    // Exponential smoothing, as the app does, so the needle settles.
    smoothed = smoothed === null ? cents : smoothed + (cents - smoothed) * 0.35;

    var abs = Math.abs(smoothed);
    var grade = abs <= 5 ? 'true' : abs <= 15 ? 'near' : 'off';

    els.note.textContent = NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
    els.cents.textContent = (smoothed >= 0 ? '+' : '−') + Math.abs(smoothed).toFixed(0) + '¢';
    els.hz.textContent = freq.toFixed(1) + ' Hz';
    els.readout.setAttribute('data-grade', grade);
    moveNeedle(smoothed);
  }

  function moveNeedle(cents) {
    var clamped = Math.max(-50, Math.min(50, cents));
    els.needle.setAttribute('transform', 'translate(' + clamped * PX_PER_CENT + ' 0)');
  }

  /* -------------------------------------------------------------- toggles */

  function setPressed(btn, on) {
    btn.setAttribute('aria-pressed', String(on));
  }

  els.droneBtn.addEventListener('click', function () {
    if (drone) {
      stopDrone();
      setPressed(els.droneBtn, false);
      els.droneBtn.textContent = 'Play the A drone';
      els.status.textContent = 'Drone stopped.';
      showIdle();
      return;
    }
    if (mic) stopMic();
    startDrone();
    setPressed(els.droneBtn, true);
    els.droneBtn.textContent = 'Stop the drone';
    els.status.textContent = 'A 440 — the reference the app tunes everything to.';
    els.readout.setAttribute('data-grade', 'true');
    els.note.textContent = 'A4';
    els.cents.textContent = '0¢';
    els.hz.textContent = '440.0 Hz';
    smoothed = 0;
    moveNeedle(0);
  });

  function stopMic() {
    if (!mic) return;
    cancelAnimationFrame(mic.raf);
    mic.stream.getTracks().forEach(function (t) {
      t.stop();
    });
    mic.source.disconnect();
    mic = null;
    setPressed(els.micBtn, false);
    els.micBtn.textContent = 'Use my microphone';
    showIdle();
  }

  els.micBtn.addEventListener('click', function () {
    if (mic) {
      stopMic();
      els.status.textContent = 'Microphone off.';
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      els.status.textContent = 'This browser will not give a page microphone access.';
      return;
    }
    // The drone would sit under everything you play and the detector would
    // lock onto it. The app solves that with leakage suppression; here they
    // simply take turns.
    if (drone) {
      stopDrone();
      setPressed(els.droneBtn, false);
      els.droneBtn.textContent = 'Play the A drone';
    }
    els.status.textContent = 'Asking for the microphone…';

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      .then(function (stream) {
        var ac = audio();
        var source = ac.createMediaStreamSource(stream);
        var analyser = ac.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        var buf = new Float32Array(analyser.fftSize);
        var last = 0;

        function loop(now) {
          // ~20 reads a second is plenty for a needle and keeps the main
          // thread free, which is the same reason the app throttles.
          if (now - last > 50) {
            analyser.getFloatTimeDomainData(buf);
            show(detect(buf, ac.sampleRate));
            last = now;
          }
          mic.raf = requestAnimationFrame(loop);
        }

        mic = { stream: stream, source: source, raf: 0 };
        mic.raf = requestAnimationFrame(loop);
        setPressed(els.micBtn, true);
        els.micBtn.textContent = 'Stop listening';
        els.status.textContent = 'Listening — play a note.';
      })
      .catch(function () {
        els.status.textContent =
          'No microphone access. Nothing is sent anywhere either way — the reading happens in this page.';
      });
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopDrone();
      setPressed(els.droneBtn, false);
      els.droneBtn.textContent = 'Play the A drone';
      stopMic();
    }
  });
})();
