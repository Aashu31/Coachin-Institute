import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let io: SocketIOServer | null = null;
const userSockets = new Map<string, Set<string>>();

export function initializeSocketServer(httpServer: ReturnType<typeof createServer>): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      });

      if (typeof decoded === 'string') {
        return next(new Error('Invalid token payload'));
      }

      socket.data.auth = {
        userId: decoded.sub,
        instituteId: decoded.institute_id,
        role: decoded.role,
      };

      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, instituteId, role } = socket.data.auth;
    const roomName = `institute:${instituteId}`;

    socket.join(roomName);

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    logger.info('Socket connected', { socketId: socket.id, userId, instituteId, role });

    socket.on('disconnect', () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
      logger.info('Socket disconnected', { socketId: socket.id, userId });
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToInstitute(instituteId: string, event: string, data: unknown): void {
  if (!io) {
    logger.warn('Socket.io not initialized, skipping emit', { event, instituteId });
    return;
  }
  io.to(`institute:${instituteId}`).emit(event, data);
}

export function emitEscalationAlert(
  instituteId: string,
  data: {
    type: 'RED_ALERT';
    taskId: string;
    studentId: string;
    batchId: string;
    parentWhatsapp: string;
    triggeredAt: string;
  },
): void {
  emitToInstitute(instituteId, 'escalation:new_alert', data);
}

export function emitAttendanceStatusUpdate(
  instituteId: string,
  data: {
    type: 'ATTENDANCE_STATUS_UPDATED';
    logId: string;
    studentId: string;
    batchId: string;
    previousStatus: string;
    newStatus: string;
    updatedAt: string;
  },
): void {
  emitToInstitute(instituteId, 'attendance:status_updated', data);
}

export function getConnectedUsersCount(instituteId: string): number {
  if (!io) return 0;
  const room = io.sockets.adapter.rooms.get(`institute:${instituteId}`);
  return room?.size ?? 0;
}