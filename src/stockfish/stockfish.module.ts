import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { StockfishService } from './services/stockfish.service';

@Module({
  imports: [HttpModule],
  providers: [StockfishService],
  exports: [StockfishService],
})
export class StockfishModule {}
