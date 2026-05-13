export const Errors = {
  BANNED: "Your account is suspended. Contact support.",
  NO_PROFILE: "Complete your Free Fire profile first.",
  TOURNAMENT_FULL: "This tournament is full.",
  ALREADY_JOINED: "You have already joined this tournament.",
  PAYMENT_PENDING: "Your payment is already under review.",
  NOT_UPCOMING: "This tournament is no longer accepting registrations.",
  SAME_UID: "Teammate UID cannot be the same as yours.",
  DUPLICATE_UID: "Your team has duplicate Free Fire UIDs.",
  INVALID_UID: "Free Fire UID must be 9–12 digits only.",
  INSUFFICIENT_BALANCE: (shortfall: number) =>
    `Insufficient balance. Deposit Rs ${shortfall} more to join.`,
  ALREADY_STARTED: "Registration is closed — this match has already started.",
  FREE_DAILY_USED: (time: string) =>
    `Free match already used today. Next available at ${time}.`,
};
