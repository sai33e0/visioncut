import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LocalStorageService } from "./local-storage.service";
import { R2StorageService } from "./r2-storage.service";
import { IStorageService, STORAGE_SERVICE } from "./storage.interface";

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      useFactory: (config: ConfigService): IStorageService => {
        const account = config.get<string>("R2_ACCOUNT_ID");
        const access = config.get<string>("R2_ACCESS_KEY_ID");
        const secret = config.get<string>("R2_SECRET_ACCESS_KEY");
        if (account && access && secret) {
          return new R2StorageService(config);
        }
        // Dev fallback — local filesystem under ./storage
        return new LocalStorageService();
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
