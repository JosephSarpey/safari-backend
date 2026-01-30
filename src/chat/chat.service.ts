import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private prisma: PrismaService) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  }

  async createSession(userId?: string) {
    return this.prisma.chatSession.create({
      data: {
        userId,
        status: 'OPEN',
      },
    });
  }

  async getSession(id: string) {
    return this.prisma.chatSession.findUnique({
      where: { id },
    });
  }

  async saveMessage(chatSessionId: string, text: string, sender: string, isBot: boolean) {
    return this.prisma.message.create({
      data: {
        chatSessionId,
        text,
        sender,
        isBot,
      },
    });
  }

  async generateResponse(chatSessionId: string, userMessage: string) {
    try {
      // 1. Save user message
      await this.saveMessage(chatSessionId, userMessage, 'USER', false);

      // 2. Fetch history for context
      const history = await this.prisma.message.findMany({
        where: { chatSessionId },
        orderBy: { createdAt: 'asc' },
        take: 10, // Limit context window
      });

      // Construct history for Gemini
      // Gemini expects: { role: 'user' | 'model', parts: [{ text: string }] }
      const chatHistory = history.map((msg) => ({
        role: msg.isBot ? 'model' : 'user',
        parts: [{ text: msg.text }],
      }));

      // 3. Call Gemini
      const chat = this.model.startChat({
        history: [
            {
                role: "user",
                parts: [{ text: `You are the Senior Coffee Specialist at "Safari Roast", a premium brand for single-origin Kenyan coffee.
            
            Guidelines:
            1. **Tone**: Warm, engaging, and professional. Treat the user like a guest in our cafe.
            2. **Greetings**: If the user says "Hello", "Hi", etc., respond warmly (e.g., "Karibu! Welcome to Safari Roast. How can I brighten your day?") without immediately listing products.
            3. **Expertise**: We ONLY sell 100% Arabica beans from high-altitude Kenyan farms.
               - "Gourmet" (Medium Roast): Balanced and smooth.
               - "Artisan" (Light Roast): Bright acidity, fruity notes.
               - "Rich Brew" (Dark Roast): Bold, intense, chocolatey.
            4. **Conciseness**: Keep answers short (max 2-3 sentences) unless detailed advice is asked.
            5. **Boundaries**: If you don't know something, admit it politely. Do not invent products.
            6. **Orders**: If asked about order status, ask for the Order ID.
            7. **Coffee Education**: You should enthusiastically provide step-by-step brewing guides, preparation methods (French press, pour-over, espresso, cold brew, etc.), coffee storage tips, grind size recommendations, and any other educational content about coffee. When asked "how to prepare" or "teach me", provide clear and helpful instructions. For longer answers, use numbered steps for clarity.
            8. **Helpful Responses**: Always try to be helpful. If a user asks a coffee-related question, answer it even if it doesn't directly relate to our products. Share your coffee expertise generously to build trust with potential customers.
            9. **Contact Information**: If asked about how to contact us, where we are located, or any contact-related questions, provide these ACTUAL details:
               - **Phone**: +1 8602643330
               - **Email**: everaingroup@gmail.com, safariroastdistributors@gmail.com
               - **Address**: Safari Roast Distributors, 2389 Main Street, Ste 100, Glastonbury, CT 06033, United States
               - **Website**: safari-roast.com
               - **Contact Page**: Direct them to visit our website's contact page at safari-roast.com/contact for inquiries.
               Never make up or provide fake contact information.
            10. **FAQ Knowledge**: Use this information to answer common questions:
               - **Products**: We source 100% Arabica beans from certified organic, high-altitude Kenyan farms. Store beans in airtight containers in cool, dark places (2-4 weeks for whole beans, 1-2 weeks for ground).
               - **Shipping**: Standard shipping takes 5-7 business days, express is 2-3 days. We ship internationally (7-14 days). Customers receive tracking emails and can track orders in their account.
               - **Bulk/Wholesale**: We offer competitive wholesale pricing for cafes, restaurants, offices, and retailers. Direct them to our Bulk Purchase page or contact our B2B team.
               - **Brewing Tips**: Pour-over for clean/bright cups, French press for full-bodied. Ideal water temp: 195-205°F (90-96°C). Coffee-to-water ratio: 1:15 to 1:17 (2 tbsp per 6oz water).
               - **Grind Sizes**: Coarse for French press/cold brew, Medium for drip/pour-over, Fine for espresso/Moka pot.
               - **Account**: Users can register via email or Google. Password reset is available via 'Forgot Password' link.
               - **Returns**: 14-day return policy for unsatisfied customers - contact support for replacement or refund.
            11. **Direct to FAQ Page**: For detailed information on products, shipping, brewing, or account questions, encourage users to visit our FAQ page at safaricoffee.com/faq for comprehensive answers.` }]
            },
            {
                role: "model",
                parts: [{ text: "Understood. I am ready to assist your customers as the Safari Roast coffee specialist." }]
            },
            ...chatHistory
        ],
        generationConfig: {
          maxOutputTokens: 500,
        },
      });

      const result = await chat.sendMessage(userMessage);
      const botText = result.response.text();

      // 4. Save bot message
      const botMessage = await this.saveMessage(chatSessionId, botText, 'AGENT', true);

      return botMessage;
    } catch (error) {
      this.logger.error('Error generating response', error);
      return {
        id: 'error',
        text: "I'm having trouble connecting to the coffee spirits right now. Please try again later.",
        sender: 'AGENT',
        isBot: true,
        createdAt: new Date(),
      };
    }
  }

  /**
   * Scheduled task to clean up old chat sessions
   * Runs daily at midnight (00:00)
   * Deletes chat sessions and their messages older than 7 days
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldChatSessions() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    this.logger.log('Starting scheduled cleanup of old chat sessions...');

    try {
      
      const deletedMessages = await this.prisma.message.deleteMany({
        where: {
          chatSession: {
            createdAt: {
              lt: sevenDaysAgo,
            },
          },
        },
      });

      
      const deletedSessions = await this.prisma.chatSession.deleteMany({
        where: {
          createdAt: {
            lt: sevenDaysAgo,
          },
        },
      });

      this.logger.log(
        `Cleanup complete: Deleted ${deletedSessions.count} chat sessions and ${deletedMessages.count} messages older than 7 days.`,
      );
    } catch (error) {
      this.logger.error('Error during chat cleanup', error);
    }
  }
}
