import {
  PipeTransform,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { v4 as isUuid } from "uuid";

@Injectable()
export class UuidValidationPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isUuid(value)) {
      throw new BadRequestException("Invalid UUID");
    }
    return value;
  }
}
