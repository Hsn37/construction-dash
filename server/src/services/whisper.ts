import OpenAI from "openai";
import config from "../config.js";

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

/**
 * Transcribe an audio buffer using OpenAI's Whisper API.
 * @param audioBuffer - Raw audio file contents
 * @param mimetype - MIME type of the audio (e.g., "audio/webm", "audio/mp4")
 * @returns Transcribed text
 */
export async function transcribe(
  audioBuffer: Buffer,
  mimetype: string,
): Promise<string> {
  // Derive a file extension from the mimetype
  const extMap: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
  };

  const ext = extMap[mimetype] || "webm";
  const file = new File(
    [new Uint8Array(audioBuffer)],
    `audio.${ext}`,
    { type: mimetype },
  );

  const response = await openai.audio.translations.create({
    model: "whisper-1",
    file,
    prompt: "Construction expenses: cement, bajri, steel, labour, plumber, electrician, paint, tiles, sand, reti, saria, mistri.",
  });

  return response.text;
}
