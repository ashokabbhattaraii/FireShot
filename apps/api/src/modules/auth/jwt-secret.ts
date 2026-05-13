export function jwtSecret() {
  return process.env.JWT_SECRET ?? "dev-secret";
}
