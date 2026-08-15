import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RecognitionGateway } from './recognition.gateway';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
  providers: [RecognitionGateway],
  exports: [RecognitionGateway],
})
export class WebsocketModule {}
