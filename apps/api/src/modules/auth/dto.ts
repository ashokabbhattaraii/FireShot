import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @MinLength(6) password!: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @MinLength(6) password!: string;
}

export class GoogleLoginDto {
  @IsOptional() @IsString() credential?: string;   // ID token from iframe button (web)
  @IsOptional() @IsString() accessToken?: string;  // access_token from popup flow (APK/WebView)
  @IsOptional() @IsString() referralCode?: string;
}
