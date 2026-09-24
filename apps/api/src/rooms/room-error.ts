export class RoomError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
