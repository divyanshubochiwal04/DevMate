import { TelegramContext } from '../interfaces/telegram-context.interface';

export type WizardStepHandler = (ctx: TelegramContext) => Promise<any> | any;

export class TelegramWizard {
  private readonly steps: WizardStepHandler[] = [];

  constructor(private readonly handlerId: string) {}

  step(handler: WizardStepHandler): this {
    this.steps.push(handler);
    return this;
  }

  async handle(ctx: TelegramContext): Promise<void> {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;

    if (!userId || !chatId) {
      return;
    }

    let currentStep = ctx.conversation?.step ?? 0;

    if (currentStep < 0 || currentStep >= this.steps.length) {
      currentStep = 0;
    }

    const handler = this.steps[currentStep];
    const result = await handler(ctx);

    if (result === 'complete' || result === null) {
      if (ctx.state?.conversationService) {
        await ctx.state.conversationService.clearConversationState(BigInt(userId), BigInt(chatId));
      }
      ctx.conversation = undefined;
    } else if (typeof result === 'number') {
      if (ctx.conversation) {
        ctx.conversation.step = result;
        ctx.conversation.handlerId = this.handlerId;
      }
    } else if (result === 'next' || result === undefined) {
      if (ctx.conversation) {
        ctx.conversation.step = currentStep + 1;
        ctx.conversation.handlerId = this.handlerId;
        
        if (ctx.conversation.step >= this.steps.length) {
          if (ctx.state?.conversationService) {
            await ctx.state.conversationService.clearConversationState(BigInt(userId), BigInt(chatId));
          }
          ctx.conversation = undefined;
        }
      } else {
        const newState = {
          userId: BigInt(userId),
          chatId: BigInt(chatId),
          currentState: 'WIZARD',
          handlerId: this.handlerId,
          step: 1,
          stateData: {},
          stackData: [],
        };
        ctx.conversation = newState;
        if (ctx.state?.conversationService) {
          await ctx.state.conversationService.setConversationState(BigInt(userId), BigInt(chatId), newState);
        }
      }
    }
  }

  getHandlerId(): string {
    return this.handlerId;
  }
}
