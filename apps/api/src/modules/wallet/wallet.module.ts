import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { AdminModule } from '../admin/admin.module';

@Module({ imports: [AdminModule], controllers: [WalletController], providers: [WalletService] })
export class WalletModule {}
