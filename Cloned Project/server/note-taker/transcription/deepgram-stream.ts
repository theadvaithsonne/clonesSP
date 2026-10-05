import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { env } from '../../config/env';

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  start: number;      // seconds from stream start
  duration: number;    // seconds
  words?: { word: string; start: number; end: number; confidence: number }[];
}

export type OnTranscriptCallback = (result: TranscriptionResult) => void;

/**
 * Wraps a Deepgram live transcription WebSocket for a single participant.
 * Feed PCM audio frames and receive transcription results via callback.
 */
export class DeepgramStream {
  private connection: any;  // Deepgram live connection
  private participantIdentity: string;
  private onTranscript: OnTranscriptCallback;
  private closed = false;
  private streamStartTime: number;

  constructor(participantIdentity: string, onTranscript: OnTranscriptCallback, language = 'en') {
    this.participantIdentity = participantIdentity;
    this.onTranscript = onTranscript;
    this.streamStartTime = Date.now();

    const deepgram = createClient(env.DEEPGRAM_API_KEY);

    this.connection = deepgram.listen.live({
      model: 'nova-2',
      language,
      // smart_format: punctuation, capitalization, formatted numbers/dates.
      smart_format: true,
      punctuate: true,
      // filler_words=false: strip "uh"/"um"/"mhmm" at the STT boundary so
      // the transcript (and downstream summary input) doesn't carry filler
      // as content. Deepgram's default is false, but we set it explicitly
      // to document the intent and guard against any SDK default shift.
      filler_words: false,
      // Numerics as digits ("seven" -> "7") keeps output tighter for the
      // summarizer and reads better in the transcript UI too.
      numerals: true,
      // We don't need profanity masking; allow clean text passthrough.
      profanity_filter: false,
      interim_results: true,
      utterance_end_ms: 1500,
      vad_events: false,
      encoding: 'linear16',
      sample_rate: 48000,    // LiveKit default sample rate
      channels: 1,
    });

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      console.log(`[DeepgramStream] Opened for participant: ${this.participantIdentity}`);
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const transcript = data.channel?.alternatives?.[0];
      if (!transcript?.transcript) return;

      const result: TranscriptionResult = {
        text: transcript.transcript,
        isFinal: data.is_final === true,
        confidence: transcript.confidence || 0,
        start: data.start || 0,
        duration: data.duration || 0,
        words: transcript.words?.map((w: any) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence,
        })),
      };

      this.onTranscript(result);
    });

    this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
      // The SDK hands us a DOM-style ErrorEvent wrapping the whole socket.
      // Logging it raw dumps ~150 lines per failure — including the request
      // headers, which carry the Deepgram API key in plaintext. Pull out the
      // one thing worth knowing instead.
      // ws stashes the useful text on non-registered symbols (kMessage /
      // kError), so they can't be reached by name — enumerate instead.
      let reason: string | undefined =
        error?.error?.message || error?.message || error?.reason;
      if (!reason && error && typeof error === "object") {
        for (const sym of Object.getOwnPropertySymbols(error)) {
          const v: any = (error as any)[sym];
          const desc = sym.description || "";
          if (typeof v === "string" && /Message/i.test(desc)) {
            reason = v;
            break;
          }
          if (v instanceof Error && /Error/i.test(desc)) {
            reason = v.message;
            break;
          }
        }
      }
      console.error(
        `[DeepgramStream] Error for ${this.participantIdentity}: ${reason || "unknown error"}`,
      );
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      console.log(`[DeepgramStream] Closed for participant: ${this.participantIdentity}`);
      this.closed = true;
    });
  }

  /**
   * Send raw PCM audio data to Deepgram.
   * Expects Int16Array (linear16) at the configured sample rate.
   */
  send(audioData: Int16Array | Buffer): void {
    if (this.closed) return;

    try {
      // Deepgram expects raw bytes
      const buffer = audioData instanceof Int16Array
        ? Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength)
        : audioData;
      this.connection.send(buffer);
    } catch (error) {
      // Connection may have closed
      if (!this.closed) {
        console.warn(`[DeepgramStream] Send error for ${this.participantIdentity}:`, error);
      }
    }
  }

  /** Close the Deepgram connection. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.connection.requestClose();
    } catch {
      // Already closed
    }
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
