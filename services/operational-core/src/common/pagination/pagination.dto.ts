import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 25;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Shared skip/take + wrapper used by every Phase 2 list endpoint so pagination
// behaves identically everywhere instead of being reimplemented per module.
export function toSkipTake(query: PaginationQueryDto): { skip: number; take: number } {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginate<T>(data: T[], total: number, query: PaginationQueryDto): PaginatedResult<T> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 0 };
}
