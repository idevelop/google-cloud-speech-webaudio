const { textToSpeech } = require('./rest-api');

class GoogleSpeechSynthesis {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async speak(text, languageCode = 'en-US') {
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
    }

    const audioBuffer = await textToSpeech(text, languageCode, this.apiKey);

    this.audioContext.decodeAudioData(audioBuffer, buffer => {
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start();
    });
  }
}

module.exports = GoogleSpeechSynthesis;
