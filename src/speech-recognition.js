const { speechToText } = require('./rest-api');

const BUFFER_SIZE = 4096;

// by default, browsers will create a 48000 sample rate audio context,
// which leads to an HTTP request size of ~1.3 MB for 10 seconds of audio.
// setting the sample rate to 16000 lowers it to a more reasonable 420 KB.
// the size could be further reduced through client-size gzip, TBD if it's worth it.
const SAMPLE_RATE = 16000;

const float32ToInt16 = f => {
  const multiplier = f < 0 ? 0x8000 : 0x7fff; // 16-bit signed range is -32768 to 32767
  return f * multiplier;
};

const combineBuffers = (a, b) => {
  const result = new Uint8Array(a.byteLength + b.byteLength);
  result.set(new Uint8Array(a), 0);
  result.set(new Uint8Array(b), a.byteLength);
  return result;
};

class GoogleSpeechRecognition {
  constructor(apiKey, regionalEndpoint = 'https://speech.googleapis.com') {
    this.apiKey = apiKey;
    this.regionalEndpoint = regionalEndpoint;
    this.tempBuffer = new ArrayBuffer(BUFFER_SIZE * 2);
    this.tempBufferView = new Uint16Array(this.tempBuffer);
  }

  async connectMicrophoneAndProcessor() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        advanced: [
          {
            channelCount: 1,
            sampleRate: SAMPLE_RATE,
          },
        ],
      },
    });

    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!this.audioContext) {
      this.audioContext = new AudioContext({
        sampleRate: SAMPLE_RATE,
      });
    }

    try {
      this.microphone = this.audioContext.createMediaStreamSource(stream);
    } catch (e) {
      // Firefox will throw MediaStreamAudioSourceNodeDifferentRate when attempting
      // to connect a microphone stream with a sample rate of 48k to an audio context
      // with a sample rate of 16k. if that happens, recreate the audio context without
      // an explicit sample rate.
      this.audioContext = new AudioContext();
      this.microphone = this.audioContext.createMediaStreamSource(stream);
    }

    if (!this.processor) {
      this.processor = this.audioContext.createScriptProcessor(
        BUFFER_SIZE,
        1,
        1
      );
      this.processor.onaudioprocess = e => {
        const input = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < input.length; i++) {
          this.tempBufferView[i] = float32ToInt16(input[i]);
        }

        this.outputBuffer = combineBuffers(this.outputBuffer, this.tempBuffer);
      };
    }

    this.microphone.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  disconnectMicrophoneAndProcessor() {
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone.mediaStream.getTracks().forEach(track => track.stop());
      this.microphone = null;
    }

    if (this.processor) {
      this.processor.disconnect();
    }
  }

  async startListening() {
    if (this.starting) {
      // already starting
      return;
    }

    this.starting = true;
    this.outputBuffer = new ArrayBuffer(0);

    await this.connectMicrophoneAndProcessor();

    if (this.cancelStart) {
      this.disconnectMicrophoneAndProcessor();
      this.cancelStart = false;
    }

    this.starting = false;
  }

  async stopListening(languageCode = 'en-US') {
    if (this.starting) {
      // use "cancelStart" flag to resolve race condition between start and stop
      this.cancelStart = true;
    }

    this.disconnectMicrophoneAndProcessor();

    if (this.outputBuffer && this.outputBuffer.length > 0) {
      const apiResult = await speechToText(
        this.outputBuffer,
        this.audioContext.sampleRate,
        languageCode,
        this.apiKey,
        this.regionalEndpoint
      );
      this.outputBuffer = new ArrayBuffer(0);
      return apiResult;
    }
  }
}

module.exports = GoogleSpeechRecognition;
