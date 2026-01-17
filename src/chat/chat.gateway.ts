import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow all for dev, restrict in prod
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { userId?: string; sessionId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    let sessionId = data.sessionId;
    
    // Validate provided session ID
    if (sessionId) {
      const existingSession = await this.chatService.getSession(sessionId);
      if (!existingSession) {
        sessionId = undefined;
      }
    }

    // Create new session if none provided or provided one is invalid
    if (!sessionId) {
      const session = await this.chatService.createSession(data.userId);
      sessionId = session.id;
    }
    client.join(sessionId);
    client.emit('sessionJoined', { sessionId });
    return { event: 'joined', sessionId };
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: { sessionId: string; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Emit 'typing' to room
    client.broadcast.to(data.sessionId).emit('agentTyping', true);

    const response = await this.chatService.generateResponse(data.sessionId, data.text);

    // Emit response
    this.server.to(data.sessionId).emit('receiveMessage', response);
    this.server.to(data.sessionId).emit('agentTyping', false);
  }
}
