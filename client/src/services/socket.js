import { io } from 'socket.io-client';
import { create } from 'zustand';

let socket = null;

export const useSocketStore = create((set) => ({
  socket: null,
  isConnected: false,
  setSocket: (s) => set({ socket: s, isConnected: !!s?.connected }),
  setIsConnected: (isConnected) => set({ isConnected })
}));

export const connectSocket = (token) => {
  if (socket) {
    if (socket.connected) {
      useSocketStore.getState().setSocket(socket);
      return socket;
    }
    socket.connect();
    useSocketStore.getState().setSocket(socket);
    return socket;
  }

  const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

  socket = io(socketUrl, {
    auth: { token },
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  });

  socket.on('connect', () => {
    useSocketStore.getState().setIsConnected(true);
  });

  socket.on('disconnect', () => {
    useSocketStore.getState().setIsConnected(false);
  });

  useSocketStore.getState().setSocket(socket);

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    // If socket not initialized yet, retrieve from store
    return useSocketStore.getState().socket;
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    useSocketStore.getState().setSocket(null);
  }
};
