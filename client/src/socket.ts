import { io } from "socket.io-client";
import { API_URL } from "./axios";

// The API lives on its own origin (Render) in every environment, so the socket
// always connects there rather than to the page's own address.
export const socket = io(API_URL);
