import { io } from "socket.io-client";

// `undefined` lets socket.io derive the URL from `window.location`, which is
// what we want once the app and the API are served from one origin. In dev the
// API is on its own port.
const URL = import.meta.env.PROD ? undefined : "http://localhost:3000";

export const socket = io(URL);
