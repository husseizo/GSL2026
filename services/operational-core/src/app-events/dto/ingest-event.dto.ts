import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class IngestAppEventDto {
  @IsString()
  sourceEventId!: string;

  // Deliberately @IsString(), not @IsEnum/@IsISO8601: an unknown eventType or
  // unparseable occurredAt must reach AppEventsService and be routed to the
  // dead-letter store per record, not fail the whole batch at the framework
  // validation layer before the service ever sees it. See
  // docs/architecture/log-event-schema.md.
  @IsString()
  eventType!: string;

  @IsString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  userExternalId?: string;

  @IsOptional()
  @IsString()
  customerExternalId?: string;

  @IsOptional()
  @IsString()
  branchCode?: string;

  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @IsOptional()
  @IsString()
  searchQuery?: string;

  @IsOptional()
  @IsString()
  itemCode?: string;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsInt()
  durationMs?: number;

  @IsOptional()
  @IsInt()
  statusCode?: number;

  @IsOptional()
  @IsString()
  errorCode?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class IngestEventBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => IngestAppEventDto)
  events!: IngestAppEventDto[];
}
