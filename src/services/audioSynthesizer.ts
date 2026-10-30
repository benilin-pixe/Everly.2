/**
 * Synthesizes short, soothing romantic lofi ambient loops using the browser Web Audio API
 * and converts them to standard WAV Blobs so the HTML5 Audio element and visualizers
 * can play and seek seamlessly without any external network dependency.
 */

function writeWavHeader(dataLength: number, sampleRate: number, numChannels: number = 2): ArrayBuffer {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // "RIFF" chunk descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataLength, true); // File size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt " sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16-bit)

  // "data" sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataLength, true); // Subchunk2Size

  return buffer;
}

export function generateLofiWavBlob(
  mood: 'piano' | 'ambient' | 'sunset',
  durationSec: number = 18
): Blob {
  const sampleRate = 22050; // Clean, lightweight 22kHz
  const totalSamples = Math.floor(sampleRate * durationSec);
  const numChannels = 2;
  const pcmBytes = totalSamples * numChannels * 2;
  const pcmBuffer = new Int16Array(totalSamples * numChannels);

  // Chord progression frequencies (Hz) for romantic / nostalgic chords
  // Major 7th & Minor 9th chords
  const chords = mood === 'piano'
    ? [
        [261.63, 329.63, 392.00, 493.88], // Cmaj7
        [220.00, 261.63, 329.63, 392.00], // Am7
        [174.61, 220.00, 261.63, 329.63], // Fmaj7
        [196.00, 246.94, 293.66, 392.00], // G7sus4
      ]
    : mood === 'sunset'
    ? [
        [293.66, 369.99, 440.00, 554.37], // Dmaj7
        [246.94, 293.66, 369.99, 440.00], // Bm7
        [196.00, 246.94, 293.66, 369.99], // Gmaj7
        [220.00, 277.18, 329.63, 440.00], // A7
      ]
    : [
        [220.00, 277.18, 329.63, 415.30], // Amaj7
        [164.81, 207.65, 246.94, 329.63], // Emaj
        [185.00, 220.00, 277.18, 329.63], // F#m7
        [146.83, 185.00, 220.00, 277.18], // Dmaj7
      ];

  const chordDuration = durationSec / chords.length;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.min(Math.floor(t / chordDuration), chords.length - 1);
    const chord = chords[chordIndex];
    const chordT = (t % chordDuration) / chordDuration;

    // Soft envelope with slow attack and gentle decay
    const envelope = Math.sin(chordT * Math.PI) * 0.7;

    let sampleL = 0;
    let sampleR = 0;

    chord.forEach((freq, idx) => {
      // Warm detuned sine waves with slight harmonic shimmer
      const pan = (idx / (chord.length - 1)) * 0.4 - 0.2; // Stereo width
      const wave =
        Math.sin(2 * Math.PI * freq * t) * 0.35 +
        Math.sin(2 * Math.PI * (freq * 1.002) * t) * 0.2 +
        Math.sin(2 * Math.PI * (freq * 2) * t) * 0.08;

      sampleL += wave * (0.5 - pan);
      sampleR += wave * (0.5 + pan);
    });

    // Subtle vinyl crackle / tape warmth
    const vinyl = (Math.random() - 0.5) * 0.015;
    sampleL += vinyl;
    sampleR += vinyl;

    // Scale to 16-bit integer
    const finalL = Math.max(-1, Math.min(1, sampleL * envelope * 0.5)) * 32767;
    const finalR = Math.max(-1, Math.min(1, sampleR * envelope * 0.5)) * 32767;

    pcmBuffer[i * 2] = finalL;
    pcmBuffer[i * 2 + 1] = finalR;
  }

  const header = writeWavHeader(pcmBytes, sampleRate, numChannels);
  return new Blob([header, pcmBuffer.buffer], { type: 'audio/wav' });
}
