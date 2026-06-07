# TODO

- [ ] Block tournament creation `dateTime` from selecting older than now/today (client-side `min` on datetime-local)
- [ ] Enforce same rule server-side in `TournamentsService.create()` with `BadRequestException`
- [ ] Run repo lint/typecheck/build (if available)
- [ ] Manual test: UI past date cannot be selected; API rejects past date
