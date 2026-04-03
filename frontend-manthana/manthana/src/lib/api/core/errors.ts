/**
 * API Error class — shared across all section clients.
 * Used for consistent error handling and user-facing messages.
 */

export class ApiError extends Error {
  status: number;
  service: string;

  constructor(message: string, status: number = 0, service: string = "unknown") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.service = service;
  }
}
