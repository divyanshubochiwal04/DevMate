export interface ITelegramGateway {
  sendMessage(chatId: string | number, text: string, options?: any): Promise<any>;
  editMessageText(chatId: string | number, messageId: number, text: string, options?: any): Promise<any>;
  deleteMessage(chatId: string | number, messageId: number): Promise<boolean>;
  answerCallbackQuery(callbackQueryId: string, text?: string, options?: any): Promise<boolean>;
  sendPhoto(chatId: string | number, photo: any, options?: any): Promise<any>;
  sendDocument(chatId: string | number, document: any, options?: any): Promise<any>;
  sendMediaGroup(chatId: string | number, media: any[], options?: any): Promise<any[]>;
}

export const ITelegramGateway = Symbol('ITelegramGateway');
