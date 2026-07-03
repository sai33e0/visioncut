import { Global, Module, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaService) {}
  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
