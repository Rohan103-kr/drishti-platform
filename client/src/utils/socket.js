import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket'],
  upgrade: false,
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

export function joinRoom(roomName) {
  if (socket.connected) {
    socket.emit('join_room', roomName);
  } else {
    socket.once('connect', () => {
      socket.emit('join_room', roomName);
    });
  }
}

export function leaveRoom(roomName) {
  if (socket.connected) {
    socket.emit('leave_room', roomName);
  }
}

