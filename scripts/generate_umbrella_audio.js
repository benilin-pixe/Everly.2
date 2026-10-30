import fs from 'fs';
import path from 'path';

function generateUmbrellaAudio() {
  const sampleRate = 44100;
  const durationSec = 32;
  const numChannels = 2;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const pcmBytes = totalSamples * numChannels * 2;
  const buffer = Buffer.alloc(44 + pcmBytes);

  // WAV Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + pcmBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // AudioFormat PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * 2, 28);
  buffer.writeUInt16LE(numChannels * 2, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(pcmBytes, 40);

  // Breezy Anime Rom-Com Harmony: D - F#m - G - A (Breezy cheerful pop progression)
  // Umbrella Umbrella Umbrella theme motif:
  // F#5 -> G5 -> A5 -> F#5 -> E5 -> D5
  const chords = [
    { root: 293.66, freqs: [293.66, 369.99, 440.00, 587.33], bass: 146.83 }, // D
    { root: 369.99, freqs: [277.18, 369.99, 440.00, 554.37], bass: 185.00 }, // F#m
    { root: 196.00, freqs: [196.00, 246.94, 293.66, 392.00], bass: 98.00 },  // G
    { root: 220.00, freqs: [220.00, 277.18, 329.63, 440.00], bass: 110.00 }, // A
  ];

  const barDuration = 4.0; // 4 seconds per chord = 8 bars total in 32s

  // Umbrella melody notes (frequencies in Hz)
  const melodyNotes = [
    // Bar 1 (D)
    { t: 0.0, f: 587.33, dur: 0.4 }, // D5
    { t: 0.5, f: 659.25, dur: 0.4 }, // E5
    { t: 1.0, f: 739.99, dur: 0.7 }, // F#5 ("Um-brel-la")
    { t: 2.0, f: 739.99, dur: 0.4 },
    { t: 2.5, f: 659.25, dur: 0.4 },
    { t: 3.0, f: 587.33, dur: 0.8 },

    // Bar 2 (F#m)
    { t: 4.0, f: 739.99, dur: 0.4 },
    { t: 4.5, f: 880.00, dur: 0.4 }, // A5
    { t: 5.0, f: 739.99, dur: 0.6 },
    { t: 6.0, f: 659.25, dur: 0.4 },
    { t: 6.5, f: 587.33, dur: 0.4 },
    { t: 7.0, f: 659.25, dur: 0.8 },

    // Bar 3 (G)
    { t: 8.0, f: 783.99, dur: 0.4 }, // G5
    { t: 8.5, f: 880.00, dur: 0.4 }, // A5
    { t: 9.0, f: 987.77, dur: 0.7 }, // B5 ("Um-brel-la")
    { t: 10.0, f: 880.00, dur: 0.4 },
    { t: 10.5, f: 783.99, dur: 0.4 },
    { t: 11.0, f: 739.99, dur: 0.8 },

    // Bar 4 (A)
    { t: 12.0, f: 659.25, dur: 0.4 },
    { t: 12.5, f: 739.99, dur: 0.4 },
    { t: 13.0, f: 880.00, dur: 1.0 }, // A5
    { t: 14.5, f: 659.25, dur: 0.8 },

    // Bar 5 - 8 (Repeat variation)
    { t: 16.0, f: 587.33, dur: 0.4 },
    { t: 16.5, f: 659.25, dur: 0.4 },
    { t: 17.0, f: 739.99, dur: 0.7 },
    { t: 18.0, f: 739.99, dur: 0.4 },
    { t: 18.5, f: 659.25, dur: 0.4 },
    { t: 19.0, f: 587.33, dur: 0.8 },

    { t: 20.0, f: 739.99, dur: 0.4 },
    { t: 20.5, f: 880.00, dur: 0.4 },
    { t: 21.0, f: 987.77, dur: 0.6 },
    { t: 22.0, f: 880.00, dur: 0.4 },
    { t: 22.5, f: 739.99, dur: 0.4 },
    { t: 23.0, f: 659.25, dur: 0.8 },

    { t: 24.0, f: 783.99, dur: 0.4 },
    { t: 24.5, f: 880.00, dur: 0.4 },
    { t: 25.0, f: 739.99, dur: 0.6 },
    { t: 26.0, f: 659.25, dur: 0.4 },
    { t: 26.5, f: 587.33, dur: 0.4 },
    { t: 27.0, f: 493.88, dur: 0.8 }, // B4

    { t: 28.0, f: 587.33, dur: 0.4 },
    { t: 28.5, f: 659.25, dur: 0.4 },
    { t: 29.0, f: 587.33, dur: 1.8 }, // Final D5 resolve
  ];

  let byteOffset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;

    // Chord index (repeating 4 chords every 16s)
    const chordIdx = Math.floor((t % 16.0) / barDuration);
    const chord = chords[chordIdx];
    const beatTime = (t * 2.2) % 1.0; // ~132 bpm light bouncy groove

    // 1. Acoustic strum / marimba arpeggio
    let strumL = 0;
    let strumR = 0;
    const arpIdx = Math.floor(t * 4.4) % chord.freqs.length;
    const arpFreq = chord.freqs[arpIdx];
    const arpEnv = Math.exp(-((t * 4.4) % 1.0) * 4);
    const arpWave = Math.sin(2 * Math.PI * arpFreq * t) + 0.3 * Math.sin(4 * Math.PI * arpFreq * t);
    strumL += arpWave * arpEnv * 0.18;
    strumR += arpWave * arpEnv * 0.18;

    // 2. Warm playful bass
    const bassEnv = Math.exp(-beatTime * 3);
    const bassWave = Math.sin(2 * Math.PI * chord.bass * t) + 0.25 * Math.sin(4 * Math.PI * chord.bass * t);
    const bass = bassWave * bassEnv * 0.22;
    strumL += bass * 0.5;
    strumR += bass * 0.5;

    // 3. Shaker / percussion tick
    const shakerEnv = Math.exp(-((t * 4.4) % 0.5) * 20);
    const shakerNoise = (Math.random() - 0.5) * shakerEnv * 0.05;
    strumL += shakerNoise;
    strumR += shakerNoise;

    // 4. Breezy anime melody bell / music box
    let melL = 0;
    let melR = 0;
    for (const note of melodyNotes) {
      if (t >= note.t && t < note.t + note.dur) {
        const noteT = t - note.t;
        const melEnv = Math.exp(-noteT * 3.5) * (1 - Math.exp(-noteT * 60)); // Fast attack, gentle chime decay
        const chime =
          Math.sin(2 * Math.PI * note.f * t) * 0.4 +
          Math.sin(2 * Math.PI * (note.f * 2) * t) * 0.18 +
          Math.sin(2 * Math.PI * (note.f * 3) * t) * 0.06;
        melL += chime * melEnv * 0.45;
        melR += chime * melEnv * 0.45;
        break;
      }
    }

    // Master sum with gentle limiter
    let sampleL = (strumL + melL) * 0.8;
    let sampleR = (strumR + melR) * 0.8;

    // Soft master fade-in and loop fade-out to prevent clicks
    if (t < 0.2) {
      const f = t / 0.2;
      sampleL *= f;
      sampleR *= f;
    } else if (t > durationSec - 0.2) {
      const f = (durationSec - t) / 0.2;
      sampleL *= f;
      sampleR *= f;
    }

    const intL = Math.max(-32767, Math.min(32767, Math.floor(sampleL * 32767)));
    const intR = Math.max(-32767, Math.min(32767, Math.floor(sampleR * 32767)));

    buffer.writeInt16LE(intL, byteOffset);
    buffer.writeInt16LE(intR, byteOffset + 2);
    byteOffset += 4;
  }

  const outDir = path.resolve('public/audio');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Save as both .mp3 and .wav so any URL or mime reference is covered
  const outPathMp3 = path.join(outDir, 'umbrella_instrumental.mp3');
  const outPathWav = path.join(outDir, 'umbrella_instrumental.wav');
  fs.writeFileSync(outPathMp3, buffer);
  fs.writeFileSync(outPathWav, buffer);

  console.log(`Generated Umbrella Instrumental audio at: ${outPathMp3} (${buffer.length} bytes)`);
}

generateUmbrellaAudio();
