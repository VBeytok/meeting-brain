// Base URL of @meeting-brain/api. Only server code (Server Actions, Server
// Components) calls it, so the API needs no CORS setup.
export const API_URL = process.env.API_URL ?? 'http://localhost:3001';
