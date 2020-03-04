const base64 = require('base64-js');

async function speechToText(audioBuffer, sampleRate, apiKey) {
  // https://cloud.google.com/speech-to-text/docs/reference/rest/v1/speech/recognize

  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: sampleRate,
          languageCode: 'en-US',
        },
        audio: {
          content: base64.fromByteArray(audioBuffer),
        },
      }),
    }
  );

  const result = await response.json();

  if (result.error) {
    throw result.error.message;
  } else {
    return result;
  }
}

async function textToSpeech(text, apiKey) {
  // https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          text,
        },
        voice: {
          languageCode: 'en-US',
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
        },
      }),
    }
  );

  const result = await response.json();

  if (result.error) {
    throw result.error.message;
  } else {
    return base64.toByteArray(result.audioContent).buffer;
  }
}

module.exports = { speechToText, textToSpeech };
