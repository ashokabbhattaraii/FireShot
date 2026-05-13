import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { GameMode, TournamentStatus, TournamentType } from "@fireslot/db";

export class CreateTournamentDto {
  @IsString() @MinLength(3) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum([
    "BR_SOLO",
    "BR_DUO",
    "BR_SQUAD",
    "CS_4V4",
    "LW_1V1",
    "LW_2V2",
    "CRAFTLAND",
  ])
  mode!: GameMode;
  @IsOptional() @IsString() map?: string;
  @IsOptional()
  @IsEnum([
    "FREE_DAILY",
    "SOLO_1ST",
    "SOLO_TOP3",
    "SQUAD_TOP10",
    "KILL_RACE",
    "COMBO",
  ])
  type?: TournamentType;
  @IsInt() @Min(0) entryFeeNpr!: number;
  @IsOptional() @IsInt() @Min(10) registrationFeeNpr?: number;
  @IsInt() @Min(0) prizePoolNpr!: number;
  @IsOptional() @IsInt() @Min(0) perKillPrizeNpr?: number;
  @IsOptional() @IsInt() @Min(0) firstPrize?: number;
  @IsOptional() @IsInt() @Min(0) secondPrize?: number;
  @IsOptional() @IsInt() @Min(0) thirdPrize?: number;
  @IsOptional() @IsInt() @Min(0) fourthToTenthPrize?: number;
  @IsInt() @Min(2) maxSlots!: number;
  @IsOptional() @IsInt() @Min(1) maxTeams?: number;
  @IsDateString() dateTime!: string;
  @IsOptional() @IsString() rules?: string;
  @IsOptional() @IsString() roomId?: string;
  @IsOptional() @IsString() roomPassword?: string;
  @IsOptional() @IsInt() @Min(1) minLevel?: number;
  @IsOptional() @IsNumber() maxHeadshotRate?: number;
  @IsOptional() @IsBoolean() allowEmulator?: boolean;
  @IsOptional() @IsArray() bannedGuns?: string[];
  @IsOptional() @IsBoolean() characterSkillOn?: boolean;
  @IsOptional() @IsBoolean() gunAttributesOn?: boolean;
}

export class UpdateTournamentStatusDto {
  @IsEnum(["UPCOMING", "LIVE", "COMPLETED", "CANCELLED"])
  status!: TournamentStatus;
}

export class PublishRoomDto {
  @IsString() roomId!: string;
  @IsString() roomPassword!: string;
}

export class TeammateDto {
  @IsString() freefireUid!: string;
  @IsString() igName!: string;
}

export class JoinTournamentDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  playerUids?: string[];

  @IsOptional()
  @IsArray()
  teammates?: TeammateDto[];
}
