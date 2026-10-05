/**
 * Generates a prompt for analyzing files based on file type
 */
export function generateAskCabinetPrompt(fileName: string, mimeType?: string): string {
  // Detect file type from extension or mime type
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const isVideo = mimeType?.startsWith('video/') || ['webm', 'mp4', 'mov', 'avi', 'mkv'].includes(extension);
  const isPDF = mimeType === 'application/pdf' || extension === 'pdf';
  const isAudio = mimeType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(extension);
  
  let fileFormat = 'screen recording';
  if (isVideo) {
    fileFormat = 'screen recording';
  } else if (isPDF) {
    fileFormat = 'PDF document';
  } else if (isAudio) {
    fileFormat = 'audio recording';
  } else {
    fileFormat = `file (${extension || 'unknown format'})`;
  }
  
  return `Please review the attached ${fileFormat} of the user's work session. Provide a concise analysis in bullet points:

• **Tasks Completed:** List key tasks the user performed
• **Efficiency Improvements:** Suggest 2-3 ways the work could have been done more efficiently
• **AI Tools:** List 3-5 specific AI tools that would help, with:
  - Brief explanation of how each tool should be used
  - Link where each tool can be accessed (format as **Link:** [URL])

Keep the response concise and formatted in clear bullet points.`;
}

/**
 * Gets file format description from file name or mime type
 */
export function getFileFormatDescription(fileName: string, mimeType?: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const isVideo = mimeType?.startsWith('video/') || ['webm', 'mp4', 'mov', 'avi', 'mkv'].includes(extension);
  const isPDF = mimeType === 'application/pdf' || extension === 'pdf';
  const isAudio = mimeType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(extension);
  
  if (isVideo) return 'screen recording';
  if (isPDF) return 'PDF document';
  if (isAudio) return 'audio recording';
  return `file (${extension || 'unknown'})`;
}

