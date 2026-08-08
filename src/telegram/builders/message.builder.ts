export class MessageBuilder {
  /**
   * Escapes special characters for Telegram's MarkdownV2 formatting.
   * Characters to escape: \ _ * [ ] ( ) ~ ` > # + - = | { } . !
   */
  static escapeMarkdownV2(text: string): string {
    return text.replace(/([\\_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  /**
   * Escapes special characters for HTML parsing.
   */
  static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Splits a long message into multiple chunks of maximum size (default 4096 characters),
   * ensuring that lines are not broken in half unless a single line exceeds the limit.
   */
  static splitMessage(text: string, maxLength = 4096): string[] {
    if (text.length <= maxLength) {
      return [text];
    }
    
    const chunks: string[] = [];
    let currentChunk = '';
    const lines = text.split('\n');

    for (const line of lines) {
      // +1 accounts for the newline separator we'll add back
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (line.length > maxLength) {
          // If a single line is too long, we flush what we have, then hard split the line
          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = '';
          }
          
          let index = 0;
          while (index < line.length) {
            chunks.push(line.substring(index, index + maxLength));
            index += maxLength;
          }
        } else {
          chunks.push(currentChunk);
          currentChunk = line;
        }
      } else {
        if (currentChunk) {
          currentChunk += '\n' + line;
        } else {
          currentChunk = line;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Helper to format photos with optional captions and parse modes.
   */
  static photo(urlOrFileId: string, caption?: string, parseMode: 'MarkdownV2' | 'HTML' = 'HTML') {
    return {
      photo: urlOrFileId,
      options: {
        caption,
        parse_mode: parseMode,
      },
    };
  }

  /**
   * Helper to format documents.
   */
  static document(urlOrFileId: string, filename?: string, caption?: string) {
    return {
      document: urlOrFileId,
      options: {
        filename,
        caption,
      },
    };
  }
}
