import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT, { message: `limit must be ≤ ${MAX_LIMIT}` })
  limit: number = DEFAULT_LIMIT;

  get skip() {
    return (this.page - 1) * this.limit;
  }
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function paginated<T>(data: T[], total: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    } satisfies PaginatedMeta,
  };
}
