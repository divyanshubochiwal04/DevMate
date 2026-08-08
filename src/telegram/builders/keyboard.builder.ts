export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export class InlineKeyboardBuilder {
  private readonly keyboard: InlineButton[][] = [[]];

  text(text: string, callbackData: string): this {
    const currentRow = this.keyboard[this.keyboard.length - 1];
    currentRow.push({ text, callback_data: callbackData });
    return this;
  }

  url(text: string, url: string): this {
    const currentRow = this.keyboard[this.keyboard.length - 1];
    currentRow.push({ text, url });
    return this;
  }

  row(): this {
    this.keyboard.push([]);
    return this;
  }

  back(callbackData: string = 'back'): this {
    return this.text('◀️ Back', callbackData);
  }

  cancel(callbackData: string = 'cancel'): this {
    return this.text('❌ Cancel', callbackData);
  }

  build() {
    const inline_keyboard = this.keyboard.filter(row => row.length > 0);
    return { reply_markup: { inline_keyboard } };
  }

  static confirmation(
    yesCallbackData: string,
    noCallbackData: string,
    yesLabel = '✅ Yes',
    noLabel = '❌ No'
  ) {
    return new InlineKeyboardBuilder()
      .text(yesLabel, yesCallbackData)
      .text(noLabel, noCallbackData)
      .build();
  }

  static pagination(currentPage: number, totalPages: number, callbackPrefix: string) {
    const builder = new InlineKeyboardBuilder();
    
    if (currentPage > 1) {
      builder.text('◀️ Prev', `${callbackPrefix}:page:${currentPage - 1}`);
    }
    
    builder.text(`Page ${currentPage}/${totalPages}`, `${callbackPrefix}:noop`);
    
    if (currentPage < totalPages) {
      builder.text('Next ▶️', `${callbackPrefix}:page:${currentPage + 1}`);
    }
    
    return builder.build();
  }
}

export interface ReplyButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
}

export class ReplyKeyboardBuilder {
  private readonly keyboard: ReplyButton[][] = [[]];
  private resizeKeyboard = true;
  private oneTimeKeyboard = false;

  text(text: string): this {
    const currentRow = this.keyboard[this.keyboard.length - 1];
    currentRow.push({ text });
    return this;
  }

  requestContact(text: string): this {
    const currentRow = this.keyboard[this.keyboard.length - 1];
    currentRow.push({ text, request_contact: true });
    return this;
  }

  requestLocation(text: string): this {
    const currentRow = this.keyboard[this.keyboard.length - 1];
    currentRow.push({ text, request_location: true });
    return this;
  }

  row(): this {
    this.keyboard.push([]);
    return this;
  }

  resize(resize = true): this {
    this.resizeKeyboard = resize;
    return this;
  }

  oneTime(oneTime = true): this {
    this.oneTimeKeyboard = oneTime;
    return this;
  }

  build() {
    const keyboard = this.keyboard.filter(row => row.length > 0);
    return {
      reply_markup: {
        keyboard,
        resize_keyboard: this.resizeKeyboard,
        one_time_keyboard: this.oneTimeKeyboard,
      }
    };
  }
}
