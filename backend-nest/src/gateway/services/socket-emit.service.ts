import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { butcherUserRoom } from '../../redis/redis-key';

@Injectable()
export class SocketEmitService {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  getServer(): Server | null {
    return this.server;
  }

  private userRoom(userId: string): string {
    return butcherUserRoom(userId);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server?.to(this.userRoom(userId)).emit(event, data);
  }

  emitToThread(threadId: string, event: string, data: unknown): void {
    this.server?.to(`thread:${threadId}`).emit(event, data);
  }

  emitToStream(streamId: string, event: string, data: unknown): void {
    this.server?.to(`stream:${streamId}`).emit(event, data);
  }

  emitToTicket(ticketId: string, event: string, data: unknown): void {
    this.server?.to(`support:${ticketId}`).emit(event, data);
  }

  async disconnectUserSockets(userId: string): Promise<void> {
    if (!this.server) return;
    try {
      const room = this.userRoom(userId);
      const sockets = await this.server.in(room).fetchSockets();
      for (const socket of sockets) {
        socket.disconnect(true);
      }
    } catch {
      /* non-critical */
    }
  }
}
