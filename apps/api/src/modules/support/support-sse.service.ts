import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";
import { filter } from "rxjs/operators";

export interface TicketMessageEvent {
  ticketId: string;
  id: string;
  senderId: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

@Injectable()
export class SupportSseService {
  private messages$ = new Subject<TicketMessageEvent>();

  emit(event: TicketMessageEvent) {
    this.messages$.next(event);
  }

  stream(ticketId: string) {
    return this.messages$.pipe(filter((e) => e.ticketId === ticketId));
  }
}
