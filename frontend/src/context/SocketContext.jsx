import React, { createContext, useEffect, useState } from "react";
import { initializeSocket, disconnectSocket } from "../services/chat.services";
import useUserStore from "../store/useUserStore";

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const user = useUserStore((state) => state.user);

  useEffect(() => {
    if (user?._id) {
      const socketClient = initializeSocket(user);
      setSocket(socketClient);

      const handleConnect = () => setIsConnected(true);
      const handleDisconnect = () => setIsConnected(false);

      socketClient.on("connect", handleConnect);
      socketClient.on("disconnect", handleDisconnect);

      if (socketClient.connected) {
        setIsConnected(true);
      }

      return () => {
        socketClient.off("connect", handleConnect);
        socketClient.off("disconnect", handleDisconnect);
      };
    } else {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
