/** Safe subset attached to `req.user` (JWT / API key / OAuth). */
export interface AuthUserPayload {
  id: string;
  email: string;
  role: string;
}
