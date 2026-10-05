import { TranscriptSegment } from '../types';
import { TranscriptionResult } from './deepgram-stream';

/**
 * Accumulates transcript segments from multiple participants.
 * Only stores finalized (is_final) results.
 * Maps participant identities to display names.
 */
export class SegmentAccumulator {
  private segments: TranscriptSegment[] = [];
  private speakerNames: Map<string, string> = new Map();
  private meetingStartTime: number;

  constructor(meetingStartTime?: number) {
    this.meetingStartTime = meetingStartTime || Date.now();
  }

  /** Register a speaker's display name. */
  setSpeakerName(identity: string, name: string): void {
    this.speakerNames.set(identity, name);
  }

  /** Get display name for a speaker. */
  getSpeakerName(identity: string): string {
    return this.speakerNames.get(identity) || identity;
  }

  /**
   * Add a transcription result from a participant.
   * Only stores finalized results.
   */
  addResult(participantIdentity: string, result: TranscriptionResult): void {
    if (!result.isFinal || !result.text.trim()) return;

    const segment: TranscriptSegment = {
      speaker: participantIdentity,
      speakerName: this.getSpeakerName(participantIdentity),
      startTime: result.start,
      endTime: result.start + result.duration,
      text: result.text.trim(),
      confidence: result.confidence,
    };

    this.segments.push(segment);
  }

  /** Get all accumulated segments, sorted by start time. */
  getSegments(): TranscriptSegment[] {
    return [...this.segments].sort((a, b) => a.startTime - b.startTime);
  }

  /** Get the full text of all segments joined together. */
  getFullText(): string {
    return this.getSegments()
      .map((s) => `${s.speakerName || s.speaker}: ${s.text}`)
      .join('\n');
  }

  /** Get the number of unique speakers. */
  getSpeakerCount(): number {
    const speakers = new Set(this.segments.map((s) => s.speaker));
    return speakers.size;
  }

  /** Get total word count. */
  getWordCount(): number {
    return this.segments.reduce((count, s) => count + s.text.split(/\s+/).length, 0);
  }

  /** Clear all accumulated segments. */
  clear(): void {
    this.segments = [];
  }
}
